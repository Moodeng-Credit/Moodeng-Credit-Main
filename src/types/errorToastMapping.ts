import type { ToastConfigKey } from '@/components/ToastSystem/types';

import { ERROR_CODES, type ErrorCode } from '@/types/errorCodes';

export const ERROR_CODE_TO_TOAST: Record<ErrorCode, ToastConfigKey> = {
   // Authentication Errors
   [ERROR_CODES.AUTH_UNAUTHORIZED]: 'unauthorized',
   [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'login_error',
   [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'session_expired',
   [ERROR_CODES.AUTH_TOKEN_INVALID]: 'session_expired',
   [ERROR_CODES.AUTH_INVALID_TOKEN]: 'session_expired',
   [ERROR_CODES.AUTH_USER_NOT_FOUND]: 'login_error',
   [ERROR_CODES.AUTH_SESSION_EXPIRED]: 'session_expired',
   [ERROR_CODES.AUTH_PASSWORD_WEAK]: 'password_weak',

   // World ID Verification Errors
   [ERROR_CODES.WORLDID_ALREADY_USED]: 'worldid_already_used',
   [ERROR_CODES.WORLDID_VERIFICATION_FAILED]: 'verification_failed',
   [ERROR_CODES.WORLDID_INVALID_PROOF]: 'verification_failed',
   [ERROR_CODES.WORLDID_INVALID_LEVEL]: 'verification_failed',
   [ERROR_CODES.WORLDID_CONFIG_MISSING]: 'server_error',
   [ERROR_CODES.WORLDID_REQUIRED]: 'worldid_required',

   // User Errors
   [ERROR_CODES.USER_ALREADY_EXISTS]: 'register_error',
   [ERROR_CODES.USER_NOT_FOUND]: 'login_error',
   [ERROR_CODES.USER_UPDATE_FAILED]: 'user_update_error',
   [ERROR_CODES.USER_INVALID_DATA]: 'user_update_error',

   // Loan Errors
   [ERROR_CODES.LOAN_NOT_FOUND]: 'loan_error',
   [ERROR_CODES.LOAN_CREATE_FAILED]: 'loan_error',
   [ERROR_CODES.LOAN_UPDATE_FAILED]: 'loan_update_error',
   [ERROR_CODES.LOAN_DELETE_FAILED]: 'loan_delete_error',
   [ERROR_CODES.LOAN_LIMIT_REACHED]: 'loan_limit_reached',
   [ERROR_CODES.LOAN_AMOUNT_EXCEEDS_LIMIT]: 'amount_exceeds_limit',
   [ERROR_CODES.LOAN_INVALID_AMOUNT]: 'invalid_amount',
   [ERROR_CODES.LOAN_UNAUTHORIZED]: 'unauthorized',

   // Validation Errors
   [ERROR_CODES.VALIDATION_FAILED]: 'server_error',
   [ERROR_CODES.VALIDATION_MISSING_FIELD]: 'server_error',
   [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'server_error',
   [ERROR_CODES.VALIDATION_PAYLOAD_TOO_LARGE]: 'server_error',

   // Network/Transaction Errors
   [ERROR_CODES.NETWORK_ERROR]: 'network_error',
   [ERROR_CODES.NETWORK_REQUIRED]: 'network_required',
   [ERROR_CODES.TRANSACTION_FAILED]: 'transaction_error',
   [ERROR_CODES.INSUFFICIENT_FUNDS]: 'insufficient_funds',
   [ERROR_CODES.WALLET_MISSING]: 'wallet_missing',

   // Server Errors
   [ERROR_CODES.SERVER_ERROR]: 'server_error',
   [ERROR_CODES.DATABASE_ERROR]: 'server_error',
   [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'server_error',

   // Generic Errors
   [ERROR_CODES.UNKNOWN_ERROR]: 'server_error',
   [ERROR_CODES.BAD_REQUEST]: 'server_error'
};

export function getToastKeyFromErrorCode(errorCode: ErrorCode): ToastConfigKey {
   return ERROR_CODE_TO_TOAST[errorCode] || 'server_error';
}
