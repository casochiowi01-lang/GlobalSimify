import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.module.js';

/**
 * WhatsApp messaging via the Meta WhatsApp Cloud API. `mock` logs; `meta` sends.
 * Note: business-initiated messages require an approved message template; the
 * image/text sends below assume an open session or template setup on Meta's side.
 *
 * Best-effort: failures are logged, never thrown.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly config: AppConfigService) {}

  get isMock(): boolean {
    return this.config.get('WHATSAPP_PROVIDER') === 'mock';
  }

  /** Send an image (e.g. an eSIM QR) by public URL, with a caption. */
  async sendImage(
    to: string,
    imageUrl: string,
    caption: string,
  ): Promise<boolean> {
    if (this.isMock) {
      this.logger.debug('Automatic WhatsApp delivery is disabled.');
      return false;
    }
    return this.post(to, {
      type: 'image',
      image: { link: imageUrl, caption },
    });
  }

  async sendText(to: string, body: string): Promise<boolean> {
    if (this.isMock) {
      this.logger.debug('Automatic WhatsApp delivery is disabled.');
      return false;
    }
    return this.post(to, { type: 'text', text: { body } });
  }

  private async post(
    to: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const token = this.config.get('WHATSAPP_TOKEN');
      const phoneId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
      if (!token || !phoneId)
        throw new Error('WHATSAPP_TOKEN/PHONE_NUMBER_ID missing.');
      const version = this.config.get('WHATSAPP_API_VERSION') ?? 'v20.0';
      const res = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to.replace('+', ''),
            ...payload,
          }),
        },
      );
      if (!res.ok) {
        throw new Error('WhatsApp request rejected.');
      }
      return true;
    } catch {
      this.logger.error('WhatsApp delivery failed.');
      return false;
    }
  }
}
