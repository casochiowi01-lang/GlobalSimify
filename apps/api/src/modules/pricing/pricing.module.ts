import { Global, Module } from '@nestjs/common';
import { FxService } from './fx.service.js';
import { PricingService } from './pricing.service.js';

@Global()
@Module({
  providers: [FxService, PricingService],
  exports: [FxService, PricingService],
})
export class PricingModule {}
