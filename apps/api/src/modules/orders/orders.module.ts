import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { ProvisioningQueue } from './provisioning.queue.js';
import { ProvisioningService } from './provisioning.service.js';
import { RefundsService } from './refunds.service.js';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    ProvisioningService,
    RefundsService,
    ProvisioningQueue,
  ],
  exports: [
    OrdersService,
    ProvisioningService,
    RefundsService,
    ProvisioningQueue,
  ],
})
export class OrdersModule {}
