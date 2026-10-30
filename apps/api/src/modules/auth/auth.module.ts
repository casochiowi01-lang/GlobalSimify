import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';
import { JwtAuthGuard, OptionalJwtGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    JwtAuthGuard,
    OptionalJwtGuard,
    RolesGuard,
  ],
  exports: [TokenService, JwtAuthGuard, OptionalJwtGuard, RolesGuard],
})
export class AuthModule {}
