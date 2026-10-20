import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { isStableyardConfigured, stableyard, type StableyardAccount, type StableyardDepositNetwork } from '../_shared/stableyard.ts';
import {
   BASE_CHAIN_ID,
   configuredDepositChainIds,
   depositAddressRow,
   pickDepositNetworks,
   syncDeposits
} from '../_shared/stableyardSync.ts';

// Stableyard deposit addresses for the signed-in user ("send from any chain").
//
// POST {}                    → ensure the user's Stableyard account + addresses exist, return them
// POST { refresh: true }     → same, and re-read deposits from Stableyard first
//
// The account's settlement wallet is the user's own Moodeng wallet on Base (users.wallet_address),
// so every deposit lands there as USDC and the existing repay flow picks it up. We never accept a
// wallet address from the client. Kill switch: STABLEYARD_DEPOSITS_DISABLED=true.
//
// TEST-ONLY until launch: only active admins get addresses (everyone else gets enabled:false and the
// UI hides itself). Set STABLEYARD_DEPOSITS_PUBLIC=true to open it to all users.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const accountFrom = (data: unknown): StableyardAccount | null => {
   if (!data || typeof data !== 'object') return null;
   const record = data as { account?: StableyardAccount; id?: string };
   if (record.account?.id) return record.account;
   return record.id ? (record as StableyardAccount) : null;
};

/** Find or create the user's Stableyard account, and make sure it settles to `wallet`. */
const ensureAccount = async (admin: SupabaseClient, userId: string, wallet: string) => {
   const { data: existing } = await admin
      .from('stableyard_accounts')
      .select('account_id, settlement_wallet')
      .eq('user_id', userId)
      .maybeSingle();
   const settlementWallet = { address: wallet, chainId: BASE_CHAIN_ID, label: 'Moodeng wallet', isPreferredSettlement: true };

   if (existing?.account_id) {
      if ((existing.settlement_wallet ?? '').toLowerCase() !== wallet.toLowerCase()) {
         const linked = await stableyard.linkWallets(existing.account_id, [settlementWallet]);
         if (!linked.ok) return { ok: false as const, status: 502, error: `Could not update your deposit wallet: ${linked.error}` };
         await admin
            .from('stableyard_accounts')
            .update({ settlement_wallet: wallet, settlement_chain_id: BASE_CHAIN_ID, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
      }
      return { ok: true as const, accountId: existing.account_id as string };
   }

   let account: StableyardAccount | null = null;
   const created = await stableyard.createAccount(
      { externalUserId: userId, subjectType: 'individual', wallets: [settlementWallet], metadata: { source: 'moodeng' } },
      `moodeng-account:${userId}`
   );
   if (created.ok) {
      account = accountFrom(created.data);
   } else if (created.status === 409 && created.code !== 'idempotency_conflict') {
      // account_already_exists (e.g. a previous attempt created it but our insert failed): adopt it.
      const found = await stableyard.getAccountByExternalId(userId);
      account = found.ok ? accountFrom(found.data) : null;
      if (account) {
         const linked = await stableyard.linkWallets(account.id, [settlementWallet]);
         if (!linked.ok) return { ok: false as const, status: 502, error: `Could not link your wallet: ${linked.error}` };
      }
   }
   if (!account) {
      console.error(
         '[stableyard-deposit-address] create account failed',
         created.ok ? 'no account in body' : `${created.status} ${created.code ?? ''} ${created.error}`
      );
      return { ok: false as const, status: 502, error: 'Could not set up crypto deposits right now. Try again in a minute.' };
   }

   const { error } = await admin
      .from('stableyard_accounts')
      .upsert(
         {
            user_id: userId,
            account_id: account.id,
            settlement_wallet: wallet,
            settlement_chain_id: BASE_CHAIN_ID,
            updated_at: new Date().toISOString()
         },
         { onConflict: 'user_id' }
      );
   if (error) console.error('[stableyard-deposit-address] store account failed', error.message);
   return { ok: true as const, accountId: account.id };
};

const loadNetworks = async (): Promise<StableyardDepositNetwork[]> => {
   const result = await stableyard.depositNetworks();
   if (!result.ok) {
      console.error('[stableyard-deposit-address] deposit-networks failed', result.status, result.error);
      return [];
   }
   return Array.isArray(result.data) ? result.data : (result.data.networks ?? []);
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   if (Deno.env.get('STABLEYARD_DEPOSITS_DISABLED') === 'true' || !isStableyardConfigured()) {
      return json({ enabled: false, addresses: [], deposits: [] });
   }

   const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);
   const { data: userData, error: userError } = await admin.auth.getUser(token);
   const userId = userData?.user?.id;
   if (userError || !userId) return json({ error: 'Authentication required' }, 401);

   if (Deno.env.get('STABLEYARD_DEPOSITS_PUBLIC') !== 'true') {
      const { data: adminRow } = await admin
         .from('admin_users')
         .select('user_id')
         .eq('user_id', userId)
         .eq('active', true)
         .in('role', ['owner', 'admin'])
         .maybeSingle();
      if (!adminRow) return json({ enabled: false, addresses: [], deposits: [] });
   }

   const body = await req.json().catch(() => ({}));
   const refresh = Boolean(body?.refresh);

   try {
      const { data: profile } = await admin.from('users').select('wallet_address, wallet_chain_id').eq('id', userId).maybeSingle();
      const wallet = String(profile?.wallet_address ?? '').trim();
      if (!EVM_ADDRESS.test(wallet) || (profile?.wallet_chain_id && Number(profile.wallet_chain_id) !== BASE_CHAIN_ID)) {
         return json({ enabled: true, code: 'no_wallet', error: 'Set up your Moodeng wallet first.', addresses: [], deposits: [] }, 409);
      }

      const account = await ensureAccount(admin, userId, wallet);
      if (!account.ok) return json({ enabled: true, error: account.error, addresses: [], deposits: [] }, account.status);

      let { data: addresses } = await admin
         .from('stableyard_deposit_addresses')
         .select('id, chain_id, network_code, chain_family, address, assets, status')
         .eq('user_id', userId)
         .eq('status', 'active');

      const wanted = configuredDepositChainIds();
      const have = new Set((addresses ?? []).map((row: { chain_id: number }) => row.chain_id));
      if (wanted.some((chainId) => !have.has(chainId))) {
         const catalog = pickDepositNetworks(await loadNetworks(), wanted);
         const missing = catalog.map((network) => network.chainId).filter((chainId) => !have.has(chainId));
         if (missing.length) {
            // All-or-nothing per call on Stableyard's side, so only ask for chains the catalog says are live.
            const created = await stableyard.createDepositAddresses(
               account.accountId,
               missing,
               `moodeng-addr:${userId}:${[...missing].sort().join('-')}`
            );
            if (created.ok) {
               const rows = (created.data.depositAddresses ?? []).map((address) => depositAddressRow(userId, address, catalog));
               if (rows.length) {
                  const { error } = await admin.from('stableyard_deposit_addresses').upsert(rows, { onConflict: 'id' });
                  if (error) console.error('[stableyard-deposit-address] store addresses failed', error.message);
               }
            } else {
               console.error('[stableyard-deposit-address] create addresses failed', created.status, created.code ?? '', created.error);
               if (!addresses?.length) {
                  return json(
                     {
                        enabled: true,
                        error: 'Could not create your deposit addresses right now. Try again in a minute.',
                        addresses: [],
                        deposits: []
                     },
                     502
                  );
               }
            }
            ({ data: addresses } = await admin
               .from('stableyard_deposit_addresses')
               .select('id, chain_id, network_code, chain_family, address, assets, status')
               .eq('user_id', userId)
               .eq('status', 'active'));
         }
      }

      if (refresh) await syncDeposits(admin, userId, account.accountId);

      const { data: deposits } = await admin
         .from('stableyard_deposits')
         .select(
            'id, status, source_chain_id, asset_symbol, asset_decimals, amount_atomic, net_amount_atomic, net_asset_symbol, net_asset_decimals, source_tx_hash, settlement_tx_hash, observed_at, settled_at, created_at'
         )
         .eq('user_id', userId)
         .order('created_at', { ascending: false })
         .limit(10);

      const order = new Map(wanted.map((chainId, index) => [chainId, index]));
      const sorted = [...(addresses ?? [])].sort(
         (a: { chain_id: number }, b: { chain_id: number }) => (order.get(a.chain_id) ?? 99) - (order.get(b.chain_id) ?? 99)
      );
      return json({ enabled: true, settlementWallet: wallet, addresses: sorted, deposits: deposits ?? [] });
   } catch (err) {
      console.error('[stableyard-deposit-address] error', err);
      return json({ enabled: true, error: 'Crypto deposits are unavailable right now.', addresses: [], deposits: [] }, 500);
   }
});
