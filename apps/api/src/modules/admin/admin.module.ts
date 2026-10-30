import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { UsersModule } from '../users/users.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [
    AuthModule,
    OrdersModule,
    PaymentsModule,
    UsersModule,
    CatalogModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
