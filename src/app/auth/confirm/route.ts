import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Email Confirmation Route Handler
 *
 * This route handles email verification links (token_hash based).
 * Used for:
 * - Email signup confirmation
 * - Password reset email links
 * - Email change confirmations
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  // Create redirect URL without the secret token
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete('token_hash');
  redirectTo.searchParams.delete('type');

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      redirectTo.searchParams.delete('next');
      return NextResponse.redirect(redirectTo);
    }

    console.error('Error verifying OTP:', error);
  }

  // Return the user to an error page with some instructions
  redirectTo.pathname = '/login';
  redirectTo.searchParams.set('error', 'auth_error');
  redirectTo.searchParams.set('error_description', 'Invalid or expired confirmation link');
  return NextResponse.redirect(redirectTo);
}
