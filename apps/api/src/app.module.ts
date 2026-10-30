import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CelitechModule } from './integrations/celitech/celitech.module.js';
import { PaystackModule } from './integrations/paystack/paystack.module.js';
import { SmsModule } from './integrations/sms/sms.module.js';
import { EmailModule } from './integrations/email/email.module.js';
import { WhatsAppModule } from './integrations/whatsapp/whatsapp.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { AssistantModule } from './modules/assistant/assistant.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { PartnersModule } from './modules/partners/partners.module.js';
import { SupportModule } from './modules/support/support.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { UsageModule } from './modules/usage/usage.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { WorkerModule } from './modules/tasks/worker.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    EventEmitterModule.forRoot(),
    // Managed requests own all work in Cloud Tasks mode; no unawaited cron work.
    ScheduleModule.forRoot({
      cronJobs: process.env.BACKGROUND_MODE !== 'cloud-tasks',
    }),
    TasksModule,
    // Global baseline rate limit (per-route overrides come later).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    SettingsModule,
    CelitechModule,
    PaystackModule,
    SmsModule,
    EmailModule,
    WhatsAppModule,
    PricingModule,
    CatalogModule,
    AssistantModule,
    AuthModule,
    UsersModule,
    PromotionsModule,
    OrdersModule,
    PaymentsModule,
    PartnersModule,
    SupportModule,
    AdminModule,
    NotificationsModule,
    UsageModule,
    HealthModule,
    WorkerModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
