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
import { handleStableyardWebhook, isStableyardWebhook } from '../_shared/stableyardWebhook.ts';

// Stableyard deposit addresses for the signed-in user ("send from any chain").
//
// POST {}                    → ensure the user's Stableyard account + addresses exist, return them
// POST { refresh: true }     → same, and re-read deposits from Stableyard first
// POST { onboarding: 'status' | 'email_start' | 'email_confirm' | 'kyc_start' }
//                            → the caller's own account: verify its email and start KYC, which
//                              Stableyard requires before QR payments. The email is always the
//                              caller's sign-in email, never one from the client.
// POST { qr: 'status' | 'use_wallet' | 'decode' | 'create' | 'get', ... }
//                            → External QR payment test for admins + stableyard_qr_testers (see handleQr).
//
// The account's settlement wallet is the user's own Moodeng wallet on Base (users.wallet_address),
// so every deposit lands there as USDC and the existing repay flow picks it up. We never accept a
// wallet address from the client. Kill switch: STABLEYARD_DEPOSITS_DISABLED=true.
//
// TEST-ONLY until launch: only active admins get addresses (everyone else gets enabled:false and the
// UI hides itself). Set STABLEYARD_DEPOSITS_PUBLIC=true to open it to all users.
//
// Also the Stableyard webhook URL: requests with x-stableyard-signature go to _shared/stableyardWebhook.ts.
// That's why verify_jwt is off in config.toml — user requests are authenticated below with getUser().

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

   const { error } = await admin.from('stableyard_accounts').upsert(
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

const ONBOARDING_ACTIONS = new Set(['status', 'email_start', 'email_confirm', 'kyc_start']);

/** Email verification + KYC for the caller's own Stableyard account (needed for QR payments). */
const handleOnboarding = async (
   admin: SupabaseClient,
   userId: string,
   email: string,
   action: string,
   body: { challengeId?: unknown; code?: unknown }
) => {
   const { data: row } = await admin.from('stableyard_accounts').select('account_id').eq('user_id', userId).maybeSingle();
   const accountId = row?.account_id as string | undefined;
   if (!accountId) return json({ error: 'No Stableyard account yet. Open the deposit test first to create one.' }, 409);

   const fail = (result: { status: number; error: string; code?: string; requestId?: string; data?: unknown }) =>
      json(
         {
            ok: false,
            accountId,
            stableyardStatus: result.status,
            error: result.error,
            code: result.code ?? null,
            requestId: result.requestId ?? null,
            response: result.data ?? null
         },
         502
      );

   if (action === 'email_start') {
      if (!email) return json({ error: 'Your Moodeng login has no email to verify.' }, 409);
      const result = await stableyard.startEmailVerification(accountId, email);
      return result.ok ? json({ ok: true, accountId, step: 'email_start', result: result.data }) : fail(result);
   }
   if (action === 'email_confirm') {
      const challengeId = String(body.challengeId ?? '').trim();
      const code = String(body.code ?? '').trim();
      if (!/^account_email_[A-Za-z0-9_-]+$/.test(challengeId)) return json({ error: 'Send the code first.' }, 400);
      if (!/^\d{6}$/.test(code)) return json({ error: 'The code is 6 digits.' }, 400);
      const result = await stableyard.confirmEmailVerification(accountId, challengeId, code);
      return result.ok ? json({ ok: true, accountId, step: 'email_confirm', result: result.data }) : fail(result);
   }
   if (action === 'kyc_start') {
      const result = await stableyard.startKycSession(accountId);
      return result.ok ? json({ ok: true, accountId, step: 'kyc_start', result: result.data }) : fail(result);
   }

   const [emailStatus, kyc] = await Promise.all([stableyard.getEmailStatus(accountId), stableyard.getKyc(accountId)]);
   if (!emailStatus.ok) return fail(emailStatus);
   if (!kyc.ok) return fail(kyc);
   return json({ ok: true, accountId, step: 'status', email: emailStatus.data, kyc: kyc.data });
};

const QR_ACTIONS = new Set([
   'setup',
   'status',
   'use_wallet',
   'decode',
   'create',
   'get',
   'sent',
   'bank_list',
   'bank_create',
   'payout_status',
   'payout_activate'
]);

// Fiat currency per supported QR country, with a test cap (~$35) so a typo can't pay a big bill.
const QR_COUNTRIES: Record<string, { currency: string; max: number }> = {
   PH: { currency: 'PHP', max: 2000 },
   VN: { currency: 'VND', max: 1_000_000 }
};
// Bank payout limits while it's tester-only (~$85 max, enough to cash out a loan). Stableyard's PH minimum is ₱50.
const BANK_MIN: Record<string, number> = { PH: 50, VN: 20_000 };
const BANK_MAX: Record<string, number> = { PH: 5000, VN: 2_000_000 };
const FIAT_AMOUNT = /^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/;

// Stableyard's email / KYC / payment-source bodies aren't documented to us, so read them loosely:
// the first value under any of `keys`, at any depth.
const findValue = (data: unknown, keys: string[], depth = 0): unknown => {
   if (!data || typeof data !== 'object' || depth > 4) return undefined;
   for (const key of keys) {
      const value = (data as Record<string, unknown>)[key];
      if (value !== undefined && value !== null && typeof value !== 'object') return value;
   }
   for (const value of Object.values(data as Record<string, unknown>)) {
      const found = findValue(value, keys, depth + 1);
      if (found !== undefined) return found;
   }
   return undefined;
};
const DONE_STATUSES = new Set(['verified', 'approved', 'completed', 'complete', 'passed', 'active']);
const isDone = (data: unknown) => {
   const verified = findValue(data, ['verified', 'isVerified', 'emailVerified']);
   if (verified === true) return true;
   if (findValue(data, ['verifiedAt'])) return true;
   return DONE_STATUSES.has(String(findValue(data, ['status']) ?? '').toLowerCase());
};

/** Mid-market fiat per USD (open.er-api.com, free, daily). Null if it can't be read in 4s. */
const marketRate = async (currency: string): Promise<{ rate: number; at: string } | null> => {
   try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
      const data = (await res.json()) as { rates?: Record<string, number>; time_last_update_unix?: number };
      const rate = Number(data.rates?.[currency]);
      if (!res.ok || !Number.isFinite(rate) || rate <= 0) return null;
      return { rate, at: new Date((data.time_last_update_unix ?? 0) * 1000).toISOString() };
   } catch {
      return null;
   }
};

/**
 * External QR payment test for the caller's own Stableyard account (admins + stableyard_qr_testers).
 *   setup      → create the account if needed, pay from the Moodeng wallet, report email + KYC
 *   status     → payment source + KYC
 *   use_wallet → make the linked Moodeng wallet (Base) the payment source
 *   decode     → read a merchant QR (no money moves)
 *   create     → create the Payment; returns the escrow depositInstructions (no money moves yet)
 *                and logs the quote against the market rate in stableyard_qr_quotes
 *   get        → re-read a Payment
 *   sent       → record the tx hash once the person paid
 *   bank_list  → bank / e-wallet codes for a bank payout (PH/VN)
 *   payout_status   → the account's capabilities (bank_payout must be active before pesos go out)
 *   payout_activate → (re)start bank_payout activation; returns a fresh hosted compliance link
 *   bank_create → off-ramp test: a send Payment to a bank account or e-wallet (external_bank);
 *                like create, it returns escrow depositInstructions and moves no money yet
 * The money only moves when the person sends the exact USDC to the escrow address from the app.
 * QR payloads, account numbers and names are sensitive: never logged or stored here (only the last 4 digits).
 */
const handleQr = async (
   admin: SupabaseClient,
   userId: string,
   action: string,
   body: {
      country?: unknown;
      qrPayload?: unknown;
      amount?: unknown;
      paymentId?: unknown;
      requestKey?: unknown;
      txHash?: unknown;
      merchant?: unknown;
      bankCode?: unknown;
      bankName?: unknown;
      rail?: unknown;
      accountNumber?: unknown;
      beneficiaryName?: unknown;
   }
) => {
   if (action === 'setup') {
      const { data: profile } = await admin.from('users').select('wallet_address, wallet_chain_id').eq('id', userId).maybeSingle();
      const wallet = String(profile?.wallet_address ?? '').trim();
      if (!EVM_ADDRESS.test(wallet) || (profile?.wallet_chain_id && Number(profile.wallet_chain_id) !== BASE_CHAIN_ID)) {
         return json({ ok: false, code: 'no_wallet', error: 'Set up your Moodeng wallet first.' }, 409);
      }
      const account = await ensureAccount(admin, userId, wallet);
      if (!account.ok) return json({ ok: false, error: account.error }, account.status);
   }

   const { data: row } = await admin
      .from('stableyard_accounts')
      .select('account_id, settlement_wallet')
      .eq('user_id', userId)
      .maybeSingle();
   const accountId = row?.account_id as string | undefined;
   if (!accountId) return json({ error: 'No Stableyard account yet. Open the deposit test first to create one.' }, 409);

   const fail = (result: { status: number; error: string; code?: string; requestId?: string; data?: unknown }) =>
      json(
         {
            ok: false,
            accountId,
            stableyardStatus: result.status,
            error: result.error,
            code: result.code ?? null,
            requestId: result.requestId ?? null,
            response: result.data ?? null
         },
         502
      );

   if (action === 'status') {
      const [source, kyc] = await Promise.all([stableyard.getPaymentSource(accountId), stableyard.getKyc(accountId)]);
      if (!source.ok) return fail(source);
      return json({ ok: true, accountId, step: 'status', paymentSource: source.data, kyc: kyc.ok ? kyc.data : null });
   }

   const useWallet = async () => {
      const bundle = await stableyard.getAccountBundle(accountId);
      if (!bundle.ok) return bundle;
      const wallet = String(row?.settlement_wallet ?? '').toLowerCase();
      const linked = (bundle.data.connectedWallets ?? []).find(
         (w) => w.chainId === BASE_CHAIN_ID && w.address.toLowerCase() === wallet && w.status !== 'disabled'
      );
      if (!linked) return { ok: false as const, status: 409, error: 'Your Moodeng wallet is not linked to this Stableyard account.' };
      return stableyard.setPaymentSource(accountId, linked.id);
   };

   if (action === 'use_wallet') {
      const result = await useWallet();
      return result.ok ? json({ ok: true, accountId, step: 'use_wallet', result: result.data }) : fail(result);
   }

   if (action === 'setup') {
      const [email, kyc, firstSource] = await Promise.all([
         stableyard.getEmailStatus(accountId),
         stableyard.getKyc(accountId),
         stableyard.getPaymentSource(accountId)
      ]);
      let source = firstSource;
      let sourceReady = source.ok && String(findValue(source.data, ['type']) ?? '') === 'connected_wallet';
      if (!sourceReady && (await useWallet()).ok) {
         source = await stableyard.getPaymentSource(accountId);
         sourceReady = source.ok;
      }
      const kycStatus = kyc.ok ? String(findValue(kyc.data, ['status']) ?? 'not_started') : 'unknown';
      return json({
         ok: true,
         accountId,
         step: 'setup',
         emailVerified: email.ok && isDone(email.data),
         kycStatus,
         kycApproved: kyc.ok && DONE_STATUSES.has(kycStatus.toLowerCase()),
         kycUrl: kyc.ok ? (findValue(kyc.data, ['verificationUrl']) ?? null) : null,
         sourceReady,
         email: email.ok ? email.data : null,
         kyc: kyc.ok ? kyc.data : null,
         paymentSource: source.ok ? source.data : null
      });
   }

   if (action === 'sent') {
      const paymentId = String(body.paymentId ?? '').trim();
      const txHash = String(body.txHash ?? '').trim();
      if (!/^payment_[A-Za-z0-9_-]+$/.test(paymentId) || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
         return json({ error: 'Invalid payment ID or transaction.' }, 400);
      }
      await admin.from('stableyard_qr_quotes').update({ sent_tx_hash: txHash }).eq('user_id', userId).eq('payment_id', paymentId);
      return json({ ok: true, accountId, step: 'sent' });
   }

   if (action === 'get') {
      const paymentId = String(body.paymentId ?? '').trim();
      if (!/^payment_[A-Za-z0-9_-]+$/.test(paymentId)) return json({ error: 'Invalid payment ID.' }, 400);
      const result = await stableyard.getPayment(paymentId);
      if (!result.ok) return fail(result);
      // Only ever show the caller their own payments.
      if (!JSON.stringify(result.data).includes(accountId)) return json({ error: 'Not your payment.' }, 403);
      return json({ ok: true, accountId, step: 'get', result: result.data });
   }

   const country = String(body.country ?? '')
      .trim()
      .toUpperCase();
   const rules = QR_COUNTRIES[country];
   if (!rules) return json({ error: 'Country must be PH or VN.' }, 400);

   if (action === 'payout_status') {
      const result = await stableyard.listCapabilities(accountId);
      return result.ok ? json({ ok: true, accountId, step: 'payout_status', result: result.data }) : fail(result);
   }

   if (action === 'payout_activate') {
      // The hosted link is a credential for the caller only: returned, never logged or stored.
      const rail = String(body.rail ?? 'instapay')
         .trim()
         .toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(rail)) return json({ error: 'Invalid rail.' }, 400);
      const requestKey = String(body.requestKey ?? '').trim();
      if (!/^[A-Za-z0-9-]{8,64}$/.test(requestKey)) return json({ error: 'Missing request key.' }, 400);
      const result = await stableyard.activateCapability(
         accountId,
         { capability: 'bank_payout', country, currency: rules.currency, rail },
         `moodeng-cap:${accountId}:${requestKey}`
      );
      return result.ok ? json({ ok: true, accountId, step: 'payout_activate', result: result.data }) : fail(result);
   }

   if (action === 'bank_list') {
      const result = await stableyard.listBeneficiaryBanks(country);
      return result.ok ? json({ ok: true, accountId, step: 'bank_list', result: result.data }) : fail(result);
   }

   if (action === 'bank_create') {
      const bankCode = String(body.bankCode ?? '').trim();
      const accountNumber = String(body.accountNumber ?? '').replace(/[\s-]/g, '');
      const beneficiaryName = String(body.beneficiaryName ?? '')
         .replace(/\s+/g, ' ')
         .trim();
      const amount = String(body.amount ?? '').trim();
      const requestKey = String(body.requestKey ?? '').trim();
      if (!/^[A-Za-z0-9_-]{2,64}$/.test(bankCode)) return json({ error: 'Pick a bank.' }, 400);
      if (!/^[0-9]{6,20}$/.test(accountNumber)) return json({ error: 'Account number is 6–20 digits.' }, 400);
      if (beneficiaryName.length < 2 || beneficiaryName.length > 100) return json({ error: 'Enter the name on the account.' }, 400);
      if (!FIAT_AMOUNT.test(amount) || Number(amount) <= 0) return json({ error: 'Enter an amount like 100 or 100.50.' }, 400);
      if (Number(amount) < BANK_MIN[country]) return json({ error: `The minimum is ${BANK_MIN[country]} ${rules.currency}.` }, 400);
      if (Number(amount) > BANK_MAX[country]) return json({ error: `The maximum for now is ${BANK_MAX[country]} ${rules.currency}.` }, 400);
      if (!/^[A-Za-z0-9-]{8,64}$/.test(requestKey)) return json({ error: 'Missing request key.' }, 400);
      const result = await stableyard.createBankPayment(
         accountId,
         { country, bankCode, accountNumber, beneficiaryName, amount, currency: rules.currency },
         `moodeng-bank:${accountId}:${requestKey}`
      );
      if (!result.ok) return fail(result);

      const data = result.data as {
         payment?: { id?: string };
         nextAction?: { depositInstructions?: { amount?: string } } | null;
      };
      const usdc = Number(data?.nextAction?.depositInstructions?.amount);
      const market = await marketRate(rules.currency);
      const fairUsdc = market ? Number(amount) / market.rate : null;
      const quote = {
         usdc: Number.isFinite(usdc) ? usdc : null,
         marketRate: market?.rate ?? null,
         marketRateAt: market?.at ?? null,
         fairUsdc,
         spreadPct: fairUsdc && Number.isFinite(usdc) ? (usdc / fairUsdc - 1) * 100 : null
      };
      const bankName = String(body.bankName ?? '').slice(0, 80) || bankCode;
      const { error: logError } = await admin.from('stableyard_qr_quotes').insert({
         user_id: userId,
         payment_id: data?.payment?.id ?? null,
         country,
         fiat_currency: rules.currency,
         fiat_amount: Number(amount),
         usdc_amount: quote.usdc,
         market_rate: quote.marketRate,
         market_rate_at: quote.marketRateAt,
         merchant_name: `Bank payout: ${bankName} ••${accountNumber.slice(-4)}`
      });
      if (logError) console.error('[stableyard-deposit-address] log bank quote failed', logError.message);
      return json({ ok: true, accountId, step: 'bank_create', result: result.data, quote });
   }

   const qrPayload = String(body.qrPayload ?? '').trim();
   if (!qrPayload || qrPayload.length > 4096) return json({ error: 'Paste the QR text (1–4096 characters).' }, 400);

   if (action === 'decode') {
      const result = await stableyard.decodeQr(accountId, country, qrPayload);
      return result.ok ? json({ ok: true, accountId, step: 'decode', result: result.data }) : fail(result);
   }

   // create
   const amount = String(body.amount ?? '').trim();
   if (!FIAT_AMOUNT.test(amount) || Number(amount) <= 0) return json({ error: 'Enter an amount like 100 or 100.50.' }, 400);
   if (Number(amount) > rules.max) return json({ error: `Test payments are capped at ${rules.max} ${rules.currency}.` }, 400);
   // One key per press from the client, so a double-tap can't create two Payments.
   const requestKey = String(body.requestKey ?? '').trim();
   if (!/^[A-Za-z0-9-]{8,64}$/.test(requestKey)) return json({ error: 'Missing request key.' }, 400);
   const result = await stableyard.createQrPayment(
      accountId,
      { country, qrPayload, amount, currency: rules.currency },
      `moodeng-qr:${accountId}:${requestKey}`
   );
   if (!result.ok) return fail(result);

   // Log the quote next to the market rate so we can see Stableyard's real spread.
   const data = result.data as {
      payment?: { id?: string; destination?: { merchant?: { name?: string } | null } };
      nextAction?: { depositInstructions?: { amount?: string; assetCode?: string } } | null;
   };
   const usdc = Number(data?.nextAction?.depositInstructions?.amount);
   const market = await marketRate(rules.currency);
   const fairUsdc = market ? Number(amount) / market.rate : null;
   const quote = {
      usdc: Number.isFinite(usdc) ? usdc : null,
      marketRate: market?.rate ?? null,
      marketRateAt: market?.at ?? null,
      fairUsdc,
      spreadPct: fairUsdc && Number.isFinite(usdc) ? (usdc / fairUsdc - 1) * 100 : null
   };
   const merchant = data?.payment?.destination?.merchant?.name ?? String(body.merchant ?? '').slice(0, 120);
   const { error: logError } = await admin.from('stableyard_qr_quotes').insert({
      user_id: userId,
      payment_id: data?.payment?.id ?? null,
      country,
      fiat_currency: rules.currency,
      fiat_amount: Number(amount),
      usdc_amount: quote.usdc,
      market_rate: quote.marketRate,
      market_rate_at: quote.marketRateAt,
      merchant_name: merchant || null
   });
   if (logError) console.error('[stableyard-deposit-address] log qr quote failed', logError.message);
   return json({ ok: true, accountId, step: 'create', result: result.data, quote });
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
   // Stableyard's signed webhook deliveries share this function (edge-function cap); they carry no JWT.
   if (isStableyardWebhook(req)) return handleStableyardWebhook(req);
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

   const isAdmin = async () => {
      const { data: adminRow } = await admin
         .from('admin_users')
         .select('user_id')
         .eq('user_id', userId)
         .eq('active', true)
         .in('role', ['owner', 'admin'])
         .maybeSingle();
      return Boolean(adminRow);
   };
   // QR payments (and the email + KYC they need) are for admins and the people in stableyard_qr_testers,
   // even once deposits go public.
   const isQrTester = async () => {
      if (await isAdmin()) return true;
      const { data: tester } = await admin.from('stableyard_qr_testers').select('user_id').eq('user_id', userId).maybeSingle();
      return Boolean(tester);
   };

   const body = await req.json().catch(() => ({}));
   const refresh = Boolean(body?.refresh);
   const isQr = QR_ACTIONS.has(String(body?.qr ?? ''));
   const isOnboarding = ONBOARDING_ACTIONS.has(String(body?.onboarding ?? ''));

   if (isQr || isOnboarding) {
      if (!(await isQrTester())) return json({ error: 'Forbidden: not a QR payment tester', code: 'not_tester' }, 403);
   } else if (Deno.env.get('STABLEYARD_DEPOSITS_PUBLIC') !== 'true' && !(await isAdmin())) {
      return json({ enabled: false, addresses: [], deposits: [] });
   }

   if (isQr) {
      try {
         return await handleQr(admin, userId, String(body.qr), body);
      } catch (err) {
         console.error('[stableyard-deposit-address] qr error', (err as Error).message);
         return json({ error: 'Stableyard QR payments are unavailable right now.' }, 500);
      }
   }

   if (isOnboarding) {
      try {
         return await handleOnboarding(admin, userId, String(userData.user?.email ?? '').trim(), String(body.onboarding), body);
      } catch (err) {
         console.error('[stableyard-deposit-address] onboarding error', err);
         return json({ error: 'Stableyard onboarding is unavailable right now.' }, 500);
      }
   }

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

      // While deposits are admin-only, also issue a Base address so admins can test the full pipeline
      // (deposit → webhook → wallet) with USDC they already hold on Base. Borrowers never get Base here:
      // on Base they send straight to their own wallet, free.
      const testMode = Deno.env.get('STABLEYARD_DEPOSITS_PUBLIC') !== 'true';
      const wanted = testMode ? [...configuredDepositChainIds(), BASE_CHAIN_ID] : configuredDepositChainIds();
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
