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
// 3. Repair / inspect a pregenerated wallet's recovery share in Shield.
//    Body: { action: 'shield_refile', userId, dryRun? }  |  { action: 'shield_probe', userId } (read-only)
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
   // openfort-node files the recovery share under the usr_ id, which a Supabase sign-in can't
   // reach (see shieldRefile). File the copy the app can open before calling this done.
   const refileRes = await shieldRefile(svc, actorId, userId, false);
   const refile = (await refileRes.json().catch(() => null)) as { ok?: boolean } | null;
   if (!refile?.ok) return json({ ok: false, address, previousWallet, error: 'wallet created but its recovery share could not be re-filed; run shield_refile', refile }, 502);
   return json({ ok: true, address, previousWallet, refiled: true });
};

// Read-only: where does Shield hold this account's recovery share? Lists the Openfort user(s) and
// accounts for a Supabase id and asks Shield which candidate ids / signer references have a share.
// Returns ids and found/not-found only, never key material.
const shieldProbe = async (svc: Svc, userId: string) => {
   const { data: secretJson } = await svc.rpc('openfort_payout_secret');
   let secretKey = '';
   try {
      secretKey = String((typeof secretJson === 'string' ? JSON.parse(secretJson) : secretJson)?.secretKey ?? '');
   } catch {
      secretKey = '';
   }
   const shieldApiKey = Deno.env.get('OPENFORT_SHIELD_PUBLISHABLE_KEY') ?? '';
   const shieldApiSecret = Deno.env.get('OPENFORT_SHIELD_SECRET_KEY') ?? '';
   if (!secretKey || !shieldApiKey || !shieldApiSecret) return json({ error: 'keys not configured' }, 500);

   const ofGet = async (path: string) => {
      const res = await fetch(`https://api.openfort.io${path}`, { headers: { Authorization: `Bearer ${secretKey}` } });
      return { status: res.status, body: await res.json().catch(() => null) };
   };
   const users = await ofGet(`/v2/users?externalUserId=${encodeURIComponent(userId)}`);
   // deno-lint-ignore no-explicit-any
   const ofUserIds: string[] = ((users.body as any)?.data ?? []).map((u: any) => String(u.id));
   // deno-lint-ignore no-explicit-any
   const accounts: any[] = [];
   for (const id of ofUserIds) {
      const res = await ofGet(`/v2/accounts?user=${encodeURIComponent(id)}&limit=20`);
      // deno-lint-ignore no-explicit-any
      accounts.push(...(((res.body as any)?.data ?? []) as any[]));
   }
   const signers: Record<string, unknown> = {};
   for (const a of accounts) {
      if (a.ownerAddress) signers[a.ownerAddress] = (await ofGet(`/v2/accounts/signer?address=${a.ownerAddress}`)).body;
   }
   const signerIds = Object.values(signers)
      // deno-lint-ignore no-explicit-any
      .map((s: any) => s?.id ?? s?.signer ?? s?.signerId)
      .filter((v) => typeof v === 'string') as string[];

   const shieldPost = async (path: string, authProvider: string, body: Record<string, unknown>) => {
      const res = await fetch(`https://shield.openfort.io/${path}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-api-key': shieldApiKey, 'x-api-secret': shieldApiSecret, 'x-auth-provider': authProvider },
         body: JSON.stringify(body)
      });
      return { status: res.status, body: await res.json().catch(() => null) };
   };
   const candidateUsers = [...new Set([...ofUserIds, ...accounts.map((a) => String(a.wallet)), userId])];
   const candidateRefs = [...new Set([...signerIds, ...accounts.map((a) => String(a.id))])];
   const shield: Record<string, unknown> = {};
   for (const provider of ['openfort', 'custom']) {
      shield[`users:${provider}`] = await shieldPost('shares/encryption/user/bulk', provider, { user_ids: candidateUsers });
      if (candidateRefs.length) shield[`refs:${provider}`] = await shieldPost('shares/encryption/reference/bulk', provider, { references: candidateRefs });
   }
   return json({
      ok: true,
      ofUserIds,
      accounts: accounts.map((a) => ({ id: a.id, wallet: a.wallet, address: a.address, ownerAddress: a.ownerAddress, recoveryMethod: a.recoveryMethod, details: a.recoveryMethodDetails ?? null })),
      signers,
      shield
   });
};

// Repair for the wallets pregenerated on 2026-11-11.
//
// openfort-node filed each recovery share in Shield under the Openfort user id (usr_…). A Supabase
// sign-in makes Shield resolve the wallet id (pla_…) instead, so the app got "No secret found for
// the given auth options" and nobody could pay. Shield has no admin read for these shares, but a
// share is readable by any identity whose external id matches its owner's. So: add a short-lived
// custom auth provider to OUR Shield project (key pair made here, never leaves this function),
// read the share as usr_…, file a copy under pla_… (no reference: the wallet iframe falls back to
// the per-user lookup when the by-reference one misses), then remove the provider again.
// Nothing is deleted. Key material is never returned or logged.
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const shieldRefile = async (svc: Svc, actorId: string | null, userId: string, dryRun: boolean) => {
   const { data: secretJson } = await svc.rpc('openfort_payout_secret');
   let secretKey = '';
   try {
      secretKey = String((typeof secretJson === 'string' ? JSON.parse(secretJson) : secretJson)?.secretKey ?? '');
   } catch {
      secretKey = '';
   }
   const shieldApiKey = Deno.env.get('OPENFORT_SHIELD_PUBLISHABLE_KEY') ?? '';
   const shieldApiSecret = Deno.env.get('OPENFORT_SHIELD_SECRET_KEY') ?? '';
   const encryptionShare = Deno.env.get('OPENFORT_SHIELD_ENCRYPTION_SHARE') ?? '';
   if (!secretKey || !shieldApiKey || !shieldApiSecret || !encryptionShare) return json({ error: 'keys not configured' }, 500);

   const ofGet = async (path: string) => {
      const res = await fetch(`https://api.openfort.io${path}`, { headers: { Authorization: `Bearer ${secretKey}` } });
      // deno-lint-ignore no-explicit-any
      return (await res.json().catch(() => null)) as any;
   };
   const users = await ofGet(`/v2/users?externalUserId=${encodeURIComponent(userId)}`);
   if ((users?.data ?? []).length !== 1) return json({ error: 'expected exactly one Openfort user', total: users?.total ?? null }, 409);
   const ofUserId = String(users.data[0].id);
   const accounts = await ofGet(`/v2/accounts?user=${encodeURIComponent(ofUserId)}&limit=20`);
   // deno-lint-ignore no-explicit-any
   const smart = ((accounts?.data ?? []) as any[]).find((a) => a.accountType === 'Smart Account' && a.ownerAddress);
   if (!smart) return json({ error: 'no smart account found' }, 404);
   const walletId = String(smart.wallet);
   const reference: string | undefined = (await ofGet(`/v2/accounts/signer?address=${smart.ownerAddress}`))?.id;
   if (!ofUserId.startsWith('usr_') || !walletId.startsWith('pla_') || !reference) return json({ error: 'unexpected ids', ofUserId, walletId, reference }, 409);

   const admin = { 'Content-Type': 'application/json', 'x-api-key': shieldApiKey, 'x-api-secret': shieldApiSecret };
   const shield = async (path: string, init: RequestInit) => {
      const res = await fetch(`https://shield.openfort.io/${path}`, init);
      // deno-lint-ignore no-explicit-any
      const body = (await res.json().catch(() => null)) as any;
      return { status: res.status, body };
   };
   // Shape only: never return the secret itself.
   // deno-lint-ignore no-explicit-any
   const shape = (r: { status: number; body: any }) => ({
      status: r.status,
      hasSecret: typeof r.body?.secret === 'string',
      secretLength: typeof r.body?.secret === 'string' ? r.body.secret.length : null,
      entropy: r.body?.entropy ?? null,
      reference: r.body?.reference ?? null,
      code: r.body?.code ?? null,
      message: r.body?.message ?? null
   });
   const bulk = async () =>
      (await shield('shares/encryption/user/bulk', { method: 'POST', headers: { ...admin, 'x-auth-provider': 'openfort' }, body: JSON.stringify({ user_ids: [ofUserId, walletId] }) })).body
         ?.encryption_types ?? null;

   const before = await bulk();
   if (before?.[walletId]?.status === 'found') return json({ ok: true, already: true, walletId, ofUserId, reference, before });

   const providersBefore = await shield('project/providers', { headers: admin });
   // deno-lint-ignore no-explicit-any
   const existingCustom = ((providersBefore.body?.providers ?? []) as any[]).filter((p) => String(p.type).toLowerCase() === 'custom');
   if (providersBefore.status !== 200 || existingCustom.length) {
      return json({ ok: false, step: 'providers', status: providersBefore.status, providers: providersBefore.body?.providers ?? null }, 409);
   }

   const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false,
      ['sign', 'verify']
   );
   const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
   const pem = `-----BEGIN PUBLIC KEY-----\n${(btoa(String.fromCharCode(...spki)).match(/.{1,64}/g) ?? []).join('\n')}\n-----END PUBLIC KEY-----\n`;
   const signJwt = async (sub: string) => {
      const enc = new TextEncoder();
      const now = Math.floor(Date.now() / 1000);
      const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
      const payload = b64url(enc.encode(JSON.stringify({ sub, iat: now, exp: now + 120 })));
      const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, enc.encode(`${head}.${payload}`)));
      return `${head}.${payload}.${b64url(sig)}`;
   };

   const added = await shield('project/providers', { method: 'POST', headers: admin, body: JSON.stringify({ providers: { custom: { pem, key_type: 'rsa' } } }) });
   // deno-lint-ignore no-explicit-any
   const customProviderId: string | undefined = ((added.body?.providers ?? []) as any[]).find((p) => String(p.type).toLowerCase() === 'custom')?.provider_id;
   if (!customProviderId) {
      return json({ ok: false, step: 'add-provider', status: added.status, code: added.body?.code ?? null, message: added.body?.message ?? null, providers: added.body?.providers ?? null }, 502);
   }

   const result: Record<string, unknown> = { walletId, ofUserId, reference, address: smart.address, before };
   let ok = false;
   try {
      const source = await shield(`shares/${reference}`, {
         headers: { 'x-api-key': shieldApiKey, 'x-auth-provider': 'custom', Authorization: `Bearer ${await signJwt(ofUserId)}`, 'x-encryption-part': encryptionShare }
      });
      result.source = shape(source);
      const secret: string | undefined = typeof source.body?.secret === 'string' ? source.body.secret : undefined;
      if (secret && !dryRun) {
         const write = await shield('admin/preregister', {
            method: 'POST',
            headers: { ...admin, 'x-auth-provider': 'openfort', 'x-user-id': walletId, 'x-encryption-part': encryptionShare },
            body: JSON.stringify({ secret, entropy: 'project', encryption_part: encryptionShare, encryption_session: '', reference: '', keychain_id: '', passkey_reference: null })
         });
         result.write = { status: write.status, code: write.body?.code ?? null, message: write.body?.message ?? null };
         const after = await bulk();
         result.after = after;
         ok = write.status >= 200 && write.status < 300 && after?.[walletId]?.status === 'found';
      } else {
         ok = Boolean(secret) && dryRun;
      }
   } finally {
      const removed = await shield(`project/providers/${customProviderId}`, { method: 'DELETE', headers: admin });
      const providersAfter = await shield('project/providers', { headers: admin });
      result.cleanup = {
         removeStatus: removed.status,
         // deno-lint-ignore no-explicit-any
         providersAfter: ((providersAfter.body?.providers ?? []) as any[]).map((p) => p.type)
      };
   }

   if (!dryRun) {
      await svc.from('admin_audit_logs').insert({
         actor_user_id: actorId,
         action: 'instant_wallet_share_refiled',
         target_table: 'users',
         target_id: userId,
         target_user_id: userId,
         metadata: { wallet_id: walletId, openfort_user: ofUserId, reference, address: smart.address, ok, write: result.write ?? null, cleanup: result.cleanup ?? null }
      });
   }
   return json({ ok, dryRun, ...result }, ok ? 200 : 502);
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

   if (body.action === 'shield_probe') {
      try {
         return await shieldProbe(admin, targetUserId);
      } catch (err) {
         return json({ error: err instanceof Error ? err.message : String(err) }, 502);
      }
   }

   if (body.action === 'shield_refile') {
      try {
         return await shieldRefile(admin, callerId, targetUserId, body.dryRun === true);
      } catch (err) {
         return json({ error: err instanceof Error ? err.message : String(err) }, 502);
      }
   }

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
