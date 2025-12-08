/**
 * Server-side API Request Handler (Backend DRY Handler)
 *
 * This is the BACKEND handler used IN API routes to process requests.
 * Handles: authentication via Supabase, validation (via Zod), and standardized responses.
 *
 * DO NOT confuse with /lib/apiHandler.ts (client-side - makes HTTP requests)
 */
import type { NextRequest, NextResponse } from 'next/server';

import type { ZodError } from 'zod';
import { type z, type ZodType } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/apiResponse';
import { setCorsHeaders } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import type { SuccessCode } from '@/types/successCodes';

function handleValidationError(error: unknown, defaultMessage: string): NextResponse {
   if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as ZodError;
      const firstError = zodError.issues[0];
      const errorMessage = firstError ? firstError.message : 'Validation failed';
      return createErrorResponse(ERROR_CODES.VALIDATION_INVALID_FORMAT, errorMessage);
   }
   return createErrorResponse(ERROR_CODES.VALIDATION_INVALID_FORMAT, defaultMessage);
}

function validateRequestData<TSchema extends ZodType>(schema: TSchema, data: unknown): z.infer<TSchema> | NextResponse {
   try {
      return schema.parse(data);
   } catch (error) {
      return handleValidationError(error, 'Invalid request data');
   }
}

/**
 * Get authenticated user ID from Supabase session
 */
async function getAuthenticatedUserId(): Promise<string | null> {
   try {
      const supabase = await createSupabaseServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      return user.id;
   } catch {
      return null;
   }
}

/**
 * Handle API requests with Zod validation
 *
 * @param request - Next.js request object
 * @param handler - Business logic handler function
 * @param options - Configuration options
 *   - schema: Zod schema for request validation
 *   - requireAuth: Whether authentication is required
 *   - successCode: Success code for response
 *   - beforeResponse: Callback to modify response (e.g., set cookies)
 */
export async function handleApiRequest<TSchema extends ZodType = ZodType, TResult = unknown>(
   request: NextRequest,
   handler: (data: z.infer<TSchema>, userId?: string) => Promise<TResult>,
   options: {
      schema?: TSchema;
      requireAuth?: boolean;
      successCode?: SuccessCode;
      beforeResponse?: (response: NextResponse, result: TResult) => void | Promise<void>;
   } = {}
): Promise<NextResponse> {
   try {
      // Get user ID from Supabase auth
      const userId = await getAuthenticatedUserId();

      if (options.requireAuth && !userId) {
         return setCorsHeaders(createErrorResponse(ERROR_CODES.AUTH_UNAUTHORIZED, undefined, 401), request);
      }

      let validatedData: z.infer<TSchema> = {} as z.infer<TSchema>;

      if (options.schema) {
         const rawData = request.method === 'GET' ? Object.fromEntries(new URL(request.url).searchParams.entries()) : await request.json();

         const parseResult = validateRequestData(options.schema, rawData);

         if (parseResult instanceof Response) {
            return setCorsHeaders(parseResult, request);
         }

         validatedData = parseResult;
      }

      const result = await handler(validatedData, userId || undefined);

      const response = createSuccessResponse(options.successCode, result);

      if (options.beforeResponse) {
         await options.beforeResponse(response, result);
      }

      return setCorsHeaders(response, request);
   } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
         const customError = error as { code: string; status?: number };
         return setCorsHeaders(
            createErrorResponse(customError.code as keyof typeof ERROR_CODES, undefined, customError.status || 400),
            request
         );
      }

      console.error('API error:', error);
      return setCorsHeaders(createErrorResponse(ERROR_CODES.SERVER_ERROR, undefined, 500), request);
   }
}

export function createApiError(code: string, status = 400): Error {
   const error = new Error(code) as Error & { code: string; status: number };
   error.code = code;
   error.status = status;
   return error;
}
