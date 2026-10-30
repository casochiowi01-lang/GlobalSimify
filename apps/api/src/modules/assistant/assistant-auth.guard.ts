import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../auth/token.service.js';
import type { AuthedRequest } from '../auth/jwt-auth.guard.js';

/** Guests may browse; expired supplied tokens trigger refresh rather than silently becoming guests. */
@Injectable()
export class AssistantAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.headers.authorization) return true;
    if (!req.headers.authorization.startsWith('Bearer '))
      throw new UnauthorizedException();
    try {
      req.user = await this.tokens.verifyAccess(
        req.headers.authorization.slice(7),
      );
      return true;
    } catch {
      throw new UnauthorizedException('Please sign in again.');
    }
  }
}
