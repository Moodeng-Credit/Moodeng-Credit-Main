/**
 * Client-side API handler
 * Handles all HTTP requests from the frontend using axios
 * Manages toast notifications and response unwrapping
 */
import type { AxiosError, AxiosResponse } from 'axios';
import axios from 'axios';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { type ToastConfigKey, type ToastErrorType, type ToastSuccessType } from '@/components/ToastSystem/types';

import { type ApiData, type ApiResponse } from '@/types/apiTypes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import { type SuccessCode } from '@/types/successCodes';
import { getToastKeyFromSuccessCode } from '@/types/successToastMapping';

interface ApiConfig {
   errorToast?: ToastErrorType;
   successToast?: ToastSuccessType;
   toastData?: Record<string, unknown>;
   [key: string]: unknown;
}

// Create a singleton instance of useToast for non-component usage
let toastInstance: ReturnType<typeof useToast> | null = null;
export const setToastInstance = (instance: ReturnType<typeof useToast>) => {
   toastInstance = instance;
};

const handleError = (error: AxiosError, customConfig: ApiConfig = {}) => {
   const apiResponse = error?.response?.data as ApiResponse | undefined;

   if (apiResponse && !apiResponse.success && 'errorCode' in apiResponse) {
      const toastKey = getToastKeyFromErrorCode(apiResponse.errorCode);

      if (customConfig.errorToast) {
         toastInstance?.showToastByConfig(customConfig.errorToast, { error: apiResponse.error });
      } else {
         toastInstance?.showToastByConfig(toastKey);
      }
   } else {
      toastInstance?.showToastByConfig('network_error');
   }

   return Promise.reject(error);
};

const handleSuccess = (response: AxiosResponse, customConfig: ApiConfig = {}) => {
   const apiResponse = response.data as ApiResponse | undefined;

   if (apiResponse && apiResponse.success && 'successCode' in apiResponse && apiResponse.successCode) {
      const toastKey = getToastKeyFromSuccessCode(apiResponse.successCode as SuccessCode);

      if (customConfig.successToast) {
         toastInstance?.showToastByConfig(customConfig.successToast, customConfig.toastData);
      } else if (toastKey) {
         toastInstance?.showToastByConfig(toastKey, response.data);
      }
   }

   if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
      return response.data.data;
   }

   return response.data;
};

const makeRequest = async (method: string, url: string, data: ApiData = {}, config: ApiConfig = {}) => {
   try {
      const response = await axios[method as 'get' | 'post' | 'put' | 'delete'](
         url,
         ...(method === 'get' || method === 'delete' ? [config] : [data, config])
      );
      return handleSuccess(response, config);
   } catch (error: unknown) {
      return handleError(error as AxiosError, config);
   }
};

export const apiHandler = {
   get: (url: string, config: ApiConfig = {}) => makeRequest('get', url, undefined, config),
   post: (url: string, data: ApiData = {}, config: ApiConfig = {}) => makeRequest('post', url, data, config),
   put: (url: string, data: ApiData = {}, config: ApiConfig = {}) => makeRequest('put', url, data, config),
   delete: (url: string, config: ApiConfig = {}) => makeRequest('delete', url, undefined, config)
};

// Hook to initialize toast instance
export const useApiToast = () => {
   const toast = useToast();
   setToastInstance(toast);
   return toast;
};

/**
 * Handle API error response and return the appropriate toast key
 * Maps backend error codes to frontend toast configs
 *
 * @example
 * const result = await res.json() as ApiResponse;
 * if (!res.ok && !result.success) {
 *   const toastKey = handleApiError(result);
 *   showToastByConfig(toastKey);
 * }
 */
export function handleApiError(response: ApiResponse): ToastConfigKey {
   if (!response.success) {
      return getToastKeyFromErrorCode(response.errorCode);
   }
   return 'server_error';
}

export function isApiError(response: ApiResponse): response is Extract<ApiResponse, { success: false }> {
   return !response.success;
}
