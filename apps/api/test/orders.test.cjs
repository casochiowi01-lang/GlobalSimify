// Order lifecycle checks against an in-memory database: no network, payments or supplier purchases.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { OrdersService } = require('../dist/modules/orders/orders.service.js');
const {
  ProvisioningService,
} = require('../dist/modules/orders/provisioning.service.js');
const { RefundsService } = require('../dist/modules/orders/refunds.service.js');
const {
  ProvisioningQueue,
} = require('../dist/modules/orders/provisioning.queue.js');
const cfg = (values = {}) => ({ get: (k) => values[k] });

// Minimal Prisma stand-in: equality, {not}, {in} filters, the order/payment relations and nested fulfilment create.
const match = (row, where = {}) =>
  Object.entries(where).every(([k, v]) =>
    v && typeof v === 'object' && !(v instanceof Date)
      ? 'not' in v
        ? row[k] !== v.not
        : 'in' in v
          ? v.in.includes(row[k])
          : true
      : row[k] === v,
  );
function fakeDb(seed = {}) {
  const t = {
    order: [],
    payment: [],
    refund: [],
    fulfilment: [],
    esim: [],
    ledgerEntry: [],
    commission: [],
    partner: [],
    ...seed,
  };
  const rel = {
    order: {
      payment: ['payment', 'orderId', true],
      fulfilments: ['fulfilment', 'orderId'],
      esims: ['esim', 'orderId'],
    },
    payment: { refunds: ['refund', 'paymentId'] },
  };
  let seq = 0;
  const hydrate = (name, row, include) => {
    if (!row) return null;
    const out = { ...row };
    for (const [k, v] of Object.entries(include ?? {})) {
      const [tbl, fk, one] = rel[name][k];
      const rows = t[tbl]
        .filter((r) => r[fk] === row.id)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((r) => hydrate(tbl, r, v.include));
      out[k] = one ? (rows[0] ?? null) : rows;
    }
    return out;
  };
  const model = (name) => {
    const m = {
      findUnique: async ({ where, include }) =>
        hydrate(
          name,
          t[name].find((r) => match(r, where)),
          include,
        ),
      findUniqueOrThrow: async (a) => {
        const r = await m.findUnique(a);
        if (!r) throw Error(name + ' not found');
        return r;
      },
      findMany: async ({ where } = {}) =>
        t[name].filter((r) => match(r, where)).map((r) => ({ ...r })),
      count: async ({ where }) => t[name].filter((r) => match(r, where)).length,
      create: async ({ data }) => {
        const { fulfilments, ...rest } = data;
        const row = { id: name + '-' + ++seq, ...rest };
        t[name].push(row);
        for (const f of fulfilments?.create ?? [])
          t.fulfilment.push({
            id: 'fulfilment-' + ++seq,
            orderId: row.id,
            state: 'READY',
            ...f,
          });
        return { ...row };
      },
      update: async ({ where, data }) => {
        const r = t[name].find((x) => match(x, where));
        if (!r) throw Error(name + ' not found');
        Object.assign(r, data);
        return { ...r };
      },
      updateMany: async ({ where, data }) => {
        const rows = t[name].filter((r) => match(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      upsert: async ({ where, create, update }) => {
        const r = t[name].find((x) => match(x, where));
        if (r) {
          Object.assign(r, update);
          return { ...r };
        }
        return m.create({ data: create });
      },
    };
    return m;
  };
  const db = Object.fromEntries(Object.keys(t).map((n) => [n, model(n)]));
  db.$transaction = async (fn) => fn(db);
  db.configured = true;
  db.t = t;
  return db;
}

const quote = {
  product: {
    id: 'uae-1gb',
    destIso: 'ARE',
    supplierDestination: 'ARE',
    unlimited: false,
    title: 'TEST ONLY - UAE 1 GB',
    dataMb: 1000,
  },
  window: { days: 7, startDate: '2026-11-01', endDate: '2026-11-07' },
  quantity: 1,
  wholesale: 4,
  packageId: 'pkg',
  price: { retailKes: 650, fxRate: 1, fxApproved: true },
  subtotal: 650,
  discount: 0,
  total: 650,
};
const checkout = {
  productId: 'uae-1gb',
  phone: '+254725000000',
  email: 'Buyer@Example.invalid',
  compatAttested: true,
  expectedTotal: 650,
  idempotencyKey: 'key-1',
};
function mockOrders(
  db,
  { supplier = {}, paystack = {}, config = {}, quantity = 1 } = {},
) {
  const emitted = [];
  const celitech = { isMock: true, ...supplier };
  const gateway = { environment: 'test', ...paystack };
  const s = new OrdersService(db, {}, {}, celitech, gateway, {}, cfg(config));
  s.quote = async () => ({
    ...quote,
    quantity,
    subtotal: 650 * quantity,
    total: 650 * quantity,
  });
  const saga = new ProvisioningService(
    db,
    celitech,
    { emit: (...e) => emitted.push(e) },
    cfg(config),
  );
  const refunds = new RefundsService(db, gateway);
  return { s, saga, refunds, emitted };
}
const liveSaga = (db, supplier) =>
  new ProvisioningService(
    db,
    { isMock: false, ...supplier },
    { emit: () => {} },
    cfg({ LIVE_SALES_ENABLED: 'true' }),
  );
function paidOrder({
  quantity = 2,
  kind = 'PURCHASE',
  supplierMode = 'mock',
  environment = 'test',
  status = 'PAID',
  fulfilment = 'READY',
  ...extra
} = {}) {
  const db = fakeDb();
  db.t.order.push({
    id: 'o',
    status,
    kind,
    supplierMode,
    unlimited: false,
    dataMb: 1000,
    validityDays: 7,
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    destinationIso: 'ARE',
    supplierDestination: 'ARE',
    baseUsd: 4,
    totalKes: 650,
    customerPhone: '+254725000000',
    customerEmail: 'nobody@example.invalid',
    title: quote.product.title,
    ...extra,
  });
  db.t.payment.push({
    id: 'pay',
    orderId: 'o',
    state: 'COMPLETE',
    environment,
    amountKes: 650,
    invoiceId: 'ref',
  });
  for (let index = 0; index < quantity; index++)
    db.t.fulfilment.push({
      id: 'f' + index,
      orderId: 'o',
      index,
      reference: 'ref-' + index,
      state: fulfilment,
      initialBytes: 0n,
      remainingBytes: 0n,
    });
  return db;
}
const profile = (n) => ({
  iccid: '8900' + n,
  smdpAddress: 'smdp.invalid',
  matchingId: 'NOT-REAL-' + n,
  lpa: 'LPA:1$smdp.invalid$NOT-REAL-' + n,
  providerPurchaseId: 'purchase-' + n,
  startDate: null,
  endDate: '2026-11-07',
});

test('checkout retry with the same key returns the original order instead of charging twice', async () => {
  const db = fakeDb();
  const { s } = mockOrders(db);
  const first = await s.createOrder(checkout);
  const again = await s.createOrder(checkout);
  assert.equal(again.id, first.id);
  assert.equal(db.t.order.length, 1);
  assert.equal(db.t.fulfilment.length, 1);
  assert.equal(first.customerEmail, 'buyer@example.invalid');
  assert.equal(first.status, 'DRAFT');
});

test('reusing a checkout key for a different selection is rejected', async () => {
  const db = fakeDb();
  const { s } = mockOrders(db);
  await s.createOrder(checkout);
  await assert.rejects(
    () => s.createOrder({ ...checkout, email: 'other@example.invalid' }),
    (e) => e.getStatus() === 409,
  );
  assert.equal(db.t.order.length, 1);
});

test('concurrent checkouts racing on one key resolve to the winning order via the unique constraint', async () => {
  for (const [winnerEmail, expectOk] of [
    ['buyer@example.invalid', true],
    ['other@example.invalid', false],
  ]) {
    const db = fakeDb();
    const { s } = mockOrders(db);
    const create = db.order.create;
    db.order.create = async (a) => {
      await create({
        data: {
          ...a.data,
          fulfilments: undefined,
          customerEmail: winnerEmail,
          requestHash:
            winnerEmail === 'buyer@example.invalid'
              ? a.data.requestHash
              : 'other-hash',
        },
      });
      throw new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test' },
      );
    };
    if (expectOk)
      assert.equal((await s.createOrder(checkout)).customerEmail, winnerEmail);
    else
      await assert.rejects(
        () => s.createOrder(checkout),
        (e) => e.getStatus() === 409,
      );
    assert.equal(db.t.order.length, 1);
  }
});

test('a changed or missing expected total blocks the order before any write', async () => {
  const db = fakeDb();
  const { s } = mockOrders(db);
  await assert.rejects(
    () => s.createOrder({ ...checkout, expectedTotal: 649.99 }),
    /price changed/,
  );
  await assert.rejects(
    () => s.createOrder({ ...checkout, expectedTotal: undefined }),
    /price changed/,
  );
  await assert.rejects(
    () => s.createOrder({ ...checkout, compatAttested: false }),
    /supports eSIM/,
  );
  assert.equal(db.t.order.length, 0);
});

test('each eSIM in a multi-quantity order gets its own fulfilment row and supplier reference', async () => {
  const db = fakeDb();
  const { s } = mockOrders(db, { quantity: 3 });
  await s.createOrder({ ...checkout, quantity: 3, expectedTotal: 1950 });
  assert.deepEqual(
    db.t.fulfilment.map((f) => f.index),
    [0, 1, 2],
  );
  assert.equal(new Set(db.t.fulfilment.map((f) => f.reference)).size, 3);
  assert.ok(db.t.fulfilment.every((f) => f.state === 'READY'));
});

test('paid order provisions every eSIM once, books cost and accrues partner commission once', async () => {
  const db = paidOrder({ partnerCode: 'Safari-Co' });
  db.t.partner.push({
    id: 'partner',
    slug: 'safari-co',
    status: 'ACTIVE',
    commissionPct: 0.1,
  });
  const bought = [];
  const { saga, emitted } = mockOrders(db, {
    supplier: {
      provision: async (r) => {
        bought.push(r.referenceId);
        return profile(bought.length);
      },
    },
  });
  await saga.provision('o');
  await saga.provision('o');
  assert.deepEqual(bought, ['ref-0', 'ref-1']);
  assert.equal(db.t.order[0].status, 'COMPLETED');
  assert.equal(db.t.esim.length, 2);
  assert.ok(db.t.fulfilment.every((f) => f.state === 'COMPLETE' && f.esimId));
  assert.equal(db.t.ledgerEntry.filter((e) => e.account === 'cogs').length, 2);
  assert.equal(db.t.commission.length, 1);
  assert.equal(Number(db.t.commission[0].amountKes), 65);
  assert.equal(emitted.length, 2);
});

test('resuming after a crash buys only the eSIMs that were never delivered', async () => {
  const db = paidOrder({ status: 'PROVISIONING' });
  db.t.fulfilment[0].state = 'COMPLETE';
  const bought = [];
  const { saga } = mockOrders(db, {
    supplier: {
      provision: async (r) => {
        bought.push(r.referenceId);
        return profile(9);
      },
    },
  });
  await saga.provision('o');
  assert.deepEqual(bought, ['ref-1']);
  assert.equal(db.t.order[0].status, 'COMPLETED');
  assert.equal(db.t.esim.length, 1);
});

test('a failed live purchase goes to review and later recovery only looks it up by reference', async () => {
  const db = paidOrder({
    quantity: 1,
    supplierMode: 'live',
    environment: 'live',
  });
  let purchases = 0,
    found = null;
  const saga = liveSaga(db, {
    provision: async () => {
      purchases++;
      throw Error('timeout');
    },
    findByReference: async (ref) => {
      assert.equal(ref, 'ref-0');
      return found;
    },
  });
  await saga.provision('o');
  assert.equal(purchases, 1);
  assert.equal(db.t.fulfilment[0].state, 'REVIEW');
  assert.equal(db.t.order[0].status, 'MANUAL_REVIEW');
  await saga.provision('o');
  assert.equal(purchases, 1);
  assert.equal(db.t.order[0].status, 'MANUAL_REVIEW');
  found = profile(1);
  await saga.provision('o');
  assert.equal(purchases, 1);
  assert.equal(db.t.order[0].status, 'COMPLETED');
  assert.equal(db.t.esim[0].iccid, '89001');
});

test('unpaid orders and supplier/payment environment mismatches never reach the supplier', async () => {
  let calls = 0;
  const supplier = {
    provision: async () => {
      calls++;
      return profile(1);
    },
  };
  const unpaid = paidOrder();
  unpaid.t.payment[0].state = 'PENDING';
  await mockOrders(unpaid, { supplier }).saga.provision('o');
  assert.equal(unpaid.t.order[0].status, 'PAID');
  const mismatch = paidOrder({ supplierMode: 'live' });
  await mockOrders(mismatch, { supplier }).saga.provision('o');
  assert.equal(mismatch.t.order[0].status, 'MANUAL_REVIEW');
  const testMoney = paidOrder({ supplierMode: 'live', environment: 'test' });
  await liveSaga(testMoney, supplier).provision('o');
  assert.equal(testMoney.t.order[0].status, 'MANUAL_REVIEW');
  assert.equal(calls, 0);
});

test('a top-up that returns a different ICCID is held for review instead of crediting the wrong eSIM', async () => {
  const db = paidOrder({
    quantity: 1,
    kind: 'TOPUP',
    targetIccid: '8900TARGET',
  });
  db.t.esim.push({
    id: 'e',
    iccid: '8900TARGET',
    initialBytes: 1000000000n,
    remainingBytes: 1n,
  });
  const { saga } = mockOrders(db, {
    supplier: { topUp: async () => profile('OTHER') },
  });
  await saga.provision('o');
  assert.equal(db.t.order[0].status, 'MANUAL_REVIEW');
  assert.equal(db.t.esim[0].remainingBytes, 1n);
  assert.equal(db.t.ledgerEntry.length, 0);
});

const refundable = (changes = {}) => {
  const db = paidOrder({
    status: 'COMPLETED',
    fulfilment: 'COMPLETE',
    ...changes,
  });
  return db;
};
const paystackRefund = (result = { ref: 'rf-1', status: 'completed' }) => {
  const p = {
    calls: 0,
    refund: async () => {
      p.calls++;
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return p;
};

test('refunds are refused while a supplier call is unresolved, a refund exists, or environments differ', async () => {
  const cases = [
    [
      (db) => {
        db.t.fulfilment[0].state = 'SENT';
      },
      /Reconcile/,
    ],
    [
      (db) => {
        db.t.refund.push({ id: 'r', paymentId: 'pay' });
      },
      /already exists/,
    ],
    [
      (db) => {
        db.t.payment[0].environment = 'live';
      },
      /original payment environment/,
    ],
  ];
  for (const [setup, error] of cases) {
    const db = refundable();
    setup(db);
    const paystack = paystackRefund();
    await assert.rejects(
      () => mockOrders(db, { paystack }).refunds.refundOrder('o', 'test'),
      error,
    );
    assert.equal(paystack.calls, 0);
    assert.equal(db.t.order[0].status, 'COMPLETED');
  }
});

test('a completed refund is booked once even when the provider webhook repeats', async () => {
  const db = refundable();
  const paystack = paystackRefund();
  const { refunds } = mockOrders(db, { paystack });
  await refunds.refundOrder('o', 'customer request');
  await refunds.completeRefund('pay', 'rf-1');
  assert.equal(paystack.calls, 1);
  assert.equal(db.t.order[0].status, 'REFUNDED');
  assert.equal(db.t.refund[0].state, 'completed');
  assert.equal(
    db.t.ledgerEntry.filter((e) => e.account === 'refunds').length,
    1,
  );
  await assert.rejects(
    () => refunds.refundOrder('o', 'again'),
    /already exists/,
  );
  assert.equal(paystack.calls, 1);
});

test('two simultaneous refund requests send only one to the provider', async () => {
  const db = refundable();
  const paystack = paystackRefund({ ref: 'rf-1', status: 'pending' });
  const { refunds } = mockOrders(db, { paystack });
  const results = await Promise.allSettled([
    refunds.refundOrder('o', 'a'),
    refunds.refundOrder('o', 'b'),
  ]);
  assert.equal(
    results.filter(
      (r) => r.status === 'rejected' && /in progress/.test(r.reason.message),
    ).length,
    1,
  );
  assert.equal(paystack.calls, 1);
  assert.equal(db.t.refund.length, 1);
  assert.equal(db.t.order[0].status, 'REFUND_PENDING');
});

test('an uncertain refund outcome goes to review and records nothing as refunded', async () => {
  const db = refundable();
  const paystack = paystackRefund(Error('timeout'));
  await mockOrders(db, { paystack }).refunds.refundOrder('o', 'test');
  assert.equal(db.t.order[0].status, 'MANUAL_REVIEW');
  assert.match(db.t.order[0].failureReason, /Check Paystack/);
  assert.equal(db.t.refund.length, 0);
  assert.equal(db.t.ledgerEntry.length, 0);
});

test('Redis queue keeps one retrying job per order and revives a failed one instead of duplicating it', async () => {
  const added = [],
    jobs = new Map();
  let retried = 0;
  const q = new ProvisioningQueue(cfg(), {}, {});
  q.queue = {
    getJob: async (id) => jobs.get(id),
    add: async (name, data, opts) => {
      added.push({ name, data, opts });
      jobs.set(opts.jobId, { getState: async () => 'waiting' });
    },
  };
  await q.enqueue('o');
  assert.equal(added.length, 1);
  assert.equal(added[0].opts.jobId, 'o');
  assert.equal(added[0].opts.attempts, 5);
  assert.equal(added[0].opts.backoff.type, 'exponential');
  jobs.set('o', {
    getState: async () => 'failed',
    retry: async () => {
      retried++;
    },
  });
  await q.enqueue('o');
  assert.equal(retried, 1);
  assert.equal(added.length, 1);
});

test('recovery sweep re-enqueues only paid or in-flight orders', async () => {
  const db = fakeDb();
  for (const status of [
    'DRAFT',
    'PAID',
    'PROVISIONING',
    'COMPLETED',
    'MANUAL_REVIEW',
    'REFUNDED',
  ])
    db.t.order.push({ id: status, status });
  const q = new ProvisioningQueue(cfg(), db, {});
  const queued = [];
  q.enqueue = async (id) => {
    queued.push(id);
  };
  await q.recoverStuckOrders();
  assert.deepEqual(queued.sort(), ['PAID', 'PROVISIONING']);
});
