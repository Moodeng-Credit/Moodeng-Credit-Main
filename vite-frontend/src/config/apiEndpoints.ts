import { type ToastConfig } from '@/components/ToastSystem/types';

interface ApiEndpoints {
   AUTH: {
      REGISTER: string;
      LOGIN: string;
      LOGOUT: string;
      UPDATE: string;
      VERIFY: string;
      ME: string;
      PROFILE: string;
   };
   USERS: {
      UPDATE: string;
   };
   LOANS: {
      CREATE: string;
      UPDATE: string;
      GET: string;
      FETCH: string;
      DELETE: string;
   };
   EXTERNAL: {
      WORLDID: {
         BASE_URL: string;
      };
   };
}

export const API_ENDPOINTS: ApiEndpoints = {
   AUTH: {
      REGISTER: `${import.meta.env.VITE_API_URL}/auth/register`,
      LOGIN: `${import.meta.env.VITE_API_URL}/auth/login`,
      LOGOUT: `${import.meta.env.VITE_API_URL}/auth/logout`,
      UPDATE: `${import.meta.env.VITE_API_URL}/auth/update`,
      VERIFY: `${import.meta.env.VITE_API_URL}/verify-worldid`,
      ME: `${import.meta.env.VITE_API_URL}/users/me`,
      PROFILE: `${import.meta.env.VITE_API_URL}/users/profile`
   },
   USERS: {
      UPDATE: `${import.meta.env.VITE_API_URL}/users/update`
   },
   LOANS: {
      CREATE: `${import.meta.env.VITE_API_URL}/loans/create`,
      UPDATE: `${import.meta.env.VITE_API_URL}/loans/update`,
      GET: `${import.meta.env.VITE_API_URL}/loans/get`,
      FETCH: `${import.meta.env.VITE_API_URL}/loans/fetch`,
      DELETE: `${import.meta.env.VITE_API_URL}/loans/delete`
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
