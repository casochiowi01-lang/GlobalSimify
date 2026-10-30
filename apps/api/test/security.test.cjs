// Security regression tests: login-code brute force, session theft, account
// takeover via email change, double payouts and cross-account data access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { OtpService } = require('../dist/modules/auth/otp.service.js');
const { AuthService } = require('../dist/modules/auth/auth.service.js');
const { UsersService } = require('../dist/modules/users/users.service.js');
const {
  PartnersService,
} = require('../dist/modules/partners/partners.service.js');
const {
  SupportService,
} = require('../dist/modules/support/support.service.js');
const { envSchema } = require('../dist/config/env.validation.js');

const match = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return v.in.includes(row[k]);
      if ('lt' in v) return row[k] < v.lt;
      if ('gt' in v) return row[k] > v.gt;
      if ('not' in v) return row[k] !== v.not;
    }
    return row[k] === v;
  });

/** In-memory OtpChallenge table with Prisma-like atomic updateMany. */
function otpFixture() {
  const rows = [];
  let seq = 0;
  const db = {
    otpChallenge: {
      findFirst: async ({ where }) =>
        rows
          .filter((r) => match(r, where))
          .sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq)[0] ??
        null,
      create: async ({ data }) => {
        const row = {
          id: `c${++seq}`,
          seq,
          attempts: 0,
          consumedAt: null,
          createdAt: new Date(),
          ...data,
        };
        rows.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const hit = rows.filter((r) => match(r, where));
        for (const r of hit) {
          for (const [k, v] of Object.entries(data)) {
            r[k] =
              v && typeof v === 'object' && 'increment' in v
                ? r[k] + v.increment
                : v;
          }
        }
        return { count: hit.length };
      },
      aggregate: async ({ where }) => ({
        _sum: {
          attempts: rows
            .filter((r) => match(r, where))
            .reduce((n, r) => n + r.attempts, 0),
        },
      }),
    },
  };
  const sent = [];
  const otp = new OtpService(
    db,
    { isProduction: true },
    { send: async () => {} },
    { send: async (m) => sent.push(m) },
  );
  const codeFrom = (mail) => mail.subject.slice(0, 6);
  return { otp, rows, sent, codeFrom };
}
const wrong = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

test('parallel guesses cannot exceed five attempts on one login code', async () => {
  const { otp, rows, sent, codeFrom } = otpFixture();
  await otp.issue('buyer@example.invalid', 'email');
  const bad = wrong(codeFrom(sent[0]));
  const results = await Promise.all(
    Array.from({ length: 20 }, () => otp.verify('buyer@example.invalid', bad)),
  );
  assert.ok(results.every((ok) => ok === false));
  assert.equal(rows[0].attempts, 5);
  assert.equal(
    await otp.verify('buyer@example.invalid', codeFrom(sent[0])),
    false,
  );
});

test('requesting new codes cannot reset the failure budget for an inbox', async () => {
  const { otp, rows, sent, codeFrom } = otpFixture();
  for (let round = 0; round < 3; round++) {
    await otp.issue('buyer@example.invalid', 'email');
    rows.at(-1).createdAt = new Date(Date.now() - 60_000 * (3 - round)); // bypass resend cooldown
    for (let i = 0; i < 5; i++)
      await otp.verify('buyer@example.invalid', wrong(codeFrom(sent.at(-1))));
  }
  await otp.issue('buyer@example.invalid', 'email');
  assert.equal(
    await otp.verify('buyer@example.invalid', codeFrom(sent.at(-1))),
    false,
  );
});

test('only the newest login code works and a code works only once', async () => {
  const { otp, rows, sent, codeFrom } = otpFixture();
  await otp.issue('buyer@example.invalid', 'email');
  rows[0].createdAt = new Date(Date.now() - 60_000);
  await otp.issue('buyer@example.invalid', 'email');
  assert.equal(
    await otp.verify('buyer@example.invalid', codeFrom(sent[0])),
    false,
  );
  assert.equal(
    await otp.verify('buyer@example.invalid', codeFrom(sent[1])),
    true,
  );
  assert.equal(
    await otp.verify('buyer@example.invalid', codeFrom(sent[1])),
    false,
  );
});

function sessionFixture(sessions) {
  const db = {
    session: {
      findFirst: async ({ where }) =>
        sessions.find((s) => s.refreshHash === where.refreshHash) ?? null,
      updateMany: async ({ where, data }) => {
        const hit = sessions.filter((s) => match(s, where));
        hit.forEach((s) => Object.assign(s, data));
        return { count: hit.length };
      },
    },
  };
  return new AuthService(
    db,
    { get: () => undefined },
    {},
    { hash: (t) => `h:${t}` },
  );
}

test('replaying a rotated refresh token signs the account out everywhere', async () => {
  const sessions = [
    {
      id: 's1',
      userId: 'u',
      refreshHash: 'h:stolen',
      revokedAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 1e9),
      user: { role: 'CUSTOMER' },
    },
    {
      id: 's2',
      userId: 'u',
      refreshHash: 'h:current',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1e9),
    },
  ];
  const auth = sessionFixture(sessions);
  await assert.rejects(() => auth.refresh('stolen', {}), /Session expired/);
  assert.ok(
    sessions[1].revokedAt instanceof Date,
    'the live session was revoked',
  );
});

test('two tabs refreshing at once do not trigger the theft response', async () => {
  const sessions = [
    {
      id: 's1',
      userId: 'u',
      refreshHash: 'h:old',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1e9),
      user: { role: 'CUSTOMER' },
    },
    {
      id: 's2',
      userId: 'u',
      refreshHash: 'h:new',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1e9),
    },
  ];
  await assert.rejects(() => sessionFixture(sessions).refresh('old', {}));
  assert.equal(sessions[1].revokedAt, null);
});

test('a profile update can never change the sign-in email', async () => {
  const writes = [];
  const users = new UsersService({
    user: {
      update: async (args) => {
        writes.push(args.data);
        return { id: 'u' };
      },
      findUnique: async () => ({
        id: 'u',
        email: 'owner@example.invalid',
        name: 'New',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      }),
    },
  });
  await users
    .updateProfile('u', { name: 'New', email: 'victim@example.invalid' })
    .catch(() => {});
  assert.equal(writes.length, 1);
  assert.ok(!('email' in writes[0]));
});

test('two simultaneous payout requests pay the same commissions only once', async () => {
  const commissions = [
    { id: 'c1', partnerId: 'p', amountKes: 400, state: 'ACCRUED' },
    { id: 'c2', partnerId: 'p', amountKes: 300, state: 'ACCRUED' },
  ];
  const payouts = [];
  const db = {
    partner: {
      findUnique: async () => ({
        id: 'p',
        name: 'Agency',
        mpesaNumber: '+254700000000',
      }),
    },
    commission: {
      findMany: async ({ where }) =>
        commissions.filter((c) => match(c, where)).map((c) => ({ ...c })),
      updateMany: async ({ where, data }) => {
        const hit = commissions.filter((c) => match(c, where));
        hit.forEach((c) => Object.assign(c, data));
        return { count: hit.length };
      },
    },
    payout: {
      create: async ({ data }) => {
        const p = { id: `po${payouts.length + 1}`, ...data };
        payouts.push(p);
        return p;
      },
      update: async () => ({}),
    },
  };
  db.$transaction = async (fn) => fn(db);
  const partners = new PartnersService(db, {
    sendMoney: () => ({ trackingId: 't' }),
  });
  const results = await Promise.allSettled([
    partners.requestPayout('u'),
    partners.requestPayout('u'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(
    results.find((r) => r.status === 'rejected').reason.message,
    /already in progress/,
  );
  assert.ok(commissions.every((c) => c.payoutId === commissions[0].payoutId));
});

test('support tickets only attach diagnostics for the caller’s own eSIM', async () => {
  const esims = [
    {
      id: 'e1',
      userId: 'owner',
      iccid: '8900',
      profileStatus: 'INSTALLED',
      remainingBytes: 1n,
      expiresAt: null,
    },
  ];
  const tickets = [];
  const support = new SupportService({
    esim: {
      findFirst: async ({ where }) =>
        esims.find((e) => match(e, where)) ?? null,
    },
    ticket: {
      create: async ({ data }) => (
        tickets.push(data),
        { id: 't', status: 'OPEN' }
      ),
    },
  });
  await support.create({ userId: 'attacker', esimId: 'e1', message: 'help' });
  await support.create({ esimId: 'e1', message: 'help' });
  await support.create({ userId: 'owner', esimId: 'e1', message: 'help' });
  assert.equal(tickets[0].diagnostics, undefined);
  assert.equal(tickets[1].diagnostics, undefined);
  assert.equal(tickets[2].diagnostics.iccid, '8900');
});

test('an unset NODE_ENV is treated as production, never development', () => {
  assert.equal(envSchema.shape.NODE_ENV.parse(undefined), 'production');
});

test('login codes are stored only as bcrypt hashes', async () => {
  const { otp, rows, sent, codeFrom } = otpFixture();
  await otp.issue('buyer@example.invalid', 'email');
  assert.ok(!JSON.stringify(rows).includes(codeFrom(sent[0])));
  assert.ok(await bcrypt.compare(codeFrom(sent[0]), rows[0].codeHash));
});
