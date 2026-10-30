const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TaskDispatcher,
} = require('../dist/modules/tasks/task-dispatcher.service.js');
const {
  PrivateWorkerGuard,
  WorkerController,
} = require('../dist/modules/tasks/worker.controller.js');
const {
  ProvisioningQueue,
} = require('../dist/modules/orders/provisioning.queue.js');
const { OrdersService } = require('../dist/modules/orders/orders.service.js');
const { validateEnv } = require('../dist/config/env.validation.js');
const config = (extra = {}) => ({
  get: (k) =>
    ({
      BACKGROUND_MODE: 'cloud-tasks',
      BACKGROUND_ROLE: 'worker',
      TASKS_QUEUE_PATH:
        'projects/globalsimify/locations/europe-west1/queues/simify-background',
      WORKER_URL: 'https://worker.run.app',
      TASKS_INVOKER_EMAIL: 'tasks@globalsimify.iam.gserviceaccount.com',
      ...extra,
    })[k],
});

test('public API can never execute internal jobs, even with forged task headers', () => {
  assert.throws(
    () =>
      new PrivateWorkerGuard(config({ BACKGROUND_ROLE: 'api' })).canActivate(),
    /Private worker/,
  );
  assert.throws(
    () =>
      new PrivateWorkerGuard(
        config({ BACKGROUND_MODE: 'in-process' }),
      ).canActivate(),
    /Private worker/,
  );
  assert.equal(new PrivateWorkerGuard(config()).canActivate(), true);
});
test('task dispatch uses private worker audience, OIDC and a bounded deadline, no customer data', async () => {
  let request;
  const s = new TaskDispatcher(config());
  s.auth = {
    getClient: async () => ({
      request: async (r) => {
        request = r;
      },
    }),
  };
  await s.enqueue('provision', 'order-1');
  const t = request.data.task;
  assert.equal(
    t.httpRequest.url,
    'https://worker.run.app/api/v1/internal/work/run',
  );
  assert.equal(t.dispatchDeadline, '600s');
  assert.equal(t.httpRequest.oidcToken.audience, 'https://worker.run.app');
  assert.deepEqual(JSON.parse(Buffer.from(t.httpRequest.body, 'base64')), {
    kind: 'provision',
    id: 'order-1',
  });
  const first = t.name;
  await s.enqueue('provision', 'order-1');
  assert.equal(request.data.task.name, first);
  assert.equal(request.retry, false);
});
test('duplicate queued task is success; dispatch outage is not swallowed', async () => {
  const s = new TaskDispatcher(config());
  let code = 409;
  s.auth = {
    getClient: async () => ({
      request: async () => {
        throw { response: { status: code } };
      },
    }),
  };
  await s.enqueue('emails');
  code = 503;
  await assert.rejects(() => s.enqueue('emails'), /pending recovery/);
});
test('managed provisioning enqueue waits for durable dispatch, never runs in background', async () => {
  let released,
    ran = 0,
    finished = false;
  const saved = new Promise((r) => (released = r));
  const queue = new ProvisioningQueue(
    config(),
    {},
    {
      provision: async () => {
        ran++;
      },
    },
    { enqueue: async () => saved },
  );
  const p = queue.enqueue('order').then(() => (finished = true));
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(ran, 0);
  released();
  await p;
  assert.equal(finished, true);
  assert.equal(ran, 0);
});
test('worker does not acknowledge before provisioning and email delivery finish', async () => {
  let finish;
  const pending = new Promise((r) => (finish = r));
  const calls = [];
  const c = new WorkerController(
    {},
    {
      order: { findUnique: async () => ({ status: 'COMPLETED' }) },
      setting: {
        upsert: async () => {
          calls.push('stamp');
        },
      },
    },
    {
      provision: async () => {
        calls.push('provision');
      },
    },
    {},
    {
      retryEmails: async () => {
        calls.push('email');
        await pending;
      },
    },
    {},
  );
  let done = false;
  const work = c
    .run({ kind: 'provision', id: 'one' })
    .then(() => (done = true));
  await new Promise((r) => setImmediate(r));
  assert.equal(done, false);
  finish();
  await work;
  assert.deepEqual(calls, ['provision', 'email', 'stamp']);
});
test('in-progress worker response retries; manual-review does not repeat a supplier write', async () => {
  let state = 'PROVISIONING';
  const c = new WorkerController(
    {},
    {
      order: { findUnique: async () => ({ status: state }) },
      setting: { upsert: async () => {} },
    },
    { provision: async () => {} },
    {},
    { retryEmails: async () => {} },
    {},
  );
  await assert.rejects(
    () => c.run({ kind: 'provision', id: 'one' }),
    /in progress/,
  );
  state = 'MANUAL_REVIEW';
  assert.equal((await c.run({ kind: 'provision', id: 'one' })).ok, true);
});
test('scheduled recovery wakes bounded jobs and records heartbeat only after successful enqueue', async () => {
  const tasks = [];
  let stamp = 0;
  const c = new WorkerController(
    {
      enqueue: async (...a) => {
        tasks.push(a);
      },
    },
    {
      order: { findMany: async () => [{ id: 'lost' }] },
      setting: {
        upsert: async () => {
          stamp++;
        },
      },
    },
    {},
    {},
    {},
    {},
  );
  assert.equal((await c.recover()).dispatchedPaidOrders, 1);
  assert.deepEqual(tasks[0], ['provision', 'lost']);
  assert.equal(stamp, 1);
  assert.equal(tasks.length, 6);
  c.tasks = {
    enqueue: async () => {
      throw Error('outage');
    },
  };
  await assert.rejects(() => c.recover());
  assert.equal(stamp, 1);
});
test('stale worker heartbeat blocks new customer charges', async () => {
  let time = Date.now() - 16 * 60000;
  const s = new OrdersService(
    { setting: { findUnique: async () => ({ value: time }) } },
    {},
    {},
    { isMock: false },
    { environment: 'live' },
    {},
    config({ LIVE_SALES_ENABLED: 'true' }),
  );
  assert.equal((await s.checkoutAvailability()).checkoutEnabled, false);
  time = Date.now();
  assert.equal((await s.checkoutAvailability()).checkoutEnabled, true);
});
test('incomplete Cloud Tasks configuration fails startup', () => {
  assert.throws(
    () => validateEnv({ BACKGROUND_MODE: 'cloud-tasks' }),
    /Cloud Tasks requires/,
  );
});
