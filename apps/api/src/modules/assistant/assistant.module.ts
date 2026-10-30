import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { AssistantToolsService } from './assistant-tools.service.js';
import { AssistantAuthGuard } from './assistant-auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { UsageModule } from '../usage/usage.module.js';

@Module({
  imports: [CatalogModule, AuthModule, PaymentsModule, UsageModule],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantToolsService, AssistantAuthGuard],
})
export class AssistantModule {}
