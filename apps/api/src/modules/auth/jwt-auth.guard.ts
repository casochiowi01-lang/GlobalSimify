import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenService, type AccessClaims } from './token.service.js';

export interface AuthedRequest extends Request {
  user?: AccessClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    try {
      req.user = await this.tokens.verifyAccess(header.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}

/** Like JwtAuthGuard but never rejects — sets req.user when a valid token is
 * present, otherwise lets the request through as a guest. */
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        req.user = await this.tokens.verifyAccess(header.slice(7));
      } catch {
        /* ignore — treat as guest */
      }
    }
    return true;
  }
}

/** Inject the authenticated user's claims into a controller handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessClaims => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new UnauthorizedException();
    return req.user;
  },
);

/** Optional user id — undefined for guests. Use with OptionalJwtGuard. */
export const OptionalUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user?.sub;
  },
);
