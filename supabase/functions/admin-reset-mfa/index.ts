import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Admin-assisted 2FA recovery.
//
// 2FA (TOTP + passkey) is self-service and opt-in — see the "Two-factor authentication"
// section in account Security settings. There is no user-facing recovery-code flow, so a
// user who loses their authenticator app or passkey device has no way back into their
// account on their own. This function is that way back: an active admin removes every
// enrolled MFA factor for a user, dropping their next sign-in to a plain aal1 login.
//
// Body: { userId: string }

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // ---- Auth: caller must be an active admin ------------------------------------------------
   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);

   const { data: userData, error: userError } = await admin.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);

   const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);

   // ---- Input --------------------------------------------------------------------------------
   const body = await req.json().catch(() => ({} as Record<string, unknown>));
   const targetUserId = typeof body.userId === 'string' ? body.userId : null;
   if (!targetUserId) return json({ error: 'userId is required' }, 400);

   // ---- Remove every enrolled factor ----------------------------------------------------------
   const { data: factorData, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: targetUserId });
   if (listError) return json({ error: `Could not list factors: ${listError.message}` }, 500);

   const factors = factorData?.factors ?? [];
   const removed: string[] = [];
   const errors: string[] = [];

   for (const factor of factors) {
      const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: targetUserId });
      if (deleteError) {
         errors.push(`${factor.factor_type} (${factor.id}): ${deleteError.message}`);
      } else {
         removed.push(factor.factor_type);
      }
   }

   const { error: auditError } = await admin.from('admin_audit_logs').insert({
      actor_user_id: callerId,
      action: 'mfa_reset',
      target_table: 'users',
      target_id: targetUserId,
      target_user_id: targetUserId,
      metadata: { removed_factor_types: removed, factor_count: factors.length, errors }
   });
   if (auditError) errors.push(`audit: ${auditError.message}`);

   return json({ ok: errors.length === 0, removedCount: removed.length, removedFactorTypes: removed, errors });
});
