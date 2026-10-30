import { Global, Module } from '@nestjs/common';
import { CelitechService } from './celitech.service.js';

@Global()
@Module({
  providers: [CelitechService],
  exports: [CelitechService],
})
export class CelitechModule {}
