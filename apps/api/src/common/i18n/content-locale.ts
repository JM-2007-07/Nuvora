import {
  type CallHandler,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Locale } from '@nuvora/shared';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { resolveLocale } from './locale.js';

/** Handler parameter: the content locale resolved from Accept-Language. */
export const ContentLocale = createParamDecorator((_data: unknown, context: ExecutionContext): Locale =>
  resolveLocale(context.switchToHttp().getRequest<Request>().headers['accept-language']),
);

/**
 * Sets `Content-Language` (the resolved locale) and `Vary: Accept-Language`
 * on every response of a localized controller (api-conventions.md).
 */
@Injectable()
export class ContentLanguageInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const locale = resolveLocale(http.getRequest<Request>().headers['accept-language']);
    http.getResponse<Response>().setHeader('Content-Language', locale).vary('Accept-Language');
    return next.handle();
  }
}
