import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigService } from '../../config/config.module.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { FxService } from '../pricing/fx.service.js';

export interface DependencyStatus {
  status: 'up' | 'down' | 'not_configured';
  detail?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
  checkoutVersion: number;
  assistantVersion: number;
  deliveryVersion: number;
  env: string;
  dependencies: {
    database: DependencyStatus;
    celitech: DependencyStatus;
    paystack: DependencyStatus;
    checkoutFx: DependencyStatus;
    background: DependencyStatus;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly catalog: CatalogService,
    private readonly fx: FxService,
  ) {}

  /** Liveness: is the process up? Always cheap, never touches dependencies. */
  live(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness: can we actually serve traffic? Probes dependencies. */
  async ready(): Promise<HealthReport> {
    const database: DependencyStatus = !this.prisma.configured
      ? { status: 'not_configured', detail: 'DATABASE_URL not set' }
      : (await this.prisma.ping())
        ? { status: 'up' }
        : { status: 'down' };

    const celitech: DependencyStatus =
      this.config.get('CELITECH_MODE') === 'mock'
        ? { status: 'up', detail: 'mock mode' }
        : this.config.get('CELITECH_CLIENT_ID') &&
            this.config.get('CELITECH_CLIENT_SECRET')
          ? this.catalog.availability.available
            ? {
                status: 'up',
                detail: 'live catalogue loaded; checkout revalidates prices',
              }
            : { status: 'down', detail: 'live catalogue not yet loaded' }
          : {
              status: 'not_configured',
              detail: 'CELITECH_CLIENT_ID/SECRET missing',
            };

    const paystack: DependencyStatus =
      this.config.get('PAYSTACK_MODE') === 'mock'
        ? { status: 'up', detail: 'mock mode' }
        : this.config.get('PAYSTACK_SECRET_KEY')
          ? {
              status: 'up',
              detail: this.config
                .get('PAYSTACK_SECRET_KEY')
                ?.startsWith('sk_live_')
                ? 'live key configured (not a payment probe)'
                : 'test key configured',
            }
          : { status: 'not_configured', detail: 'PAYSTACK_SECRET_KEY missing' };

    let checkoutFx: DependencyStatus = {
      status: 'up',
      detail: 'Sales paused; fresh automatic FX required before live payments',
    };
    if (this.config.get('LIVE_SALES_ENABLED') === 'true') {
      try {
        checkoutFx = (await this.fx.snapshot(true)).approved
          ? { status: 'up', detail: 'Automatic reference rate is fresh' }
          : {
              status: 'down',
              detail:
                'Automatic reference rate missing or stale; new payments blocked',
            };
      } catch {
        checkoutFx = {
          status: 'down',
          detail: 'Unable to verify checkout conversion',
        };
      }
    }
    let background: DependencyStatus = {
      status: 'up',
      detail: 'In-process background mode',
    };
    if (this.config.get('BACKGROUND_MODE') === 'cloud-tasks') {
      background = {
        status: 'up',
        detail: 'Managed Cloud Tasks; request-based CPU',
      };
      if (
        this.config.get('LIVE_SALES_ENABLED') === 'true' &&
        this.config.get('BACKGROUND_ROLE') !== 'worker'
      ) {
        try {
          const rows = await Promise.all(
            [
              'worker.lastRecoveryAt',
              'worker.lastSuccess.reconcile',
              'worker.lastSuccess.emails',
            ].map((key) => this.prisma.setting.findUnique({ where: { key } })),
          );
          if (
            rows.some((row) => {
              const at = Number(row?.value);
              return (
                !Number.isFinite(at) ||
                at > Date.now() ||
                Date.now() - at > 15 * 60000
              );
            })
          )
            background = {
              status: 'down',
              detail:
                'Managed delivery heartbeat is stale; new payments blocked',
            };
        } catch {
          background = {
            status: 'down',
            detail: 'Cannot confirm managed delivery health',
          };
        }
      }
    }
    const deps = { database, celitech, paystack, checkoutFx, background };
    const degraded = Object.values(deps).some((d) => d.status !== 'up');

    return {
      status: degraded ? 'degraded' : 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
      checkoutVersion: 3,
      assistantVersion: 1,
      deliveryVersion: 1,
      env: this.config.get('NODE_ENV'),
      dependencies: deps,
    };
  }
}
