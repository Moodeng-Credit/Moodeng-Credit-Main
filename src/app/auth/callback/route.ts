import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Auth Callback Route Handler
 *
 * This route handles OAuth callbacks and email confirmation links.
 * It exchanges the auth code for a session and redirects the user.
 *
 * Flow:
 * 1. User initiates OAuth login (e.g., Google)
 * 2. After authentication, provider redirects to this callback with a code
 * 3. This handler exchanges the code for a session
 * 4. User is redirected to the app (dashboard or specified next URL)
 */
export async function GET(request: NextRequest) {
   const requestUrl = new URL(request.url);
   const code = requestUrl.searchParams.get('code');
   const next = requestUrl.searchParams.get('next') ?? '/dashboard';
   const error = requestUrl.searchParams.get('error');
   const errorDescription = requestUrl.searchParams.get('error_description');

   // Handle OAuth errors
   if (error) {
      console.error('OAuth error:', error, errorDescription);
      const redirectUrl = new URL('/login', requestUrl.origin);
      redirectUrl.searchParams.set('error', error);
      if (errorDescription) {
         redirectUrl.searchParams.set('error_description', errorDescription);
      }
      return NextResponse.redirect(redirectUrl);
   }

   if (code) {
      const supabase = await createSupabaseServerClient();

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
         console.error('Error exchanging code for session:', exchangeError);
         const redirectUrl = new URL('/login', requestUrl.origin);
         redirectUrl.searchParams.set('error', 'auth_error');
         redirectUrl.searchParams.set('error_description', exchangeError.message);
         return NextResponse.redirect(redirectUrl);
      }

      // URL to redirect to after sign in process completes
      const redirectUrl = new URL(next, requestUrl.origin);
      return NextResponse.redirect(redirectUrl);
   }

   // No code provided - redirect to login
   return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
