import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { CatalogModule } from '../catalog/catalog.module.js';

@Module({
  imports: [CatalogModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
