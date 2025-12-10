import { type NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

/**
 * Updates the user's session by refreshing auth tokens.
 * This middleware function should be called from the root middleware.ts.
 *
 * IMPORTANT: This function MUST be called for any route that:
 * - Accesses Supabase from Server Components
 * - Is protected by Supabase Auth
 * - Needs access to the user's session
 */
export async function updateSession(request: NextRequest) {
   let supabaseResponse = NextResponse.next({
      request
   });

   const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: {
         getAll() {
            return request.cookies.getAll();
         },
         setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
               request
            });
            cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
         }
      }
   });

   // IMPORTANT: Avoid writing any logic between createServerClient and
   // supabase.auth.getUser(). A simple mistake could make it very hard to debug
   // issues with users being randomly logged out.

   // Refresh the auth token - required for Server Components
   // The getUser() call is essential for refreshing the session
   await supabase.auth.getUser();

   // Optional: Redirect unauthenticated users to login page for protected routes
   // Uncomment and modify the paths as needed for your app
   /*
  const { data: { user } } = await supabase.auth.getUser();
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/') // Allow home page
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  */

   // IMPORTANT: You *must* return the supabaseResponse object as it is.
   // If you're creating a new response object with NextResponse.next() make sure to:
   // 1. Pass the request in it, like so:
   //    const myNewResponse = NextResponse.next({ request })
   // 2. Copy over the cookies, like so:
   //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
   // 3. Change the myNewResponse object to fit your needs, but avoid changing
   //    the cookies!
   // 4. Finally:
   //    return myNewResponse
   // If this is not done, you may be causing the browser and server to go out
   // of sync and terminate the user's session prematurely!

   return supabaseResponse;
}
