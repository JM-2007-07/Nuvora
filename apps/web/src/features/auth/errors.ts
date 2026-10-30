import { ApiRequestError } from '@/lib/client-api';

/** Maps an API failure to a key of the `Auth` messages. */
export function authErrorKey(error: unknown): 'errEmailTaken' | 'errCredentials' | 'errValidation' | 'errOffline' | 'errGeneric' {
  if (!(error instanceof ApiRequestError)) return 'errOffline';
  if (error.code === 'EMAIL_TAKEN') return 'errEmailTaken';
  if (error.code === 'INVALID_CREDENTIALS') return 'errCredentials';
  if (error.status === 400) return 'errValidation';
  return error.status >= 500 ? 'errOffline' : 'errGeneric';
}

/** Maps an API failure of the security flows to a key of the `Security` messages. */
export function securityErrorKey(error: unknown): 'errMfaRequired' | 'errMfaInvalid' | 'errResetLink' | 'errRateLimited' | 'errAccountRequired' | 'errCredentials' | 'errValidation' | 'errOffline' | 'errGeneric' {
  if (!(error instanceof ApiRequestError)) return 'errOffline';
  switch (error.code) {
    case 'MFA_REQUIRED':
      return 'errMfaRequired';
    case 'MFA_INVALID':
      return 'errMfaInvalid';
    case 'RESET_LINK_INVALID':
      return 'errResetLink';
    case 'RATE_LIMITED':
      return 'errRateLimited';
    case 'ACCOUNT_REQUIRED':
      return 'errAccountRequired';
    case 'INVALID_CREDENTIALS':
      return 'errCredentials';
  }
  if (error.status === 429) return 'errRateLimited';
  if (error.status === 400) return 'errValidation';
  return error.status >= 500 ? 'errOffline' : 'errGeneric';
}
