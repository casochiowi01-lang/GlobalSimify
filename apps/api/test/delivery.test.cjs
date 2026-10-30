// Synthetic activation data only. No network, payments or real emails.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEsimPdf } = require('../dist/modules/notifications/esim-pdf.js');
const { UsageService } = require('../dist/modules/usage/usage.service.js');
const {
  UsageController,
} = require('../dist/modules/usage/usage.controller.js');
const {
  NotificationsService,
} = require('../dist/modules/notifications/notifications.service.js');
const {
  WhatsAppService,
} = require('../dist/integrations/whatsapp/whatsapp.service.js');
const installation = {
  title: 'TEST ONLY - UAE 1 GB',
  lpa: 'LPA:1$fixture.invalid$NOT-A-REAL-ACTIVATION',
  smdpAddress: 'fixture.invalid',
  matchingId: 'NOT-A-REAL-ACTIVATION',
  iccid: '0000000000000000000',
};
const esim = {
  ...installation,
  id: 'fixture-esim',
  userId: 'owner',
  orderId: 'fixture-order',
  order: {
    title: installation.title,
    accessToken: 'private-fixture-token',
    customerEmail: 'nobody@example.invalid',
  },
};

test('installation PDF is a real document, generated from synthetic data only', async () => {
  const pdf = await buildEsimPdf(installation);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 5000);
  if (process.env.DELIVERY_PDF_FIXTURE)
    require('node:fs').writeFileSync(process.env.DELIVERY_PDF_FIXTURE, pdf);
});

test('PNG and PDF deny other accounts, missing and forged capabilities', async () => {
  const s = new UsageService(
    { esim: { findUnique: async () => esim } },
    {},
    {},
  );
  for (const method of ['getQrPng', 'getInstallationPdf']) {
    for (const args of [
      [],
      ['attacker'],
      [undefined, 'wrong-token'],
      ['attacker', 'wrong-token'],
    ]) {
      await assert.rejects(
        () => s[method](esim.id, ...args),
        (e) => e.getStatus() === 404,
      );
    }
    assert.ok((await s[method](esim.id, 'owner')).length > 1000);
    assert.ok(
      (await s[method](esim.id, undefined, 'private-fixture-token')).length >
        1000,
    );
  }
});

test('download route uses ownership headers, private no-store and safe attachment filename', async () => {
  const pdf = Buffer.from('%PDF-fixture'),
    headers = {};
  let type, body;
  const c = new UsageController({
    getInstallationPdf: async (...args) => {
      assert.deepEqual(args, ['e', 'u', 'token']);
      return pdf;
    },
  });
  const res = {
    setHeader: (k, v) => (headers[k] = v),
    type: (v) => {
      type = v;
      return res;
    },
    send: (v) => {
      body = v;
    },
  };
  await c.installation('e', res, 'u', 'token');
  assert.equal(body, pdf);
  assert.equal(type, 'application/pdf');
  assert.equal(headers['Cache-Control'], 'private, no-store');
  assert.match(headers['Content-Disposition'], /^attachment;/);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
});

function notifications(accepted = true) {
  const sent = [],
    updates = [],
    logs = [];
  let claim = 1;
  const db = {
    esim: {
      findUnique: async () => esim,
      updateMany: async () => ({ count: claim-- > 0 ? 1 : 0 }),
      update: async (x) => updates.push(x),
    },
    notificationLog: { create: async (x) => logs.push(x) },
  };
  const n = new NotificationsService(
    db,
    { get: () => undefined },
    {
      send: async (msg) => {
        sent.push(msg);
        return accepted;
      },
    },
    {
      sendImage: () => {
        throw Error('No automatic WhatsApp transmission');
      },
    },
  );
  n.pushToUser = async () => {};
  const event = {
    esimId: esim.id,
    orderId: esim.orderId,
    userId: esim.userId,
    title: 'Plan <script>unsafe</script>',
    customerEmail: esim.order.customerEmail,
    customerPhone: '+000000000',
    lpa: esim.lpa,
  };
  return { n, event, sent, updates, logs };
}

test('provisioned email contains inline QR, PDF and account link; marks only after acceptance', async () => {
  const { n, event, sent, updates, logs } = notifications();
  await n.onProvisioned(event);
  await n.onProvisioned(event);
  assert.equal(sent.length, 1);
  assert.equal(updates.length, 1);
  assert.ok(updates[0].data.emailSentAt instanceof Date);
  const email = sent[0];
  assert.match(email.html, /globalsimify.com\/account\/esims/);
  assert.ok(!email.html.includes('<script>'));
  assert.ok(!email.html.includes('private-fixture-token'));
  assert.equal(email.attachments.length, 2);
  assert.equal(email.attachments[0].cid, 'esimqr');
  assert.equal(email.attachments[0].content.subarray(1, 4).toString(), 'PNG');
  assert.equal(email.attachments[1].content.subarray(0, 5).toString(), '%PDF-');
  assert.ok(!JSON.stringify(logs).includes(esim.lpa));
  assert.ok(!JSON.stringify(logs).includes(esim.matchingId));
});

test('email rejection is not marked delivered and remains eligible for recovery', async () => {
  const { n, event, updates } = notifications(false);
  await assert.rejects(() => n.onProvisioned(event), /not accepted/);
  assert.equal(updates.length, 0);
});

test('customer resend updates acceptance timestamp and does not transmit WhatsApp', async () => {
  const { n, sent, updates, logs } = notifications();
  await n.resendEsim(esim.id);
  assert.equal(sent.length, 1);
  assert.equal(updates.length, 1);
  assert.equal(logs[0].data.channel, 'email');
});

test('disabled WhatsApp never logs activation credentials or claims to have sent', async () => {
  const w = new WhatsAppService({ get: () => 'mock' }),
    output = [];
  w.logger = { debug: (m) => output.push(m) };
  assert.equal(
    await w.sendImage(
      '+000',
      'https://example.invalid/qr?access=SECRET',
      'activation-secret',
    ),
    false,
  );
  assert.equal(await w.sendText('+000', 'activation-secret'), false);
  assert.ok(!JSON.stringify(output).includes('SECRET'));
  assert.ok(!JSON.stringify(output).includes('activation-secret'));
});
