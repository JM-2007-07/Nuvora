import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError } from '@nuvora/shared';
import type { Request, Response } from 'express';

/** Body shape our own exceptions use: `new BadRequestException({ code, message, details })`. */
interface CodedErrorBody {
  code: string;
  message?: string;
  details?: { path: string; code: string }[];
}

const DEFAULT_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE',
};

function isCodedErrorBody(body: unknown): body is CodedErrorBody {
  return typeof body === 'object' && body !== null && typeof (body as CodedErrorBody).code === 'string';
}

/**
 * Maps every error to the single API error shape (docs/03-api/api-conventions.md#errors).
 * Unexpected errors become 500 INTERNAL_ERROR with no internal details in the response.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const headerId = request.headers['x-request-id'];
    const requestId = typeof headerId === 'string' && headerId.length <= 100 ? headerId : randomUUID();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: ApiError['error'] = { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (isCodedErrorBody(body)) {
        error = {
          code: body.code,
          message: body.message ?? exception.message,
          ...(body.details ? { details: body.details } : {}),
          requestId,
        };
      } else if (status < 500) {
        error = { code: DEFAULT_CODES[status] ?? 'REQUEST_FAILED', message: exception.message, requestId };
      }
    }

    if (status >= 500) {
      this.logger.error(`[${requestId}] ${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).setHeader('x-request-id', requestId).json({ error } satisfies ApiError);
  }
}
