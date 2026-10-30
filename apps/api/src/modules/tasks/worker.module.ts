import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrivateWorkerGuard, WorkerController } from './worker.controller.js';
@Module({
  imports: [OrdersModule, PaymentsModule, UsageModule, NotificationsModule],
  controllers: [WorkerController],
  providers: [PrivateWorkerGuard],
})
export class WorkerModule {}
