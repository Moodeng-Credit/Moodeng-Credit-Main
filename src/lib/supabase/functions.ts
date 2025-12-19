import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Invoke a Supabase Edge Function
 * @param functionName - The name of the Edge Function to invoke
 * @param body - The request body to send
 * @param options - Additional options (headers, etc.)
 */
export async function invokeEdgeFunction<T = unknown>(
   functionName: string,
   body?: Record<string, unknown>,
   options?: { requireAuth?: boolean }
): Promise<{ data: T | null; error: string | null }> {
   try {
      const headers: Record<string, string> = {
         'Content-Type': 'application/json'
      };

      // Add auth token if required
      if (options?.requireAuth) {
         const supabase = getSupabaseBrowserClient();
         const {
            data: { session }
         } = await supabase.auth.getSession();

         if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
         }
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
         method: 'POST',
         headers,
         body: body ? JSON.stringify(body) : undefined
      });

      const data = await response.json();

      if (!response.ok) {
         return { data: null, error: data.error || 'Function call failed' };
      }

      return { data, error: null };
   } catch (error) {
      return { data: null, error: (error as Error).message };
   }
}

// Typed function helpers for specific edge functions
export const edgeFunctions = {
   createUser: (body: { userId: string; username: string; email: string; isWorldId?: string }) =>
      invokeEdgeFunction('create-user', body),

   forgotPassword: (body: { email: string }) => invokeEdgeFunction('forgot-password', body),

   resetPassword: (body: { token: string; password: string }) => invokeEdgeFunction('reset-password', body),

   verify: (proof: Record<string, unknown>) => invokeEdgeFunction('verify', proof, { requireAuth: true }),

   testUnverify: () => invokeEdgeFunction('test-unverify', undefined, { requireAuth: true })
};
