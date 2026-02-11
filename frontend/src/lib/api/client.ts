/**
 * API client for TanStack Query.
 * Uses the shared axios instance (interceptors, credentials).
 * Throws on non-2xx so useQuery/useMutation can handle errors.
 */
import axios from '@/lib/axios';
import type { ApiResponse } from '@/types/apiTypes';

const getBaseUrl = () => {
   const url = import.meta.env.VITE_API_URL;
   if (!url || typeof url !== 'string') return '';
   return url.replace(/\/$/, '');
};

export function getApiBaseUrl(): string {
   return getBaseUrl();
}

async function request<T>(
   method: 'get' | 'post' | 'put' | 'delete',
   path: string,
   body?: unknown
): Promise<T> {
   const base = getBaseUrl();
   const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

   const response = await axios.request<ApiResponse<T>>({
      method,
      url,
      data: body
   });

   const data = response.data;
   if (data && typeof data === 'object' && 'success' in data) {
      if (!data.success) {
         const err = data as Extract<ApiResponse<T>, { success: false }>;
         throw new Error(err.error || 'API error');
      }
      const success = data as Extract<ApiResponse<T>, { success: true }>;
      return success.data as T;
   }

   return response.data as T;
}

export const apiClient = {
   get: <T>(path: string) => request<T>('get', path),
   post: <T>(path: string, body?: unknown) => request<T>('post', path, body),
   put: <T>(path: string, body?: unknown) => request<T>('put', path, body),
   delete: <T>(path: string) => request<T>('delete', path)
};
