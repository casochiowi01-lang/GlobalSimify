import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Injectable,
  Post,
  ServiceUnavailableException,
  UseGuards,
  type CanActivate,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AppConfigService } from '../../config/config.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProvisioningService } from '../orders/provisioning.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UsageService } from '../usage/usage.service.js';
import { TaskDispatcher, type WorkKind } from './task-dispatcher.service.js';

/** Authentication is enforced by IAM on the PRIVATE simify-worker service.
 * Public API rejects these routes regardless of headers/JWTs. Never deploy a
 * BACKGROUND_ROLE=worker instance with allUsers/allAuthenticatedUsers access. */
@Injectable()
export class PrivateWorkerGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}
  canActivate() {
    if (
      this.config.get('BACKGROUND_ROLE') !== 'worker' ||
      this.config.get('BACKGROUND_MODE') !== 'cloud-tasks'
    )
      throw new ForbiddenException('Private worker only.');
    return true;
  }
}
class WorkDto {
  @IsIn([
    'provision',
    'reconcile',
    'emails',
    'webhooks',
    'usage-dispatch',
    'usage',
    'expiry',
  ])
  kind!: WorkKind;
  @IsOptional() @IsString() @MaxLength(160) id?: string;
}

@Controller('internal/work')
@UseGuards(PrivateWorkerGuard)
@SkipThrottle()
export class WorkerController {
  constructor(
    private readonly tasks: TaskDispatcher,
    private readonly prisma: PrismaService,
    private readonly saga: ProvisioningService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly usage: UsageService,
  ) {}

  @Get('probe')
  @Header('Cache-Control', 'no-store')
  probe() {
    return { ok: true, workerVersion: 1 };
  }

  @Post('recover')
  @HttpCode(200)
  async recover() {
    const stuck = await this.prisma.order.findMany({
      where: { status: { in: ['PAID', 'PROVISIONING'] } },
      select: { id: true },
      take: 50,
      orderBy: { updatedAt: 'asc' },
    });
    for (const o of stuck) await this.tasks.enqueue('provision', o.id);
    for (const kind of ['reconcile', 'emails', 'webhooks'] as const)
      await this.tasks.enqueue(kind);
    await this.tasks.enqueue('usage-dispatch', undefined, 30);
    await this.tasks.enqueue('expiry', undefined, 360);
    // A successful dispatcher heartbeat gates new payments; never stored by a public route.
    await this.prisma.setting.upsert({
      where: { key: 'worker.lastRecoveryAt' },
      create: { key: 'worker.lastRecoveryAt', value: Date.now() },
      update: { value: Date.now() },
    });
    return { ok: true, dispatchedPaidOrders: stuck.length };
  }

  @Post('run')
  @HttpCode(200)
  async run(@Body() work: WorkDto) {
    if (['provision', 'usage'].includes(work.kind) && !work.id)
      throw new BadRequestException('Work item ID required.');
    switch (work.kind) {
      case 'provision': {
        await this.saga.provision(work.id!);
        // Await delivery inside the request: CPU may stop immediately after HTTP 200.
        await this.notifications.retryEmails(work.id, 5);
        const state = await this.prisma.order.findUnique({
          where: { id: work.id! },
          select: { status: true },
        });
        if (state && ['PAID', 'PROVISIONING'].includes(state.status))
          throw new ServiceUnavailableException(
            'Work is still in progress. Retry later.',
          );
        break;
      }
      case 'reconcile':
        await this.payments.reconcile(10);
        break;
      case 'emails':
        await this.notifications.retryEmails(undefined, 10);
        break;
      case 'webhooks':
        await this.usage.processWebhooks(10);
        break;
      case 'usage-dispatch': {
        const rows = await this.prisma.esim.findMany({
          where: {
            supplierMode: 'live',
            packages: { some: { state: 'COMPLETE' } },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true },
          take: 100,
          orderBy: { usageUpdatedAt: { sort: 'asc', nulls: 'first' } },
        });
        for (const e of rows) await this.tasks.enqueue('usage', e.id, 30);
        break;
      }
      case 'usage':
        await this.usage.refresh(work.id!);
        break;
      case 'expiry':
        await this.usage.checkExpiring();
        break;
    }
    await this.prisma.setting.upsert({
      where: { key: `worker.lastSuccess.${work.kind}` },
      create: { key: `worker.lastSuccess.${work.kind}`, value: Date.now() },
      update: { value: Date.now() },
    });
    return { ok: true };
  }
}
