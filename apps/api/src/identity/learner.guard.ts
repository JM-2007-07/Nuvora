import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { IdentityService, type LearnerRecord } from './identity.service.js';
import { readCredential, SESSION_COOKIE } from './session-cookie.js';

const learners = new WeakMap<Request, LearnerRecord>();

/**
 * Resolves the current learner from the signed session cookie only (never from
 * client input, FR-AUTH-02). Without a valid session: 401 UNAUTHENTICATED.
 */
@Injectable()
export class LearnerGuard implements CanActivate {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const learner = await this.identity.learnerFromCookie(readCredential(request.headers, SESSION_COOKIE));
    if (!learner) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Choose a demo learner or continue as a guest' });
    learners.set(request, learner);
    return true;
  }
}

/** Handler parameter: the learner resolved by LearnerGuard. */
export const CurrentLearner = createParamDecorator((_data: unknown, context: ExecutionContext): LearnerRecord => {
  const learner = learners.get(context.switchToHttp().getRequest<Request>());
  if (!learner) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'No learner session' });
  return learner;
});
