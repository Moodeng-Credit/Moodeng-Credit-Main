import { type ToastConfig } from '@/components/ToastSystem/types';

interface ApiEndpoints {
   AUTH: {
      REGISTER: string;
      LOGIN: string;
      LOGOUT: string;
      UPDATE: string;
      VERIFY: string;
      GOOGLE: string;
      ME: string;
      PROFILE: string;
   };
   USERS: {
      UPDATE: string;
   };
   LOANS: {
      CREATE: string;
      EDIT: string;
      UPDATE: string;
      GET: string;
      FETCH: string;
      DELETE: string;
      HASH: string;
   };
   EXTERNAL: {
      WORLDID: {
         BASE_URL: string;
      };
   };
}

export const API_ENDPOINTS: ApiEndpoints = {
   AUTH: {
      REGISTER: '/api/auth/register',
      LOGIN: '/api/auth/login',
      LOGOUT: '/api/auth/logout',
      UPDATE: '/api/auth/update',
      VERIFY: '/api/auth/verify',
      GOOGLE: '/api/auth/google',
      ME: '/api/users/me',
      PROFILE: '/api/users/profile'
   },
   USERS: {
      UPDATE: '/api/users/update'
   },
   LOANS: {
      CREATE: '/api/loans/create',
      EDIT: '/api/loans/edit',
      UPDATE: '/api/loans/update',
      GET: '/api/loans/get',
      FETCH: '/api/loans/fetch',
      DELETE: '/api/loans/delete',
      HASH: '/api/loans/hash'
   },
   EXTERNAL: {
      WORLDID: {
         BASE_URL: 'https://api.worldid.com'
      }
   }
};

export const ENDPOINT_TOAST_CONFIG: Record<string, ToastConfig> = {
   [API_ENDPOINTS.AUTH.REGISTER]: {
      success: 'profile_updated',
      error: 'register_error'
   },
   [API_ENDPOINTS.AUTH.LOGIN]: {
      success: null,
      error: 'login_error'
   },
   [API_ENDPOINTS.AUTH.UPDATE]: {
      success: 'user_update_success',
      error: 'user_update_error'
   },
   [API_ENDPOINTS.USERS.UPDATE]: {
      success: 'user_update_success',
      error: 'user_update_error'
   },
   [API_ENDPOINTS.AUTH.LOGOUT]: {
      success: null,
      error: 'server_error'
   },
   [API_ENDPOINTS.LOANS.CREATE]: {
      success: 'loan_created',
      error: 'loan_error'
   },
   [API_ENDPOINTS.LOANS.EDIT]: {
      success: 'loan_edit_success',
      error: 'loan_edit_error'
   },
   [API_ENDPOINTS.LOANS.UPDATE]: {
      success: 'loan_update_success',
      error: 'loan_update_error'
   },
   [API_ENDPOINTS.LOANS.DELETE]: {
      success: 'loan_delete_success',
      error: 'loan_delete_error'
   },
   [API_ENDPOINTS.EXTERNAL.WORLDID.BASE_URL]: {
      success: 'verification_success',
      error: 'verification_failed'
   }
};
