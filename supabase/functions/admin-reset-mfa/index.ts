import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Admin account-recovery tools (one function: the project is at its edge-function cap).
//
// 1. Admin-assisted 2FA recovery (default action).
//    2FA (TOTP + passkey) is self-service and opt-in — see the "Two-factor authentication"
//    section in account Security settings. There is no user-facing recovery-code flow, so a
//    user who loses their authenticator app or passkey device has no way back into their
//    account on their own. An active admin removes every enrolled MFA factor for a user,
//    dropping their next sign-in to a plain aal1 login.
//    Body: { userId: string }
//
// 2. Move a borrower onto an Instant Wallet (action 'pregenerate_instant_wallet').
//    Openfort pregenerates the embedded smart account for their Supabase user id (User custody,
//    recovery share stored with Shield the same way the app's AUTOMATIC recovery expects), and
//    the account's saved wallet becomes that address. The borrower claims it just by signing in.
//    Why: borrowers on their own Base / MetaMask wallets kept paying into a wallet they then
//    couldn't open (Nov 2026). The account type is copied from an existing Instant Wallet so
//    the app recovers this account on sign-in instead of minting a second one.
//    Body: { action: 'pregenerate_instant_wallet', userId: string, dryRun?: boolean }
//
// Auth: an active admin's session, or X-Admin-Token = ADMIN_API_TOKEN (fail-closed).

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
type Svc = any;

const pregenerateInstantWallet = async (svc: Svc, actorId: string | null, userId: string, dryRun: boolean) => {
   const { data: target } = await svc.from('users').select('id, wallet_address, user_role').eq('id', userId).maybeSingle();
   if (!target) return json({ error: 'user not found' }, 404);

   const { data: existingGrant } = await svc.from('embedded_wallet_grants').select('wallet_address').eq('user_id', userId).maybeSingle();
   if (existingGrant?.wallet_address) {
      return json({ ok: true, already: true, address: existingGrant.wallet_address, savedWallet: target.wallet_address });
   }

   // Openfort live secret key: the same project's key the Indonesia payout wallet uses (vault).
   const { data: secretJson, error: secretError } = await svc.rpc('openfort_payout_secret');
   let secretKey = '';
   try {
      secretKey = String((typeof secretJson === 'string' ? JSON.parse(secretJson) : secretJson)?.secretKey ?? '');
   } catch {
      secretKey = '';
   }
   if (secretError || !secretKey) return json({ error: 'openfort secret key not configured' }, 500);

   const shieldApiKey = Deno.env.get('OPENFORT_SHIELD_PUBLISHABLE_KEY') ?? '';
   const shieldApiSecret = Deno.env.get('OPENFORT_SHIELD_SECRET_KEY') ?? '';
   const encryptionShare = Deno.env.get('OPENFORT_SHIELD_ENCRYPTION_SHARE') ?? '';
   if (!shieldApiKey || !shieldApiSecret || !encryptionShare) return json({ error: 'shield keys not configured' }, 500);

   const { default: Openfort, ShieldAuthProvider } = await import('npm:@openfort/openfort-node@0.14.0');
   const openfort = new Openfort(secretKey);

   // Copy chain + smart-account implementation from a wallet the app itself created.
   const { data: templates } = await svc
      .from('embedded_wallet_grants')
      .select('wallet_address')
      .not('wallet_address', 'is', null)
      .order('granted_at', { ascending: false })
      .limit(50);
   // Openfort's address filter is case-sensitive and our rows aren't checksummed, so match here.
   const known = new Set(((templates ?? []) as { wallet_address: string }[]).map((r) => r.wallet_address.toLowerCase()));
   let template: { chainId?: number; implementationType?: string; address?: string } | null = null;
   const recent = await openfort.accounts.list({ accountType: 'Smart Account', custody: 'User', chainType: 'EVM', limit: 100 });
   // deno-lint-ignore no-explicit-any
   const acc = ((recent as any)?.data ?? []).find((a: any) => known.has(String(a.address).toLowerCase()) && a.smartAccount?.implementationType);
   if (acc) {
      template = { chainId: acc.chainId ?? acc.smartAccount?.chainId, implementationType: acc.smartAccount.implementationType, address: acc.address };
   }
   if (!template?.chainId || !template.implementationType) {
      // Say what Openfort did return, so a wrong key and a changed response shape look different.
      const probe = await openfort.accounts.list({ limit: 3 }).catch((e: unknown) => ({ error: String(e) }));
      // deno-lint-ignore no-explicit-any
      const sample = ((probe as any)?.data ?? []).map((a: any) => ({ type: a.accountType, custody: a.custody, chainId: a.chainId, impl: a.smartAccount?.implementationType }));
      return json(
         {
            error: 'could not read an existing Instant Wallet to copy its settings (wrong Openfort project key?)',
            keyMode: secretKey.slice(0, 8),
            probeKeys: Object.keys((probe as object) ?? {}),
            probeTotal: (probe as { total?: number }).total ?? null,
            sample
         },
         500
      );
   }

   if (dryRun) return json({ ok: true, dryRun: true, template, currentWallet: target.wallet_address });

   const account = await openfort.accounts.evm.embedded.pregenerate(
      {
         thirdPartyUserId: userId,
         thirdPartyProvider: 'supabase',
         accountType: 'Smart Account',
         chainId: template.chainId,
         implementationType: template.implementationType
      },
      { shieldApiKey, shieldApiSecret, encryptionShare, shieldAuthProvider: ShieldAuthProvider.OPENFORT }
   );
   const address = (account as { address?: string }).address;
   if (!address) return json({ error: 'openfort returned no address', account }, 502);

   // Service-role writes: the borrower wallet lock only applies to client roles.
   const previousWallet = target.wallet_address as string | null;
   const { error: grantError } = await svc
      .from('embedded_wallet_grants')
      .upsert({ user_id: userId, wallet_address: address, user_role: target.user_role ?? 'borrower' });
   // Provider + connector too: the app reads these to decide Instant Wallet vs Base Account
   // (getStoredWalletProvider); leaving 'base_wallet' would keep sending them to Base Pay.
   const { error: userError } = await svc
      .from('users')
      .update({ wallet_address: address, wallet_provider: 'openfort', wallet_connector_name: 'Openfort', wallet_chain_id: template.chainId })
      .eq('id', userId);

   await svc.from('admin_audit_logs').insert({
      actor_user_id: actorId,
      action: 'instant_wallet_pregenerated',
      target_table: 'users',
      target_id: userId,
      target_user_id: userId,
      metadata: {
         previous_wallet: previousWallet,
         new_wallet: address,
         openfort_account: (account as { id?: string }).id ?? null,
         template,
         errors: [grantError?.message, userError?.message].filter(Boolean)
      }
   });

   if (grantError || userError) {
      return json({ ok: false, address, previousWallet, errors: [grantError?.message, userError?.message].filter(Boolean) }, 500);
   }
   return json({ ok: true, address, previousWallet });
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // ---- Auth: server-side token, or an active admin's session -------------------------------
   let callerId: string | null = null;
   const adminToken = (Deno.env.get('ADMIN_API_TOKEN') ?? '').trim();
   const presentedToken = (req.headers.get('X-Admin-Token') ?? '').trim();
   if (presentedToken) {
      if (!adminToken || presentedToken !== adminToken) return json({ error: 'unauthorized' }, 401);
   } else {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json({ error: 'Missing authorization token' }, 401);

      const { data: userData, error: userError } = await admin.auth.getUser(token);
      callerId = userData?.user?.id ?? null;
      if (userError || !callerId) return json({ error: 'Invalid session' }, 401);

      const { data: adminRow } = await admin
         .from('admin_users')
         .select('user_id')
         .eq('user_id', callerId)
         .eq('active', true)
         .in('role', ['owner', 'admin', 'support'])
         .maybeSingle();
      if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);
   }

   // ---- Input --------------------------------------------------------------------------------
   const body = await req.json().catch(() => ({} as Record<string, unknown>));
   const targetUserId = typeof body.userId === 'string' ? body.userId : null;
   if (!targetUserId) return json({ error: 'userId is required' }, 400);

   if (body.action === 'pregenerate_instant_wallet') {
      try {
         return await pregenerateInstantWallet(admin, callerId, targetUserId, body.dryRun === true);
      } catch (err) {
         return json({ error: err instanceof Error ? err.message : String(err) }, 502);
      }
   }

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
