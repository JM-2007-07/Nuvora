import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.strictObject({ name: z.string().min(1) }));

  it('returns parsed data for valid input', () => {
    expect(pipe.transform({ name: 'Nuvora' })).toEqual({ name: 'Nuvora' });
  });

  it('rejects invalid input with VALIDATION_FAILED and issue paths', () => {
    try {
      pipe.transform({ name: '' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ path: 'name', code: 'too_small' }],
      });
    }
  });

  it('rejects unknown fields', () => {
    expect(() => pipe.transform({ name: 'ok', extra: true })).toThrow(BadRequestException);
  });
});
