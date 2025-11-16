export const SUCCESS_CODES = {
   // Auth Success (2000-2099)
   AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
   AUTH_LOGOUT_SUCCESS: 'AUTH_LOGOUT_SUCCESS',
   AUTH_REGISTER_SUCCESS: 'AUTH_REGISTER_SUCCESS',
   AUTH_UPDATE_SUCCESS: 'AUTH_UPDATE_SUCCESS',
   AUTH_VERIFY_SUCCESS: 'AUTH_VERIFY_SUCCESS',
   PASSWORD_RESET_EMAIL_SENT: 'PASSWORD_RESET_EMAIL_SENT',
   PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',

   // User Success (2100-2199)
   USER_FETCHED: 'USER_FETCHED',
   USER_UPDATED: 'USER_UPDATED',
   USER_PROFILE_FETCHED: 'USER_PROFILE_FETCHED',

   // Loan Success (2200-2299)
   LOAN_CREATED: 'LOAN_CREATED',
   LOAN_UPDATED: 'LOAN_UPDATED',
   LOAN_DELETED: 'LOAN_DELETED',
   LOAN_FETCHED: 'LOAN_FETCHED',
   LOANS_FETCHED: 'LOANS_FETCHED',
   LOAN_HASH_ADDED: 'LOAN_HASH_ADDED',

   // Webhook Success (2300-2399)
   WEBHOOK_PROCESSED: 'WEBHOOK_PROCESSED',

   // Generic Success
   SUCCESS: 'SUCCESS'
} as const;

export type SuccessCode = (typeof SUCCESS_CODES)[keyof typeof SUCCESS_CODES];

export const SUCCESS_MESSAGES: Record<SuccessCode, string> = {
   // Auth
   [SUCCESS_CODES.AUTH_LOGIN_SUCCESS]: 'Login successful',
   [SUCCESS_CODES.AUTH_LOGOUT_SUCCESS]: 'Logout successful',
   [SUCCESS_CODES.AUTH_REGISTER_SUCCESS]: 'Registration successful',
   [SUCCESS_CODES.AUTH_UPDATE_SUCCESS]: 'Account updated successfully',
   [SUCCESS_CODES.AUTH_VERIFY_SUCCESS]: 'Verification successful',
   [SUCCESS_CODES.PASSWORD_RESET_EMAIL_SENT]: 'Password reset email sent',
   [SUCCESS_CODES.PASSWORD_RESET_SUCCESS]: 'Password reset successful',

   // User
   [SUCCESS_CODES.USER_FETCHED]: 'User retrieved successfully',
   [SUCCESS_CODES.USER_UPDATED]: 'User updated successfully',
   [SUCCESS_CODES.USER_PROFILE_FETCHED]: 'Profile retrieved successfully',

   // Loan
   [SUCCESS_CODES.LOAN_CREATED]: 'Loan created successfully',
   [SUCCESS_CODES.LOAN_UPDATED]: 'Loan updated successfully',
   [SUCCESS_CODES.LOAN_DELETED]: 'Loan deleted successfully',
   [SUCCESS_CODES.LOAN_FETCHED]: 'Loan retrieved successfully',
   [SUCCESS_CODES.LOANS_FETCHED]: 'Loans retrieved successfully',
   [SUCCESS_CODES.LOAN_HASH_ADDED]: 'Hash added successfully',

   // Webhook
   [SUCCESS_CODES.WEBHOOK_PROCESSED]: 'Webhook processed successfully',

   // Generic
   [SUCCESS_CODES.SUCCESS]: 'Operation successful'
};
