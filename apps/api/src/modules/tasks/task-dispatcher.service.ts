import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { createHash } from 'node:crypto';
import { AppConfigService } from '../../config/config.module.js';

export type WorkKind =
  | 'provision'
  | 'reconcile'
  | 'emails'
  | 'webhooks'
  | 'usage-dispatch'
  | 'usage'
  | 'expiry';
@Injectable()
export class TaskDispatcher {
  private readonly auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  constructor(private readonly config: AppConfigService) {}
  get enabled() {
    return this.config.get('BACKGROUND_MODE') === 'cloud-tasks';
  }

  async enqueue(kind: WorkKind, id?: string, bucketMinutes = 5): Promise<void> {
    if (!this.enabled)
      throw new ServiceUnavailableException(
        'Request-driven workers are not configured.',
      );
    const parent = this.config.get('TASKS_QUEUE_PATH')!;
    const base = this.config.get('WORKER_URL')!.replace(/\/$/, '');
    // Deduplicate concurrent webhook/recovery dispatches, but allow a later recovery
    // window to re-dispatch even after Cloud Tasks retains a deleted task name.
    const key = createHash('sha256')
      .update(
        `${kind}:${id ?? ''}:${Math.floor(Date.now() / (bucketMinutes * 60000))}`,
      )
      .digest('hex');
    const client = await this.auth.getClient();
    try {
      await client.request({
        url: `https://cloudtasks.googleapis.com/v2/${parent}/tasks`,
        method: 'POST',
        timeout: 10000,
        retry: false,
        data: {
          task: {
            name: `${parent}/tasks/${key}`,
            dispatchDeadline: '600s',
            httpRequest: {
              httpMethod: 'POST',
              url: `${base}/api/v1/internal/work/run`,
              headers: { 'Content-Type': 'application/json' },
              oidcToken: {
                serviceAccountEmail: this.config.get('TASKS_INVOKER_EMAIL'),
                audience: base,
              },
              body: Buffer.from(
                JSON.stringify({ kind, ...(id ? { id } : {}) }),
              ).toString('base64'),
            },
          },
        },
      });
    } catch (e) {
      if ((e as { response?: { status?: number } }).response?.status === 409)
        return;
      // PAID rows remain durable even if this dispatch fails; recovery will try again.
      throw new ServiceUnavailableException(
        'Background dispatch pending recovery.',
      );
    }
  }
}
