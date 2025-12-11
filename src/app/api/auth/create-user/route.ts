import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

/**
 * Server-side API route to create user profile using secret key
 * The secret key automatically bypasses all RLS policies
 * Modern recommended approach: browser-safe with automatic 401 responses if misused
 */
export async function POST(request: NextRequest) {
   try {
      const body = await request.json();
      const { userId, username, email, isWorldId } = body;

      if (!userId || !username || !email) {
         return NextResponse.json({ error: 'Missing required fields: userId, username, or email' }, { status: 400 });
      }

      // Create Supabase client with secret key
      // Secret keys are modern, browser-safe alternatives to service_role keys
      // They automatically return 401 if used in browser due to User-Agent header check
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
         auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
         }
      });

      // Insert user data - this automatically bypasses RLS because service_role key is used
      const { data, error } = await supabase
         .from('users')
         .insert([
            {
               id: userId,
               username,
               email,
               is_world_id: isWorldId,
               created_at: new Date().toISOString()
            }
         ])
         .select()
         .single();

      if (error) {
         console.error('Database insert error:', error);
         return NextResponse.json({ error: 'Failed to create user profile', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ data, message: 'User profile created successfully' }, { status: 201 });
   } catch (error) {
      console.error('API route error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
   }
}
