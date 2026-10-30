import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppConfigService } from '../../config/config.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProvisioningService } from './provisioning.service.js';
import { TaskDispatcher } from '../tasks/task-dispatcher.service.js';

const QUEUE_NAME = 'provisioning';
const JOB_NAME = 'provision';

interface ProvisionJobData {
  orderId: string;
}

/**
 * Translate a REDIS_URL into BullMQ connection options. We pass options (not a
 * shared ioredis instance) so BullMQ creates its own connections with its
 * bundled ioredis — this avoids the dual-ioredis type clash and gives the queue
 * and worker independent connections (workers issue blocking commands).
 */
function buildConnection(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    tls: u.protocol === 'rediss:' ? {} : undefined,
    // Required by BullMQ for its blocking connections.
    maxRetriesPerRequest: null,
  };
}

/**
 * Crash-safe entry point for the provisioning saga.
 *
 * When REDIS_URL is configured we push provisioning work onto a BullMQ queue
 * and a worker drains it — so a process restart (or crash) mid-provision does
 * NOT lose a paid-but-unprovisioned order: the job is persisted in Redis and
 * retried, and on boot we re-enqueue any orders left in PAID/PROVISIONING.
 *
 * Without Redis, immediate dispatch runs in-process and a recurring database
 * sweep recovers paid work. Fulfilment rows persist each claimed supplier call;
 * uncertain calls are reconciled by reference, never blindly purchased again.
 * Production recovery requires an always-running worker/instance.
 */
@Injectable()
export class ProvisioningQueue
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ProvisioningQueue.name);
  private queue?: Queue;
  private worker?: Worker;
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly saga: ProvisioningService,
    private readonly tasks?: TaskDispatcher,
  ) {}

  /** True when a real Redis-backed queue is active (vs. in-process fallback). */
  get enabled(): boolean {
    return Boolean(this.queue);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('BACKGROUND_MODE') === 'cloud-tasks') {
      this.logger.log('Provisioning uses managed request-driven Cloud Tasks.');
      return;
    }
    const url = this.config.get('REDIS_URL');
    if (!url) {
      this.logger.warn(
        'Redis is absent: database-backed recovery is enabled. Background CPU is required for scheduled recovery.',
      );
      return;
    }

    // Passing options (not an instance) makes BullMQ create a separate
    // connection per Queue/Worker — exactly what we want.
    const connection = buildConnection(url);
    this.queue = new Queue(QUEUE_NAME, { connection });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        const { orderId } = job.data as ProvisionJobData;
        await this.saga.provision(orderId);
      },
      { connection, concurrency: 5 },
    );
    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      const orderId = (job?.data as ProvisionJobData | undefined)?.orderId;
      this.logger.error(
        `Provision job ${job?.id ?? '?'} (order ${orderId ?? '?'}) ` +
          `failed: ${err.message}`,
      );
    });
    this.worker.on('error', (err: Error) => {
      this.logger.error(`Provisioning worker error: ${err.message}`);
    });
    this.logger.log(
      'BullMQ provisioning worker started (durable, crash-safe).',
    );

    await this.recoverStuckOrders();
  }

  /**
   * Schedule provisioning for a paid order. With Redis this returns as soon as
   * the job is persisted (the worker provisions asynchronously); without Redis
   * it dispatches bounded background work after PAID has been persisted. The
   * database recovery scan is the durable queue; webhook responses do not wait
   * for the supplier to finish provisioning.
   */
  async enqueue(orderId: string): Promise<void> {
    if (this.config.get('BACKGROUND_MODE') === 'cloud-tasks') {
      if (!this.tasks)
        throw new Error('Cloud Tasks dispatcher is unavailable.');
      await this.tasks.enqueue('provision', orderId);
      return;
    }
    if (!this.queue) {
      if (this.inFlight.has(orderId) || this.inFlight.size >= 2) return;
      const work = Promise.resolve()
        .then(() => this.saga.provision(orderId))
        .catch(() =>
          this.logger.warn(
            'Paid order ' + orderId + ' remains queued for recovery.',
          ),
        )
        .finally(() => this.inFlight.delete(orderId));
      this.inFlight.set(orderId, work);
      return;
    }
    const previous = await this.queue.getJob(orderId);
    if (previous && (await previous.getState()) === 'failed') {
      await previous.retry();
      return;
    }
    await this.queue.add(JOB_NAME, { orderId } satisfies ProvisionJobData, {
      // One job per order: a duplicate enqueue (retry, recovery sweep) is a
      // no-op while a job with this id is still around.
      jobId: orderId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 200,
    });
  }

  /**
   * On boot, re-enqueue orders that were mid-flight when the process last
   * stopped (status PAID or PROVISIONING). provision() is idempotent, so this
   * is safe even if the original job actually completed.
   */
  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async recoverStuckOrders(): Promise<void> {
    if (!this.prisma.configured) return;
    try {
      const stuck = await this.prisma.order.findMany({
        where: { status: { in: ['PAID', 'PROVISIONING'] } },
        select: { id: true },
        take: 100,
        orderBy: { updatedAt: 'asc' },
      });
      for (const o of stuck) {
        await this.enqueue(o.id);
      }
      if (stuck.length) {
        this.logger.log(
          `Recovered ${stuck.length} stuck order(s) into the provisioning queue.`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Stuck-order recovery failed: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Closing the worker/queue also closes the connections BullMQ created.
    await this.worker?.close();
    await this.queue?.close();
    await Promise.allSettled(this.inFlight.values());
  }
}
