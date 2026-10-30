// Opt-in integration test. Refuses any database except our disposable local instance.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { OrdersService } = require('../dist/modules/orders/orders.service.js');
const {
  ProvisioningService,
} = require('../dist/modules/orders/provisioning.service.js');
const {
  PricingService,
} = require('../dist/modules/pricing/pricing.service.js');
const {
  SettingsService,
} = require('../dist/modules/settings/settings.service.js');
const {
  CelitechService,
} = require('../dist/integrations/celitech/celitech.service.js');
const { AuthService } = require('../dist/modules/auth/auth.service.js');
const { UsageService } = require('../dist/modules/usage/usage.service.js');

test(
  'isolated DB: three profiles, concurrent recovery, one paid top-up and saved markup',
  { skip: !process.env.READINESS_DATABASE_URL },
  async () => {
    const url = new URL(process.env.READINESS_DATABASE_URL);
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.port, '54339');
    assert.equal(url.pathname, '/rollout');
    const db = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    try {
      const settings = new SettingsService(db);
      await settings.setMany([
        { key: 'pricing.marginPct', value: 0.35 },
        { key: 'pricing.fxBufferPct', value: 0.03 },
        { key: 'pricing.processorFeePct', value: 0.035 },
        { key: 'pricing.roundTo', value: 0.5 },
      ]);
      const pricing = new PricingService(
        { get: () => 0 },
        {
          snapshot: async () => ({
            rate: 130,
            approved: true,
            confirmedAt: null,
            expiresAt: null,
          }),
        },
        settings,
      );
      const config = {
        get: (k) => ({ CELITECH_MODE: 'mock', LIVE_SALES_ENABLED: 'false' })[k],
      };
      const supplier = new CelitechService(config);
      let writes = 0;
      const buy = supplier.provision.bind(supplier);
      supplier.provision = async (args) => {
        writes++;
        return buy(args);
      };
      const product = {
        id: 'db-plan',
        providerPackageId: 'db-plan',
        supplierDestination: 'USA',
        destIso: 'US',
        title: 'US 5GB',
        dataMb: 5000,
        validityDays: 30,
        minDays: 1,
        unlimited: false,
      };
      const catalog = { getProduct: () => product, getBaseUsd: () => 10 };
      const events = { emit: () => true };
      const service = new OrdersService(
        db,
        catalog,
        pricing,
        supplier,
        { environment: 'test' },
        {},
        config,
      );
      const saga = new ProvisioningService(db, supplier, events, config);
      const user = await db.user.create({
        data: {
          email: randomUUID() + '@example.invalid',
          phone:
            '+2547' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'),
        },
      });
      const startDate = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(0, 10);
      const endDate = new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      const input = {
        productId: product.id,
        startDate,
        endDate,
        quantity: 3,
        phone: user.phone,
        email: user.email,
        userId: user.id,
        compatAttested: true,
        expectedTotal: 43.5,
        idempotencyKey: randomUUID(),
      };
      const [order, duplicate] = await Promise.all([
        service.createOrder(input),
        service.createOrder(input),
      ]);
      assert.equal(order.id, duplicate.id);
      assert.equal(Number(order.totalKes), 43.5);
      assert.equal(Number(order.baseUsd), 10);
      const markPaid = async (o) => {
        await db.payment.create({
          data: {
            orderId: o.id,
            invoiceId: randomUUID(),
            method: 'CARD',
            state: 'COMPLETE',
            amountKes: o.totalKes,
            environment: 'test',
          },
        });
        await db.order.update({
          where: { id: o.id },
          data: { status: 'PAID' },
        });
      };
      await markPaid(order);
      await Promise.all([saga.provision(order.id), saga.provision(order.id)]);
      await saga.provision(order.id);
      const complete = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { esims: true, fulfilments: true, ledgerEntries: true },
      });
      assert.equal(complete.status, 'COMPLETED');
      assert.equal(complete.esims.length, 3);
      assert.equal(writes, 3);
      assert.equal(new Set(complete.esims.map((e) => e.iccid)).size, 3);
      assert.ok(complete.esims.every((e) => e.userId === user.id));
      assert.equal(
        complete.ledgerEntries.filter((e) => e.account === 'cogs').length,
        3,
      );
      assert.ok(complete.fulfilments.every((f) => f.state === 'COMPLETE'));
      const topup = await service.createTopUp({
        esimId: complete.esims[0].id,
        userId: user.id,
        productId: product.id,
        startDate,
        endDate,
        expectedTotal: 14.5,
        idempotencyKey: randomUUID(),
      });
      assert.equal(topup.kind, 'TOPUP');
      assert.equal(topup.quantity, 1);
      assert.equal(Number(topup.totalKes), 14.5);
      await markPaid(topup);
      await saga.provision(topup.id);
      const updated = await db.esim.findUniqueOrThrow({
        where: { id: complete.esims[0].id },
        include: { packages: true },
      });
      assert.equal(updated.packages.length, 2);
      assert.equal(updated.initialBytes, 10000000000n);
      assert.equal(await db.esim.count({ where: { orderId: topup.id } }), 0);
      // A guest's purchase appears after verified-email login, irrespective of case.
      const guest = await service.createOrder({
        ...input,
        userId: undefined,
        quantity: 1,
        expectedTotal: 14.5,
        idempotencyKey: randomUUID(),
      });
      await markPaid(guest);
      await saga.provision(guest.id);
      await db.order.update({
        where: { id: guest.id },
        data: { customerEmail: user.email.toUpperCase() },
      });
      Object.defineProperty(db, 'configured', { value: true });
      const auth = new AuthService(db, config, {}, {});
      await auth.linkAnonymousOrders(user.id, user.email.toLowerCase());
      const claimed = await service.getOrder(guest.id, user.id);
      assert.equal(claimed.userId, user.id);
      assert.ok(claimed.esims.every((e) => e.userId === user.id));
      assert.ok(
        (await service.listForUser(user.id)).some((o) => o.id === guest.id),
      );
      const downloads = new UsageService(db, supplier, events);
      assert.equal(
        (await downloads.getInstallationPdf(claimed.esims[0].id, user.id))
          .subarray(0, 5)
          .toString(),
        '%PDF-',
      );
      await assert.rejects(
        () =>
          downloads.getInstallationPdf(
            claimed.esims[0].id,
            'different-account',
          ),
        (e) => e.getStatus() === 404,
      );
    } finally {
      await db.$disconnect();
    }
  },
);
