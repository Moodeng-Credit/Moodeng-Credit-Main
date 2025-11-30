import { NextResponse } from 'next/server';

import type { ApiErrorResponse, ApiSuccessResponse } from '@/types/apiTypes';
import { ERROR_MESSAGES, type ErrorCode } from '@/types/errorCodes';
import { SUCCESS_MESSAGES, type SuccessCode } from '@/types/successCodes';

export function serialiseUser<T extends { telegramId?: bigint | null; chatId?: bigint | null }>(user: T) {
   return {
      ...user,
      telegramId: user.telegramId ? String(user.telegramId) : null,
      chatId: user.chatId ? String(user.chatId) : null
   };
}

export function createSuccessResponse<T = unknown>(successCode?: SuccessCode, data?: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
   const response: ApiSuccessResponse<T> = {
      success: true,
      ...(successCode && {
         message: SUCCESS_MESSAGES[successCode],
         successCode
      }),
      ...(data && { data })
   };
   return NextResponse.json(response, { status });
}

export function createErrorResponse(errorCode: ErrorCode, error?: string, status = 400, details?: unknown): NextResponse<ApiErrorResponse> {
   const response: ApiErrorResponse = {
      success: false,
      error: error || ERROR_MESSAGES[errorCode],
      errorCode
   };
   if (details !== undefined) {
      response.details = details;
   }
   return NextResponse.json(response, { status });
}

export function isErrorResponse(response: unknown): response is ApiErrorResponse {
   return (
      typeof response === 'object' && response !== null && 'success' in response && response.success === false && 'errorCode' in response
   );
}

export function isSuccessResponse<T = unknown>(response: unknown): response is ApiSuccessResponse<T> {
   return typeof response === 'object' && response !== null && 'success' in response && response.success === true;
}

export function extractErrorMessage(error: unknown): string {
   if (error instanceof Error) {
      return error.message;
   }
   if (typeof error === 'string') {
      return error;
   }
   if (isErrorResponse(error)) {
      return error.error;
   }
   return 'An unknown error occurred';
}
