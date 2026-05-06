// Server-side proxy from the admin panel to the Supabase edge function.
// Keeps RISK_RECOMPUTE_ADMIN_TOKEN off the client.
//
// Required env (server only):
//   NEXT_PUBLIC_SUPABASE_URL                (already set)
//   RISK_RECOMPUTE_ADMIN_TOKEN              (set on Vercel)
//
// You should also gate this route on admin auth in middleware.

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const adminToken = process.env.RISK_RECOMPUTE_ADMIN_TOKEN;
   if (!supabaseUrl || !adminToken) {
      return NextResponse.json(
         { ok: false, error: 'risk-recompute is not configured (missing env vars)' },
         { status: 500 }
      );
   }

   const body = await req.json();
   const url = `${supabaseUrl}/functions/v1/risk-score-recompute`;

   const r = await fetch(url, {
      method: 'POST',
      headers: {
         'X-Admin-Token': adminToken,
         'content-type': 'application/json'
      },
      body: JSON.stringify(body)
   });
   const json = await r.json().catch(() => ({ ok: false, error: 'invalid JSON from edge function' }));
   return NextResponse.json(json, { status: r.status });
}
