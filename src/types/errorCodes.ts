export const ERROR_CODES = {
   // Authentication Errors (1000-1099)
   AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
   AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
   AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
   AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
   AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
   AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
   AUTH_PASSWORD_WEAK: 'AUTH_PASSWORD_WEAK',

   // World ID Verification Errors (1100-1199)
   WORLDID_ALREADY_USED: 'WORLDID_ALREADY_USED',
   WORLDID_VERIFICATION_FAILED: 'WORLDID_VERIFICATION_FAILED',
   WORLDID_INVALID_PROOF: 'WORLDID_INVALID_PROOF',
   WORLDID_INVALID_LEVEL: 'WORLDID_INVALID_LEVEL',
   WORLDID_CONFIG_MISSING: 'WORLDID_CONFIG_MISSING',
   WORLDID_REQUIRED: 'WORLDID_REQUIRED',

   // User Errors (1200-1299)
   USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
   USER_NOT_FOUND: 'USER_NOT_FOUND',
   USER_UPDATE_FAILED: 'USER_UPDATE_FAILED',
   USER_INVALID_DATA: 'USER_INVALID_DATA',

   // Loan Errors (1300-1399)
   LOAN_NOT_FOUND: 'LOAN_NOT_FOUND',
   LOAN_CREATE_FAILED: 'LOAN_CREATE_FAILED',
   LOAN_UPDATE_FAILED: 'LOAN_UPDATE_FAILED',
   LOAN_DELETE_FAILED: 'LOAN_DELETE_FAILED',
   LOAN_LIMIT_REACHED: 'LOAN_LIMIT_REACHED',
   LOAN_AMOUNT_EXCEEDS_LIMIT: 'LOAN_AMOUNT_EXCEEDS_LIMIT',
   LOAN_INVALID_AMOUNT: 'LOAN_INVALID_AMOUNT',
   LOAN_UNAUTHORIZED: 'LOAN_UNAUTHORIZED',

   // Validation Errors (1400-1499)
   VALIDATION_FAILED: 'VALIDATION_FAILED',
   VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
   VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
   VALIDATION_PAYLOAD_TOO_LARGE: 'VALIDATION_PAYLOAD_TOO_LARGE',

   // Network/Transaction Errors (1500-1599)
   NETWORK_ERROR: 'NETWORK_ERROR',
   NETWORK_REQUIRED: 'NETWORK_REQUIRED',
   TRANSACTION_FAILED: 'TRANSACTION_FAILED',
   INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',

   // Server Errors (1600-1699)
   SERVER_ERROR: 'SERVER_ERROR',
   DATABASE_ERROR: 'DATABASE_ERROR',
   EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

   // Generic Errors
   UNKNOWN_ERROR: 'UNKNOWN_ERROR',
   BAD_REQUEST: 'BAD_REQUEST'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
   // Authentication
   [ERROR_CODES.AUTH_UNAUTHORIZED]: 'You are not authorized. Please log in.',
   [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Invalid Username or Password. Please try again.',
   [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
   [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Invalid authentication token.',
   [ERROR_CODES.AUTH_USER_NOT_FOUND]: 'User not found.',
   [ERROR_CODES.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
   [ERROR_CODES.AUTH_PASSWORD_WEAK]: 'Password does not meet strength requirements.',

   // World ID
   [ERROR_CODES.WORLDID_ALREADY_USED]: 'This World ID verification has already been used by another account.',
   [ERROR_CODES.WORLDID_VERIFICATION_FAILED]: 'World ID verification failed. Please try again.',
   [ERROR_CODES.WORLDID_INVALID_PROOF]: 'Invalid World ID proof.',
   [ERROR_CODES.WORLDID_INVALID_LEVEL]: 'Invalid World ID verification level.',
   [ERROR_CODES.WORLDID_CONFIG_MISSING]: 'World ID configuration is missing.',
   [ERROR_CODES.WORLDID_REQUIRED]: 'World ID verification is required.',

   // User
   [ERROR_CODES.USER_ALREADY_EXISTS]: 'Registration failed. Please try again.',
   [ERROR_CODES.USER_NOT_FOUND]: 'User not found.',
   [ERROR_CODES.USER_UPDATE_FAILED]: 'Failed to update user information.',
   [ERROR_CODES.USER_INVALID_DATA]: 'Invalid user data.',

   // Loan
   [ERROR_CODES.LOAN_NOT_FOUND]: 'Loan not found.',
   [ERROR_CODES.LOAN_CREATE_FAILED]: 'Failed to create loan.',
   [ERROR_CODES.LOAN_UPDATE_FAILED]: 'Failed to update loan.',
   [ERROR_CODES.LOAN_DELETE_FAILED]: 'Failed to delete loan.',
   [ERROR_CODES.LOAN_LIMIT_REACHED]: 'You have reached your maximum number of active loans.',
   [ERROR_CODES.LOAN_AMOUNT_EXCEEDS_LIMIT]: 'The loan amount exceeds your credit score limit.',
   [ERROR_CODES.LOAN_INVALID_AMOUNT]: 'Please enter a valid loan amount greater than 0.',
   [ERROR_CODES.LOAN_UNAUTHORIZED]: 'You are not authorized to perform this action on this loan.',

   // Validation
   [ERROR_CODES.VALIDATION_FAILED]: 'Validation failed.',
   [ERROR_CODES.VALIDATION_MISSING_FIELD]: 'Required field is missing.',
   [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Invalid format.',
   [ERROR_CODES.VALIDATION_PAYLOAD_TOO_LARGE]: 'Request payload too large.',

   // Network
   [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection.',
   [ERROR_CODES.NETWORK_REQUIRED]: 'Please select a network and coin type.',
   [ERROR_CODES.TRANSACTION_FAILED]: 'Transaction failed. Please try again.',
   [ERROR_CODES.INSUFFICIENT_FUNDS]: 'Insufficient funds for this transaction.',

   // Server
   [ERROR_CODES.SERVER_ERROR]: 'Internal server error. Please try again later.',
   [ERROR_CODES.DATABASE_ERROR]: 'Database error. Please try again later.',
   [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service error. Please try again later.',

   // Generic
   [ERROR_CODES.UNKNOWN_ERROR]: 'An unknown error occurred.',
   [ERROR_CODES.BAD_REQUEST]: 'Bad request.'
};
