import { ApiRequestError } from '@/lib/client-api';

/** Maps an API failure to a key of the `Auth` messages. */
export function authErrorKey(error: unknown): 'errEmailTaken' | 'errCredentials' | 'errValidation' | 'errOffline' | 'errGeneric' {
  if (!(error instanceof ApiRequestError)) return 'errOffline';
  if (error.code === 'EMAIL_TAKEN') return 'errEmailTaken';
  if (error.code === 'INVALID_CREDENTIALS') return 'errCredentials';
  if (error.status === 400) return 'errValidation';
  return error.status >= 500 ? 'errOffline' : 'errGeneric';
}
