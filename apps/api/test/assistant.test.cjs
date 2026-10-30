// No credentials, network, purchases or production account reads.
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  AssistantToolsService,
  ASSISTANT_TOOLS,
} = require('../dist/modules/assistant/assistant-tools.service.js');
const {
  AssistantService,
} = require('../dist/modules/assistant/assistant.service.js');
const {
  AssistantAuthGuard,
} = require('../dist/modules/assistant/assistant-auth.guard.js');
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
const plan = {
  id: 'p1',
  title: 'UAE 1 GB',
  destName: 'UAE',
  destIso: 'AE',
  dataLabel: '1 GB',
  minDays: 1,
  validityDays: 30,
  unlimited: false,
  priceKes: 10.53,
  providerPackageId: 'private',
  supplierDestination: 'ARE',
};
const catalog = {
  ensureFresh: async () => {},
  availability: { available: true },
  getCountry: () => ({ iso: 'AE' }),
  search: () => [{ iso: 'AE', name: 'UAE', region: 'Middle East' }],
  getProduct: () => plan,
  listProducts: () => [
    plan,
    { ...plan, id: 'unlimited', unlimited: true, priceKes: 2.1 },
  ],
};
const config = (extra = {}) => ({
  get: (k) =>
    ({
      ASSISTANT_ENABLED: 'true',
      OPENAI_API_KEY: 'fixture',
      ASSISTANT_MODEL: 'gpt-5-mini',
      ASSISTANT_DAILY_REQUEST_LIMIT: 200,
      ...extra,
    })[k],
});

test('strict schemas advertise only read-only tools, reject unknown properties', async () => {
  assert.equal(ASSISTANT_TOOLS.length, 7);
  for (const tool of ASSISTANT_TOOLS) {
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.additionalProperties, false);
  }
  const s = new AssistantToolsService(catalog, {}, {}, {});
  assert.match(
    (await s.run('create_purchase', {})).data.error,
    /not available/,
  );
  assert.match(
    (await s.run('list_my_esims', { offset: 0, userId: 'victim' }, 'attacker'))
      .data.error,
    /Invalid/,
  );
});
test('guest account requests cannot touch database or supplier', async () => {
  const s = new AssistantToolsService(
    {},
    {},
    new Proxy(
      {},
      {
        get() {
          throw Error('must not read');
        },
      },
    ),
    {},
  );
  for (const [name, args] of [
    ['list_my_esims', { offset: 0 }],
    ['list_my_orders', { offset: 0 }],
    ['my_esim_details', { esimId: 'victim', detail: 'device' }],
  ]) {
    assert.match((await s.run(name, args)).data.error, /Sign in/);
  }
});
test('ownership checked before all eSIM details, including forged IDs', async () => {
  let count = 0;
  const s = new AssistantToolsService(
    catalog,
    {},
    {
      esim: {
        findFirst: async (q) => {
          assert.deepEqual(q.where, { id: 'victim', userId: 'attacker' });
          count++;
          return null;
        },
      },
    },
    new Proxy(
      {},
      {
        get() {
          throw Error('supplier must not be touched');
        },
      },
    ),
  );
  for (const detail of ['usage', 'device', 'history', 'topup_plans'])
    assert.match(
      (await s.run('my_esim_details', { esimId: 'victim', detail }, 'attacker'))
        .data.error,
      /not found/,
    );
  assert.equal(count, 4);
});
test('own eSIM list has user filter, pagination, no activation secrets or full ICCID', async () => {
  const s = new AssistantToolsService(
    catalog,
    {},
    {
      esim: {
        findMany: async (q) => {
          assert.equal(q.where.userId, 'owner');
          assert.equal(q.take, 13);
          assert.equal(q.select.lpa, undefined);
          return [
            {
              id: 'e1',
              iccid: '123456789012345',
              profileStatus: 'RELEASED',
              unlimited: false,
              order: { title: 'UAE', destinationIso: 'AE' },
              lpa: 'secret',
            },
          ];
        },
      },
    },
    {},
  );
  const r = await s.run('list_my_esims', { offset: 0 }, 'owner');
  assert.equal(r.data.esims[0].iccidLast4, '2345');
  assert.ok(!JSON.stringify(r).includes('secret'));
  assert.ok(!JSON.stringify(r).includes('123456789012345'));
});
test('device response strips EID and any supplier extra fields', async () => {
  const s = new AssistantToolsService(
    catalog,
    {},
    {
      esim: {
        findFirst: async () => ({ id: 'e1', order: { destinationIso: 'AE' } }),
      },
    },
    {
      getDevice: async () => ({
        oem: 'Apple',
        hardwareName: 'Phone',
        hardwareModel: 'Model',
        eid: 'private-eid',
        secret: 'secret',
      }),
    },
  );
  const r = await s.run(
    'my_esim_details',
    { esimId: 'e1', detail: 'device' },
    'owner',
  );
  assert.deepEqual(r.data.device, {
    brand: 'Apple',
    model: 'Model',
    name: 'Phone',
  });
});
test('plans distinguish package and daily ESTIMATES; no wholesale or supplier IDs', async () => {
  const s = new AssistantToolsService(catalog, {}, {}, {});
  const r = await s.run('list_plans', { destination: 'AE', offset: 0 });
  assert.equal(r.data.plans[1].basis, 'PER_DAY_ESTIMATE');
  assert.match(r.cards[1].lines[1], /per day/);
  assert.ok(!JSON.stringify(r).includes('private'));
  assert.ok(!JSON.stringify(r).includes('supplierDestination'));
});
test('exact quote delegates unchanged to checkout including dates quantity promo and user', async () => {
  const a = {
    productId: 'p1',
    startDate: '2026-10-01',
    endDate: '2026-10-07',
    quantity: 2,
    promoCode: 'SAVE',
  };
  const quote = {
    total: 21.06,
    discount: 0,
    subtotal: 21.06,
    unitPrice: 10.53,
    currency: 'USD',
    chargeCurrency: 'KES',
    chargeAmount: 2728.12,
    days: 7,
    quantity: 2,
    startDate: a.startDate,
    endDate: a.endDate,
    checkoutEnabled: false,
    checkoutNotice: 'Sales paused',
  };
  const s = new AssistantToolsService(
    catalog,
    {
      quote: async (input, user) => {
        assert.deepEqual(input, a);
        assert.equal(user, 'owner');
        return quote;
      },
    },
    {},
    {},
  );
  const r = await s.run('quote_plan', a, 'owner');
  assert.equal(r.data.total, quote.total);
  assert.match(r.cards[0].lines.join(' '), /USD 21.06/);
  assert.match(r.cards[0].lines.join(' '), /Sales paused/);
});
test('invalid quantity or missing dates cannot reach quote engine', async () => {
  const s = new AssistantToolsService(
    catalog,
    {
      quote: () => {
        throw Error('must not call');
      },
    },
    {},
    {},
  );
  for (const quantity of [0, 6, 1.5])
    assert.match(
      (
        await s.run('quote_plan', {
          productId: 'p1',
          startDate: '2026-10-01',
          endDate: '2026-10-07',
          quantity,
          promoCode: null,
        })
      ).data.error,
      /Invalid/,
    );
});
test('top-up options belong to owned eSIM destination and exclude unlimited', async () => {
  const s = new AssistantToolsService(
    {
      ...catalog,
      listProducts: (dest) => {
        assert.equal(dest, 'AE');
        return catalog.listProducts();
      },
    },
    {},
    {
      esim: {
        findFirst: async () => ({ id: 'e1', order: { destinationIso: 'AE' } }),
      },
    },
    {},
  );
  const r = await s.run(
    'my_esim_details',
    { esimId: 'e1', detail: 'topup_plans' },
    'owner',
  );
  assert.equal(r.data.plans.length, 1);
  assert.match(r.cards[0].href, /account\/esims/);
});
test('supplier errors are sanitized, not leaked', async () => {
  const s = new AssistantToolsService(
    catalog,
    {
      quote: async () => {
        throw Error('secret supplier token');
      },
    },
    {},
    {},
  );
  const r = await s.run('quote_plan', {
    productId: 'p1',
    startDate: '2026-10-01',
    endDate: '2026-10-07',
    quantity: 1,
    promoCode: null,
  });
  assert.ok(!JSON.stringify(r).includes('secret supplier'));
});
test('missing key or disabled switch never calls OpenAI', async () => {
  global.fetch = () => {
    throw Error('network forbidden');
  };
  for (const override of [
    { OPENAI_API_KEY: '' },
    { ASSISTANT_ENABLED: 'false' },
  ])
    assert.equal(
      (
        await new AssistantService(config(override), {}).chat([
          { role: 'user', content: 'hi' },
        ])
      ).available,
      false,
    );
});
test('Responses loop uses stateless requests and forwards only verified user context', async () => {
  let n = 0;
  const requests = [];
  global.fetch = async (url, opt) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    requests.push(JSON.parse(opt.body));
    return new Response(
      JSON.stringify({
        output:
          ++n === 1
            ? [
                {
                  type: 'function_call',
                  name: 'list_my_esims',
                  call_id: 'call1',
                  arguments: '{"offset":0}',
                },
              ]
            : [
                {
                  type: 'message',
                  content: [
                    { type: 'output_text', text: 'Your eSIMs are below.' },
                  ],
                },
              ],
      }),
    );
  };
  const s = new AssistantService(config(), {
    run: async (name, args, user) => {
      assert.equal(user, 'owner');
      return { data: { esims: [] }, cards: [] };
    },
  });
  assert.equal(
    (await s.chat([{ role: 'user', content: 'show my esims' }], 'owner')).reply,
    'Your eSIMs are below.',
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0].store, false);
  assert.equal(requests[1].input.at(-1).call_id, 'call1');
  assert.ok(!JSON.stringify(requests).includes('Bearer fixture'));
});
test('daily per-instance cap stops additional model calls', async () => {
  let count = 0;
  global.fetch = async () => {
    count++;
    return new Response(JSON.stringify({ output: [] }));
  };
  const s = new AssistantService(
    config({ ASSISTANT_DAILY_REQUEST_LIMIT: 1 }),
    {},
  );
  await s.chat([{ role: 'user', content: 'hi' }]);
  await s.chat([{ role: 'user', content: 'hi' }]);
  assert.equal(count, 1);
});
test('monetary prose from model is replaced by deterministic copy and authoritative cards', async () => {
  let n = 0;
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        output:
          ++n === 1
            ? [
                {
                  type: 'function_call',
                  name: 'quote_plan',
                  call_id: 'q1',
                  arguments: '{}',
                },
              ]
            : [
                {
                  type: 'message',
                  content: [
                    { type: 'output_text', text: 'Your cost is USD 99999.00.' },
                  ],
                },
              ],
      }),
    );
  const card = {
    kind: 'quote',
    title: 'Verified',
    lines: ['Trip total: USD 21.06'],
    href: '/plan/p1',
    label: 'Review',
  };
  const s = new AssistantService(config(), {
    run: async () => ({ data: { total: 21.06 }, cards: [card] }),
  });
  const r = await s.chat([{ role: 'user', content: 'quote' }]);
  assert.ok(!r.reply.includes('99999'));
  assert.deepEqual(r.cards[0], card);
});
test('assistant guard allows guests, refreshes expired tokens, rejects blocked sessions', async () => {
  const request = { headers: {} };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  const guard = new AssistantAuthGuard({
    verifyAccess: async () => {
      throw Error('expired or blocked');
    },
  });
  assert.equal(await guard.canActivate(context), true);
  request.headers.authorization = 'Bearer expired';
  await assert.rejects(() => guard.canActivate(context), /sign in/);
});
