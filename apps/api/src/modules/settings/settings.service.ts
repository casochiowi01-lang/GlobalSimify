import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Runtime key/value settings (audited via updatedAt). Used for operational
 * knobs that ops should change without a deploy — e.g. pricing margins.
 */
@Injectable()
export class SettingsService {
  private cache = new Map<string, unknown>();
  private cachedAt = 0;
  private readonly ttl = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  private async all(): Promise<Map<string, unknown>> {
    if (Date.now() - this.cachedAt < this.ttl) return this.cache;
    try {
      const rows = await this.prisma.setting.findMany();
      this.cache = new Map(rows.map((r) => [r.key, r.value]));
    } catch {
      /* DB unavailable — keep whatever we have */
    }
    // Stamp the cache time even on failure, so a down DB is NOT re-queried on
    // every call. Without this, a caller that reads many settings during boot
    // (e.g. catalogue pricing) hammers the dead DB once per read and stalls.
    this.cachedAt = Date.now();
    return this.cache;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const v = (await this.all()).get(key);
    return typeof v === 'number' ? v : fallback;
  }

  /** Read one coherent pricing snapshot. Checkout must not fall back after a DB error. */
  async getNumbers(
    defaults: Record<string, number>,
    fresh = false,
  ): Promise<Record<string, number>> {
    let values: Map<string, unknown>;
    if (fresh) {
      try {
        const rows = await this.prisma.setting.findMany({
          where: { key: { in: Object.keys(defaults) } },
        });
        values = new Map(rows.map((r) => [r.key, r.value]));
      } catch {
        throw new ServiceUnavailableException(
          'Current pricing could not be verified. Please try again before paying.',
        );
      }
    } else values = await this.all();
    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => {
        const value = values.get(key);
        return [
          key,
          value === undefined
            ? fallback
            : typeof value === 'number'
              ? value
              : NaN,
        ];
      }),
    );
  }

  async list() {
    const rows = await this.prisma.setting.findMany();
    return rows.reduce<Record<string, unknown>>((acc, r) => {
      acc[r.key] = r.value;
      return acc;
    }, {});
  }

  async set(key: string, value: unknown) {
    return (await this.setMany([{ key, value }]))[0];
  }

  async setMany(entries: Array<{ key: string; value: unknown }>) {
    const result = await this.prisma.$transaction(
      entries.map(({ key, value }) =>
        this.prisma.setting.upsert({
          where: { key },
          update: { value: value as Prisma.InputJsonValue },
          create: { key, value: value as Prisma.InputJsonValue },
        }),
      ),
    );
    this.cachedAt = 0;
    return result;
  }
}
