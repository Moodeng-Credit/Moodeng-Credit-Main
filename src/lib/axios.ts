import axios from 'axios';

import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';

axios.defaults.withCredentials = true;

let storeRef: { dispatch: (action: unknown) => void } | null = null;

export const setStoreRef = (store: { dispatch: (action: unknown) => void }) => {
   storeRef = store;
};

// Add request interceptor for debugging
axios.interceptors.request.use(
   (config) => {
      return config;
   },
   (error) => {
      console.error('🚀 Axios Request Error:', error);
      return Promise.reject(error);
   }
);

axios.interceptors.response.use(
   (response) => {
      return response;
   },
   (error) => {
      console.error('❌ Axios Response Error:', {
         url: error.config?.url,
         status: error.response?.status,
         statusText: error.response?.statusText,
         message: error.message
      });

      if (error.response?.status === 401) {
         console.log('🔒 401 Unauthorized - Auth state will be handled by middleware/guards');

         clearAuthCookieClient();

         if (storeRef) {
            import('@/store/slices/authSlice')
               .then(({ clearAuth }) => {
                  storeRef?.dispatch(clearAuth());
               })
               .catch((err) => console.error('Failed to clear auth:', err));
         }
      }

      return Promise.reject(error);
   }
);

export default axios;
