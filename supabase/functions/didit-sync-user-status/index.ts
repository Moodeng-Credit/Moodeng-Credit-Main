import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkCronAuth } from '../_shared/cronAuth.ts';

// Mirrors a Moodeng ban onto the user's Didit profile, so a banned borrower is also BLOCKED in
// Didit (and Didit auto-declines any new KYC session they start), and an unban sets them back
// to ACTIVE.
//
// Called by the `sync_didit_user_status` trigger on public.users whenever account_status moves
// into or out of 'banned' — which covers every ban path at once: the admin panel
// (admin_set_account_status / admin_account_restrictions), admin-refund-loan, and manual SQL.
//
// The caller only names the user. The status pushed to Didit is read from the database, never
// taken from the request, so a stray or hostile call can only ever re-sync Didit to the truth.
//
// Didit endpoint: PATCH {DIDIT_API_BASE}/users/{vendor_data}/update-status/ with
// { status: 'BLOCKED' | 'ACTIVE', reason }. vendor_data is our user id (see create-didit-session).
// A 404 means the user never started a Didit session, so there's nothing to block.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

   const auth = checkCronAuth(req, Deno.env.get('ADMIN_API_TOKEN'), corsHeaders);
   if (!auth.ok) return auth.response;

   const body = (await req.json().catch(() => null)) as { user_id?: string } | null;
   const userId = body?.user_id?.trim();
   if (!userId || !UUID_RE.test(userId)) return jsonResponse({ error: 'user_id required' }, 400);

   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) return jsonResponse({ error: 'DIDIT_API_KEY not configured' }, 500);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: user, error: userError } = await supabase.from('users').select('id, account_status').eq('id', userId).maybeSingle();
   if (userError) return jsonResponse({ error: userError.message }, 500);
   if (!user) return jsonResponse({ error: 'User not found' }, 404);

   const { data: restriction } = await supabase
      .from('admin_account_restrictions')
      .select('admin_note, reason')
      .eq('user_id', userId)
      .maybeSingle();

   const banned = user.account_status === 'banned';
   const status = banned ? 'BLOCKED' : 'ACTIVE';
   const reason = banned
      ? `Banned on Moodeng${restriction?.admin_note ? `: ${restriction.admin_note}` : restriction?.reason ? ` (${restriction.reason})` : ''}`.slice(0, 500)
      : 'Unbanned on Moodeng';

   const apiBase = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');
   const res = await fetch(`${apiBase}/users/${encodeURIComponent(userId)}/update-status/`, {
      method: 'PATCH',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ status, reason })
   });
   const diditBody = await res.json().catch(() => null);

   if (res.status === 404) {
      console.log(`[didit-sync-user-status] ${userId} has no Didit profile — nothing to ${status}`);
      return jsonResponse({ synced: false, status, reason: 'NO_DIDIT_USER' });
   }
   if (!res.ok) {
      console.error('[didit-sync-user-status] Didit update failed:', res.status, diditBody);
      return jsonResponse({ synced: false, status, didit_status: res.status, didit_response: diditBody }, 502);
   }

   console.log(`[didit-sync-user-status] ${userId} → ${status} in Didit`);
   return jsonResponse({ synced: true, status });
});
