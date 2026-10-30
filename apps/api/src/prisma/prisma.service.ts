import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/config.module.js';

/**
 * Wraps PrismaClient. Designed to boot in a degraded mode: if no DATABASE_URL
 * is configured (early development), the app still starts and /health reports
 * the database as "not configured" instead of crashing.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  private _connected = false;

  constructor(private readonly config: AppConfigService) {
    super();
  }

  get connected(): boolean {
    return this._connected;
  }

  get configured(): boolean {
    return Boolean(this.config.get('DATABASE_URL'));
  }

  async onModuleInit(): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        'DATABASE_URL not set — running without a database (degraded mode).',
      );
      return;
    }
    try {
      await this.$connect();
      this._connected = true;
      this.logger.log('Database connected.');
    } catch (err) {
      this._connected = false;
      this.logger.error(
        `Database connection failed: ${(err as Error).message}`,
      );
    }
  }

  async ping(): Promise<boolean> {
    if (!this.configured) return false;
    try {
      await this.$queryRaw`SELECT 1`;
      this._connected = true;
      return true;
    } catch {
      this._connected = false;
      return false;
    }
  }
}
