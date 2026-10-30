// Contract/regression checks: no credentials, network, database or billable purchases.
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const {
  travelWindow,
} = require('../dist/integrations/celitech/travel-window.js');
const {
  CelitechService,
} = require('../dist/integrations/celitech/celitech.service.js');
const {
  PricingService,
} = require('../dist/modules/pricing/pricing.service.js');
const { FxService } = require('../dist/modules/pricing/fx.service.js');
const {
  SettingsService,
} = require('../dist/modules/settings/settings.service.js');
const { TokenService } = require('../dist/modules/auth/token.service.js');
const { OrdersService } = require('../dist/modules/orders/orders.service.js');
const {
  ProvisioningService,
} = require('../dist/modules/orders/provisioning.service.js');
const {
  PaymentsService,
} = require('../dist/modules/payments/payments.service.js');
const {
  PaystackService,
} = require('../dist/integrations/paystack/paystack.service.js');
const {
  PaymentsController,
} = require('../dist/modules/payments/payments.controller.js');
const {
  ProvisioningQueue,
} = require('../dist/modules/orders/provisioning.queue.js');
const {
  CelitechWebhookController,
} = require('../dist/modules/usage/celitech-webhook.controller.js');
const { validateEnv } = require('../dist/config/env.validation.js');
const {
  buildMockPackages,
} = require('../dist/integrations/celitech/mock-data.js');
const {
  PRICELIST,
} = require('../dist/integrations/celitech/pricelist.data.js');
const { classifyDestination } = require('../dist/integrations/celitech/geo.js');
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
const cfg = (values = {}) => ({
  get: (k) =>
    ({
      CELITECH_MODE: 'live',
      CELITECH_ENVIRONMENT: 'PRODUCTION',
      CELITECH_CLIENT_ID: 'fixture-id',
      CELITECH_CLIENT_SECRET: 'fixture-secret',
      LIVE_SALES_ENABLED: 'false',
      ...values,
    })[k],
});
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });
const fixedNow = new Date('2026-09-16T12:00:00Z');
const day = (n) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const approvedFx = {
  snapshot: async () => ({
    rate: 130,
    approved: true,
    confirmedAt: null,
    expiresAt: null,
  }),
};
const zeroPricing = () =>
  new PricingService({ get: () => 0 }, approvedFx, {
    getNumbers: async (defaults) => defaults,
  });

test('automatic FX fetch is validated, persisted and shared by concurrent quotes', async () => {
  let reads = 0,
    saved = [];
  const at = Math.floor(Date.now() / 1000) - 60;
  global.fetch = async () => {
    reads++;
    return response({
      result: 'success',
      base_code: 'USD',
      rates: { KES: 130.45 },
      time_last_update_unix: at,
      time_next_update_unix: at + 86400,
    });
  };
  const fx = new FxService(
    { get: () => 129 },
    {
      getNumbers: async (defaults) => defaults,
      setMany: async (rows) => {
        saved = rows;
      },
    },
  );
  const [a, b] = await Promise.all([fx.snapshot(true), fx.snapshot(true)]);
  assert.equal(a.approved, true);
  assert.equal(a.rate, 130.45);
  assert.equal(b.rate, a.rate);
  assert.equal(reads, 1);
  assert.equal(saved.length, 3);
  await fx.snapshot(true);
  assert.equal(reads, 1);
});

test('FX reuses a recent persistent rate after restart, never a stale or future rate', async () => {
  global.fetch = async () => {
    throw Error('offline');
  };
  for (const age of [0, 86400000, 49 * 3600000, -86400000]) {
    const at = Date.now() - age;
    const fx = new FxService(
      { get: () => 129 },
      {
        getNumbers: async () => ({
          'fx.reference.usdToKes': 130,
          'fx.reference.observedAt': at,
          'fx.reference.nextUpdateAt': at + 86400000,
        }),
      },
    );
    assert.equal(
      (await fx.snapshot()).approved,
      age >= 0 && age < 48 * 3600000,
    );
  }
  const fx = new FxService(
    { get: () => 129 },
    { getNumbers: async (defaults) => defaults },
  );
  assert.equal(
    (await fx.snapshot()).approved,
    false,
    'dev fallback never permits real charges',
  );
});

test('launch pilot checks the current database role; email alone cannot enable payment', async () => {
  let account = { role: 'CUSTOMER', status: 'ACTIVE' };
  const s = new OrdersService(
    { user: { findUnique: async () => account } },
    {},
    {},
    { isMock: false },
    { environment: 'live' },
    {},
    cfg({ LIVE_SALES_ENABLED: 'true', LIVE_SALES_ADMIN_ONLY: 'true' }),
  );
  assert.equal((await s.checkoutAvailability()).checkoutEnabled, false);
  assert.equal(
    (await s.checkoutAvailability('customer')).checkoutEnabled,
    false,
  );
  account = { role: 'ADMIN', status: 'BLOCKED' };
  assert.equal((await s.checkoutAvailability('admin')).checkoutEnabled, false);
  account = { role: 'ADMIN', status: 'ACTIVE' };
  assert.equal((await s.checkoutAvailability('admin')).checkoutEnabled, true);
  await assert.rejects(() => s.createOrder({}), /restricted/);
});

test('live checkout rejects an unapproved or changed KES conversion before creating an order', async () => {
  let approved = false,
    writes = 0;
  const service = new OrdersService(
    {
      order: {
        create: async () => {
          writes++;
        },
      },
    },
    {},
    {},
    { isMock: false },
    { environment: 'live' },
    {},
    cfg({ LIVE_SALES_ENABLED: 'true' }),
  );
  service.quote = async () => ({
    total: 2,
    price: { fxRate: 130, fxApproved: approved },
  });
  const input = {
    phone: '+254725000000',
    email: 'test@example.invalid',
    compatAttested: true,
    expectedTotal: 2,
    expectedChargeAmount: 260,
  };
  await assert.rejects(() => service.createOrder(input), /confirm its USD/);
  approved = true;
  await assert.rejects(
    () => service.createOrder({ ...input, expectedChargeAmount: 259 }),
    /KES payment amount changed/,
  );
  await assert.rejects(
    () => service.createOrder({ ...input, expectedChargeAmount: undefined }),
    /KES payment amount changed/,
  );
  assert.equal(writes, 0);
});

test('quote shows the exact KES charge and blocks payment if FX approval has expired', async () => {
  let approved = true;
  const orders = {
    quote: async () => ({
      total: 2.99,
      subtotal: 2.99,
      discount: 0,
      quantity: 1,
      price: { retailKes: 2.99, fxRate: 129.5346, fxApproved: approved },
      window: { days: 7 },
    }),
    checkoutAvailability: async () => ({
      checkoutEnabled: true,
      checkoutNotice: null,
    }),
  };
  const s = new PaymentsService({}, cfg({ CELITECH_MODE: 'live' }), {}, orders);
  assert.equal((await s.quote({})).chargeAmount, 387.31);
  approved = false;
  const q = await s.quote({});
  assert.equal(q.chargeAmount, null);
  assert.equal(q.checkoutEnabled, false);
});

test('Paystack webhook acknowledges valid events with HTTP 200, not the default POST 201', () => {
  assert.equal(
    Reflect.getMetadata(
      '__httpCode__',
      PaymentsController.prototype.paystackWebhook,
    ),
    200,
  );
});

test('Paystack HMAC is validated over the exact raw body before an event is handled', async () => {
  const key = 'sk_live_fixture';
  const raw = Buffer.from(JSON.stringify({ event: 'unknown' }));
  const paystack = new PaystackService(
    cfg({ PAYSTACK_MODE: 'live', PAYSTACK_SECRET_KEY: key }),
  );
  const signature = createHmac('sha512', key).update(raw).digest('hex');
  const s = new PaymentsService({}, cfg(), paystack);
  assert.deepEqual(
    await s.handleWebhook({ event: 'unknown' }, { rawBody: raw, signature }),
    { ok: true },
  );
  await assert.rejects(
    () =>
      s.handleWebhook(
        { event: 'unknown' },
        { rawBody: Buffer.from('{}'), signature },
      ),
    /Invalid webhook/,
  );
  await assert.rejects(
    () =>
      s.handleWebhook({ event: 'unknown' }, { rawBody: raw, signature: 'bad' }),
    /Invalid webhook/,
  );
});

test('payment acknowledgment does not wait for the supplier; local dispatch is bounded and deduplicated', async () => {
  const started = [];
  let release;
  const block = new Promise((resolve) => {
    release = resolve;
  });
  const queue = new ProvisioningQueue(
    cfg(),
    {},
    {
      provision: async (id) => {
        started.push(id);
        await block;
      },
    },
  );
  await queue.enqueue('a');
  await queue.enqueue('a');
  await queue.enqueue('b');
  await queue.enqueue('c');
  assert.deepEqual(started, ['a', 'b']);
  release();
  await queue.onModuleDestroy();
});

test('blocked accounts lose access and JWT admin roles cannot survive demotion', async () => {
  let account = { status: 'ACTIVE', role: 'CUSTOMER' };
  const tokens = new TokenService(
    { verifyAsync: async () => ({ sub: 'user', role: 'ADMIN' }) },
    { get: () => '' },
    { user: { findUnique: async () => account } },
  );
  assert.equal((await tokens.verifyAccess('token')).role, 'CUSTOMER');
  account = { status: 'BLOCKED', role: 'ADMIN' };
  await assert.rejects(() => tokens.verifyAccess('token'), /unavailable/);
});

test('live catalogue preview explicitly disables checkout while payments remain in test', () => {
  const service = new OrdersService(
    {},
    {},
    {},
    { isMock: false },
    { environment: 'test' },
    {},
    cfg(),
  );
  assert.equal(service.salesAvailability.checkoutEnabled, false);
  assert.match(service.salesAvailability.checkoutNotice, /No payment/);
});

test('inclusive dates: both arrival and departure count', () => {
  assert.equal(
    travelWindow('2026-09-16', '2026-09-18', true, 30, fixedNow).days,
    3,
  );
  assert.equal(
    travelWindow('2026-09-16', '2026-10-15', true, 30, fixedNow).days,
    30,
  );
  assert.equal(
    travelWindow('2026-09-16', '2026-09-16', false, 30, fixedNow).days,
    1,
  );
});
for (const [start, end] of [
  ['2026-09-16', '2026-09-17'],
  ['2026-09-16', '2026-10-16'],
  ['2026-09-15', '2026-09-18'],
  ['2026-09-31', '2026-10-04'],
  ['2027-09-17', '2027-09-20'],
]) {
  test('reject invalid unlimited window ' + start + ' / ' + end, () =>
    assert.throws(() => travelWindow(start, end, true, 30, fixedNow)),
  );
}
test('unlimited cannot silently fall back to a default number of days', () =>
  assert.throws(() => travelWindow(undefined, undefined, true, 30, fixedNow)));
test('fixed tier 90 remains available', () =>
  assert.equal(
    travelWindow('2026-09-16', '2026-12-14', false, 90, fixedNow).days,
    90,
  ));
test('the price list has 229 distinct destinations and exact zero-markup rates', async () => {
  assert.equal(PRICELIST.length, 229);
  assert.equal(new Set(PRICELIST.map((x) => x.iso2)).size, 229);
  const packages = buildMockPackages(),
    pricing = zeroPricing();
  assert.equal(
    new Set(packages.map((p) => p.providerPackageId)).size,
    packages.length,
  );
  for (const row of PRICELIST.filter((x) => !x.restricted)) {
    for (const [tier, days] of [
      ['tier30', 30],
      ['tier90', 90],
    ])
      for (const [gb, price] of Object.entries(row[tier])) {
        const p = packages.find(
          (p) => p.providerPackageId === `pl_${row.iso2}_${gb}GB_${days}D`,
        );
        assert.ok(p, row.name + ' ' + gb + 'GB ' + days);
        assert.equal(p.priceUsd, price);
        assert.equal(
          (await pricing.priceUsd(price)).retailKes,
          Math.round(price * 100) / 100,
        );
      }
    if (row.unlimitedPerDay !== undefined)
      assert.equal(
        packages.find((p) => p.providerPackageId === `pl_${row.iso2}_UNLIMITED`)
          .priceUsd,
        row.unlimitedPerDay,
      );
  }
  assert.ok(
    packages.every((p) => p.dataGb !== 0.5 && p.destinationIso2 !== 'R4'),
  );
  assert.ok(
    packages
      .filter((p) => p.unlimited)
      .every((p) => p.minDays === 3 && p.validityDays === 30),
  );
});
test('regional labels do not misclassify territories or Asia as American Samoa', () => {
  assert.equal(classifyDestination('VI', 'US Virgin Islands').scope, 'COUNTRY');
  assert.equal(classifyDestination('AS', 'Asia').scope, 'REGION');
  assert.equal(classifyDestination('AS', 'American Samoa').scope, 'COUNTRY');
  assert.equal(classifyDestination('R1', 'Region-1').scope, 'GLOBAL');
});
test('price engine rejects a 100% processor fee rather than producing Infinity', async () => {
  const p = new PricingService({ get: () => 0 }, approvedFx, {
    getNumbers: async (defaults) => ({
      ...defaults,
      'pricing.processorFeePct': 1,
    }),
  });
  await assert.rejects(() => p.priceUsd(10));
});
test('markup is calculated on the full unlimited trip, rounding once, then quantity', async () => {
  const product = {
    id: 'unlimited',
    providerPackageId: 'u',
    supplierDestination: 'USA',
    unlimited: true,
    validityDays: 30,
    minDays: 3,
  };
  const catalog = { getProduct: () => product, getBaseUsd: () => 0.37 };
  const price = new PricingService(
    {
      get: (k) =>
        ({
          PRICING_FX_BUFFER_PCT: 0,
          PRICING_PROCESSOR_FEE_PCT: 0,
          PRICING_MARGIN_PCT: 0,
          PRICING_ROUND_TO: 0.5,
        })[k],
    },
    approvedFx,
    { getNumbers: async (defaults) => defaults },
  );
  const service = new OrdersService(
    {},
    catalog,
    price,
    { isMock: true },
    { environment: 'test' },
    { preview: async () => ({ valid: true, code: 'SAVE', discountKes: 1 }) },
    cfg(),
  );
  const q = await service.quote({
    productId: 'u',
    startDate: day(1),
    endDate: day(3),
    quantity: 3,
    promoCode: 'SAVE',
  });
  assert.equal(q.wholesale, 1.1099999999999999);
  assert.equal(q.price.retailKes, 1.5);
  assert.equal(q.subtotal, 4.5);
  assert.equal(q.total, 3.5);
});
test('fixed plans retain flat price multiplied by quantity', async () => {
  const service = new OrdersService(
    {},
    {
      getProduct: () => ({
        id: 'p',
        validityDays: 30,
        minDays: 1,
        unlimited: false,
      }),
      getBaseUsd: () => 5.8,
    },
    zeroPricing(),
    { isMock: true },
    {},
    {},
    cfg(),
  );
  assert.equal(
    (
      await service.quote({
        productId: 'p',
        startDate: day(1),
        endDate: day(7),
        quantity: 5,
      })
    ).total,
    29,
  );
  await assert.rejects(() =>
    service.quote({
      productId: 'p',
      startDate: day(1),
      endDate: day(31),
      quantity: 1,
    }),
  );
  await assert.rejects(() => service.quote({ productId: 'p', quantity: 6 }));
});

test('live trip wholesale receives all saved admin percentages before quantity and promo', async () => {
  let freshRead = false;
  const pricing = new PricingService({ get: () => 0 }, approvedFx, {
    getNumbers: async (_, fresh) => {
      freshRead = fresh;
      return {
        'pricing.marginPct': 0.35,
        'pricing.fxBufferPct': 0.03,
        'pricing.processorFeePct': 0.035,
        'pricing.roundTo': 0.5,
      };
    },
  });
  for (const unlimited of [false, true]) {
    const service = new OrdersService(
      {},
      {
        getProduct: () => ({
          id: 'p',
          providerPackageId: 'p',
          supplierDestination: 'USA',
          dataMb: 5000,
          unlimited,
          validityDays: 30,
          minDays: unlimited ? 3 : 1,
        }),
        getBaseUsd: () => 1,
      },
      pricing,
      {
        isMock: false,
        quote: async () => ({ priceUsd: 10, packageId: 'dated' }),
      },
      {},
      { preview: async () => ({ valid: true, code: 'SAVE', discountKes: 2 }) },
      cfg(),
    );
    const q = await service.quote({
      productId: 'p',
      startDate: day(1),
      endDate: day(7),
      quantity: 2,
      promoCode: 'SAVE',
    });
    assert.equal(q.wholesale, 10);
    assert.equal(q.price.retailKes, 14.5);
    assert.equal(q.subtotal, 29);
    assert.equal(q.total, 27);
  }
  assert.equal(freshRead, true);
});

test('checkout does not silently replace saved pricing with defaults during a database outage', async () => {
  const settings = new SettingsService({
    setting: {
      findMany: async () => {
        throw Error('unavailable');
      },
    },
  });
  await assert.rejects(
    () => settings.getNumbers({ 'pricing.marginPct': 0.35 }, true),
    /could not be verified/,
  );
});
test('read-only live quote uses the exact API total rather than multiplying it by days', async () => {
  let read;
  global.fetch = async (url, init) => {
    if (url.includes('/oauth2/'))
      return response({ access_token: 'token', expires_in: 3600 });
    read = new URL(url);
    return response({
      packages: [
        {
          id: 'quoted',
          dataLimitInGB: -1,
          minDays: 7,
          maxDays: 7,
          priceInCents: 1299,
        },
      ],
      afterCursor: null,
    });
  };
  const result = await new CelitechService(cfg()).quote(
    'USA',
    -1,
    day(1),
    day(7),
    7,
  );
  assert.equal(result.priceUsd, 12.99);
  assert.equal(read.searchParams.get('includeUnlimited'), 'true');
  assert.equal(read.searchParams.get('dataLimitInGB'), '-1');
});
test('catalogue traverses every cursor, uses current wire fields, and caches reads', async () => {
  let page = 0,
    reads = 0;
  global.fetch = async (url) => {
    reads++;
    if (url.includes('/oauth2/'))
      return response({ access_token: 'token', expires_in: 3600 });
    if (url.endsWith('/destinations'))
      return response({
        destinations: [
          {
            name: 'United States',
            destination: 'USA',
            destinationISO2: 'US',
            supportedCountries: ['United States'],
          },
        ],
      });
    page++;
    return response({
      packages: [
        {
          id: 'p' + page,
          destination: 'USA',
          dataLimitInGB: page,
          minDays: 0,
          maxDays: 30,
          priceInCents: 500,
        },
      ],
      afterCursor: page < 60 ? 'c' + page : null,
    });
  };
  const s = new CelitechService(cfg());
  assert.equal((await s.getCatalogue()).length, 60);
  assert.equal(page, 60);
  await s.getCatalogue();
  assert.equal(reads, 62);
});
test('repeated pagination cursor fails instead of returning a partial catalogue', async () => {
  global.fetch = async (url) =>
    url.includes('/oauth2/')
      ? response({ access_token: 'token', expires_in: 3600 })
      : url.endsWith('/destinations')
        ? response({ destinations: [] })
        : response({ packages: [], afterCursor: 'same' });
  await assert.rejects(
    () => new CelitechService(cfg()).getCatalogue(),
    /Repeated/,
  );
});
test('billable purchase is sent once with dates and without supplier-branded email', async () => {
  let writes = 0,
    body;
  global.fetch = async (url, init) => {
    if (url.includes('/oauth2/'))
      return response({ access_token: 'token', expires_in: 3600 });
    writes++;
    body = JSON.parse(init.body);
    return response([
      {
        purchase: { id: 'purchase' },
        profile: {
          iccid: '8901',
          manualActivationCode: 'LPA:1$smdp.example$matching',
        },
      },
    ]);
  };
  const p = await new CelitechService(cfg()).provision({
    destinationIso: 'USA',
    dataGb: 5,
    validityDays: 7,
    referenceId: 'ref',
    startDate: day(1),
    endDate: day(7),
    email: 'buyer@example.com',
  });
  assert.equal(writes, 1);
  assert.equal(body.quantity, 1);
  assert.equal(body.dataLimitInGB, 5);
  assert.ok(!('email' in body));
  assert.equal(p.matchingId, 'matching');
});
test('supplier timeout does not automatically retry a purchase', async () => {
  let writes = 0;
  global.fetch = async (url) => {
    if (url.includes('/oauth2/'))
      return response({ access_token: 'token', expires_in: 3600 });
    writes++;
    throw new Error('timeout');
  };
  await assert.rejects(() =>
    new CelitechService(cfg()).provision({
      destinationIso: 'USA',
      dataGb: 1,
      referenceId: 'ref',
      validityDays: 7,
    }),
  );
  assert.equal(writes, 1);
});
test('reference lookup failure is not interpreted as no purchase', async () => {
  global.fetch = async (url) =>
    url.includes('/oauth2/')
      ? response({ access_token: 'token', expires_in: 3600 })
      : response({}, 503);
  await assert.rejects(
    () => new CelitechService(cfg()).findByReference('ref'),
    /503/,
  );
});
test('unlimited consumption retains -1; decimal gigabytes are converted correctly', async () => {
  let remaining = -1;
  global.fetch = async (url) =>
    url.includes('/oauth2/')
      ? response({ access_token: 'token', expires_in: 3600 })
      : response({ dataUsageRemainingInGB: remaining, status: 'ACTIVE' });
  const s = new CelitechService(cfg());
  assert.equal((await s.getConsumption('p')).remainingBytes, -1);
  remaining = 0.5;
  assert.equal((await s.getConsumption('p')).remainingBytes, 500000000);
});
test('live fulfilment cannot be bought with test money or while the launch gate is off', async () => {
  for (const [environment, enabled] of [
    ['test', 'true'],
    ['live', 'false'],
  ]) {
    const s = new OrdersService(
      {},
      {},
      {},
      { isMock: false },
      { environment },
      {},
      cfg({ LIVE_SALES_ENABLED: enabled }),
    );
    await assert.rejects(() => s.createOrder({}), /Live sales/);
  }
  const s = new OrdersService(
    {},
    {},
    {},
    { isMock: true },
    { environment: 'live' },
    {},
    cfg(),
  );
  await assert.rejects(() => s.createOrder({}), /Real payments/);
});
test('private orders require their owner or the separate capability token', async () => {
  const row = {
    id: 'o',
    userId: 'owner',
    accessToken: 'unpredictable-token',
    esims: [],
    payment: null,
  };
  const s = new OrdersService({ order: { findUnique: async () => row } });
  await assert.rejects(() => s.getOrder('o'));
  await assert.rejects(() => s.getOrder('o', 'other', 'wrong'));
  assert.equal((await s.getOrder('o', 'owner')).id, 'o');
  assert.equal(
    (await s.getOrder('o', undefined, 'unpredictable-token')).id,
    'o',
  );
});
test('payment verification rejects wrong amount, currency, reference and environment', async () => {
  for (const change of [
    { amountSubunit: 129 },
    { currency: 'USD' },
    { reference: 'other' },
    { environment: 'test' },
  ]) {
    let transactions = 0;
    const p = {
      id: 'pay',
      orderId: 'o',
      invoiceId: 'ref',
      expectedAmount: 13000,
      chargeCurrency: 'KES',
      environment: 'live',
      order: { supplierMode: 'live' },
    };
    const s = new PaymentsService({
      payment: { findUnique: async () => p },
      order: { updateMany: async () => ({ count: 1 }) },
      $transaction: async () => {
        transactions++;
      },
    });
    await assert.rejects(() =>
      s.confirm('ref', {
        reference: 'ref',
        amountSubunit: 13000,
        currency: 'KES',
        environment: 'live',
        state: 'COMPLETE',
        ...change,
      }),
    );
    assert.equal(transactions, 0);
  }
});
test('test Paystack keys are identified as test even when API transport is live', () => {
  assert.equal(
    new PaystackService(
      cfg({ PAYSTACK_MODE: 'live', PAYSTACK_SECRET_KEY: 'sk_test_fixture' }),
    ).environment,
    'test',
  );
  assert.equal(
    new PaystackService(cfg({ PAYSTACK_MODE: 'mock' })).verifySignature(
      Buffer.from('{}'),
      'anything',
    ),
    false,
  );
});
test('an uncertain supplier attempt is lookup-only, never resubmitted', async () => {
  let purchases = 0,
    lookups = 0,
    state = 'SENT';
  const f = { id: 'f', reference: 'r', state: 'SENT', sentAt: new Date(0) };
  const order = {
    id: 'o',
    status: 'PROVISIONING',
    payment: { state: 'COMPLETE', environment: 'live' },
    supplierMode: 'live',
    startDate: day(1),
    endDate: day(7),
    fulfilments: [f],
    kind: 'PURCHASE',
    dataMb: 1000,
    validityDays: 7,
  };
  const db = {
    order: {
      findUnique: async () => order,
      updateMany: async () => ({ count: 0 }),
      update: async () => {},
    },
    fulfilment: {
      updateMany: async () => ({ count: 0 }),
      findUniqueOrThrow: async () => ({ ...f, state }),
    },
  };
  const supplier = {
    isMock: false,
    provision: async () => {
      purchases++;
    },
    findByReference: async () => {
      lookups++;
      return null;
    },
  };
  const s = new ProvisioningService(
    db,
    supplier,
    {},
    cfg({ LIVE_SALES_ENABLED: 'true' }),
  );
  await s.provision('o');
  assert.equal(purchases, 0);
  assert.equal(lookups, 1);
});
test('a recently claimed attempt is left to its worker, not prematurely reconciled', async () => {
  let reads = 0;
  const f = { id: 'f', reference: 'r', state: 'READY' };
  const order = {
    id: 'o',
    status: 'PROVISIONING',
    payment: { state: 'COMPLETE', environment: 'live' },
    supplierMode: 'live',
    startDate: day(1),
    endDate: day(7),
    fulfilments: [f],
  };
  const db = {
    order: {
      findUnique: async () => order,
      updateMany: async () => ({ count: 0 }),
    },
    fulfilment: {
      updateMany: async () => ({ count: 0 }),
      findUniqueOrThrow: async () => ({
        ...f,
        state: 'SENT',
        sentAt: new Date(),
      }),
    },
  };
  const s = new ProvisioningService(
    db,
    {
      isMock: false,
      findByReference: async () => {
        reads++;
      },
    },
    {},
    cfg({ LIVE_SALES_ENABLED: 'true' }),
  );
  await s.provision('o');
  assert.equal(reads, 0);
});
test('signed usage webhooks are persisted before acknowledgment, invalid signatures rejected', async () => {
  const secret = Buffer.from('test-signing-secret-not-real').toString('base64');
  const raw = Buffer.from(
    JSON.stringify({
      purchaseId: 'purchase-1',
      notificationPercentage: 80,
      dataLimitInGB: 5,
      dataUsageRemainingInGB: 1,
      actualPercentage: 80,
    }),
  );
  const timestamp = String(Math.floor(Date.now() / 1000)),
    id = 'msg_fixture';
  const signature =
    'v1,' +
    createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(id + '.' + timestamp + '.')
      .update(raw)
      .digest('base64');
  let saved = 0;
  const s = new CelitechWebhookController(
    {
      webhookEvent: {
        upsert: async () => {
          saved++;
        },
      },
    },
    cfg({ CELITECH_WEBHOOK_SECRET: 'whsec_' + secret }),
  );
  const req = {
    rawBody: raw,
    header: (k) =>
      ({
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      })[k],
  };
  await s.accept(req);
  assert.equal(saved, 1);
  await assert.rejects(() => s.accept({ ...req, rawBody: Buffer.from('{}') }));
  assert.equal(saved, 1);
});
test('environment validation prevents accidental launch with test keys', () => {
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: 'development',
        LIVE_SALES_ENABLED: 'true',
        CELITECH_MODE: 'live',
        CELITECH_CLIENT_ID: 'fixture',
        CELITECH_CLIENT_SECRET: 'fixture',
        PAYSTACK_MODE: 'live',
        PAYSTACK_SECRET_KEY: 'sk_test_fixture',
      }),
    /Live sales/,
  );
});
