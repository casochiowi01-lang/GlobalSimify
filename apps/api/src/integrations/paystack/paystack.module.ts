import { Global, Module } from '@nestjs/common';
import { PaystackService } from './paystack.service.js';

@Global()
@Module({
  providers: [PaystackService],
  exports: [PaystackService],
})
export class PaystackModule {}
