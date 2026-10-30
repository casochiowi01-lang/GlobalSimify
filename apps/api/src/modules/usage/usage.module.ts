import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';
import { UsageScheduler } from './usage.scheduler.js';
import { CelitechWebhookController } from './celitech-webhook.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [UsageController, CelitechWebhookController],
  providers: [UsageService, UsageScheduler],
  exports: [UsageService],
})
export class UsageModule {}
