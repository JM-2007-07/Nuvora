import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Validates a request part (body, params, query) against a shared Zod schema.
 * Use strict object schemas (`z.strictObject`) so unknown fields are rejected.
 *
 *   @Body(new ZodValidationPipe(SomeSchema)) body: SomeType
 */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<unknown, z.output<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          code: issue.code,
        })),
      });
    }
    return result.data;
  }
}
