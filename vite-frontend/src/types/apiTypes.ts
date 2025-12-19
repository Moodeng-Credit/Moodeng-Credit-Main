/**
 * Shared API Types (Used by BOTH Client and Server)
 *
 * Defines the standard API response format used throughout the application.
 * These types are used by:
 * - Frontend: lib/apiHandler.ts (client-side requests)
 * - Backend: lib/utils/apiRequestHandler.ts (server-side handlers)
 */
import { type IUser } from '@/types/authTypes';
import { type ErrorCode } from '@/types/errorCodes';
import { type ILoan } from '@/types/loanTypes';

export interface ApiData {
   [key: string]: ILoan | IUser | unknown;
}

export interface ApiSuccessResponse<T = unknown> {
   success: true;
   message?: string;
   successCode?: string;
   data?: T;
}

export interface ApiErrorResponse {
   success: false;
   error: string;
   errorCode: ErrorCode;
   details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
