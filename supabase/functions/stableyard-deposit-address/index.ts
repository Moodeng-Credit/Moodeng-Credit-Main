import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { isPlaceholderEmail } from '../_shared/placeholderEmail.ts';
import { isStableyardConfigured, stableyard, type StableyardAccount, type StableyardDepositNetwork } from '../_shared/stableyard.ts';
import { importKycToStableyard, KYC_CONSENT_TEXT, refreshKycImport, reuseStatus } from '../_shared/stableyardKycReuse.ts';
import {
   BASE_CHAIN_ID,
   configuredDepositChainIds,
   depositAddressRow,
   pickDepositNetworks,
   syncDeposits
} from '../_shared/stableyardSync.ts';
import { handleStableyardWebhook, isStableyardWebhook } from '../_shared/stableyardWebhook.ts';
import { handleRelay, isRelayAction } from './relay.ts';

// Stableyard deposit addresses for the signed-in user ("send from any chain").
//
// POST {}                    → ensure the user's Stableyard account + addresses exist, return them
// POST { refresh: true }     → same, and re-read deposits from Stableyard first
// POST { onboarding: 'status' | 'email_start' | 'email_confirm' | 'kyc_start' | 'kyc_import' | 'kyc_import_status' | 'kyc_reuse_check' }
//                            → the caller's own account: verify its email and start KYC, which
//                              Stableyard requires before QR payments. The email is always the
//                              caller's sign-in email, never one from the client.
//                              kyc_import copies their approved Moodeng (Didit) ID check into
//                              Stableyard instead (needs { consent: true }); see _shared/stableyardKycReuse.ts.
// POST { qr: 'status' | 'use_wallet' | 'decode' | 'create' | 'get', ... }
//                            → External QR payment test for admins + stableyard_qr_testers (see handleQr).
// POST { relay: 'cashout_quote' | 'cashout_sent' | 'repay_quote' | 'status' | 'latest', ... }
//                            → Walt (Telegram wallet) bridge for the Indonesia track through Relay
//                              (Base USDC ↔ BNB Chain). Not Stableyard; see ./relay.ts.
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
const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

// "1827428" (USDC, 6 decimals) → "1.827428"
const usdcFromAtomic = (atomic: string): string => {
   const padded = atomic.padStart(7, '0');
   const fraction = padded.slice(-6).replace(/0+$/, '');
   return fraction ? `${padded.slice(0, -6)}.${fraction}` : padded.slice(0, -6);
};

type CheckoutDeposit = {
   data: Record<string, unknown>;
   optionId: string | null;
   clientSecret: string | null;
   problem?: { code: string; detail: string; status?: number; requestId?: string | null };
};

// Since 2026-11-13 Stableyard prices a QR payout but answers nextAction "payment_method" with no deposit
// address. Their flow (Raj, Stableyard): with the create response's checkout.clientSecret, list the
// payment methods, select Base USDC ("routing", 8453), and the returned option carries the Base deposit
// address and the exact amount (routing fee included). We do that here and hand the app the same
// nextAction.depositInstructions shape a bank payout gives, so the app needs no second path.
// Only the wallet linked as the account's payment source may fund it; that is the Moodeng wallet.
// The clientSecret is kept server-side (stableyard_qr_quotes) and never returned to the browser.
const withBaseDeposit = async (raw: unknown): Promise<CheckoutDeposit> => {
   const source = (raw && typeof raw === 'object' ? raw : {}) as {
      payment?: { id?: string; status?: string };
      nextAction?: { type?: string; expiresAt?: string | null } | null;
      checkout?: { clientSecret?: string } | null;
   };
   const clientSecret = typeof source.checkout?.clientSecret === 'string' ? source.checkout.clientSecret : null;
   const data: Record<string, unknown> = { ...(source as Record<string, unknown>) };
   if (source.checkout) data.checkout = { ...source.checkout, clientSecret: undefined };
   const paymentId = source.payment?.id ?? '';
   // The create response usually has no nextAction yet (a re-read then says "payment_method"), so go by
   // the payment's state: waiting for a payment method, and no other step asked of us.
   const nextType = source.nextAction?.type;
   const needsMethod = source.payment?.status === 'requires_payment_method' && (!nextType || nextType === 'payment_method');
   if (!needsMethod) return { data, optionId: null, clientSecret };

   const stop = (code: string, detail: string, status?: number, requestId?: string | null): CheckoutDeposit => ({
      data,
      optionId: null,
      clientSecret,
      problem: { code, detail, status, requestId: requestId ?? null }
   });
   // No secret = nothing we can select: leave the reply as it is and let the app re-read the payment.
   if (!clientSecret || !paymentId) {
      console.warn('[stableyard-deposit-address] payment needs a method but create gave no clientSecret', paymentId);
      return { data, optionId: null, clientSecret };
   }

   // The methods can lag the create call by a moment; give them two more tries.
   let methods = await stableyard.listCheckoutMethods(paymentId, clientSecret);
   for (let attempt = 0; attempt < 2 && (!methods.ok || !(methods.data?.paymentMethods ?? []).length); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      methods = await stableyard.listCheckoutMethods(paymentId, clientSecret);
   }
   if (!methods.ok) return stop(methods.code ?? 'payment_methods_failed', methods.error, methods.status, methods.requestId);
   const offered = methods.data?.paymentMethods ?? [];
   const onBase = offered.filter(
      (m) => m.chainId === BASE_CHAIN_ID && String(m.tokenAddress ?? '').toLowerCase() === BASE_USDC_ADDRESS && m.available !== false
   );
   const method = onBase.find((m) => m.providerCode === 'routing') ?? onBase[0];
   if (!method) {
      const seen = offered.map((m) => `${m.id}:${m.chainId}:${m.available}`).join(', ');
      return stop('base_usdc_not_offered', `no Base USDC method (offered: ${seen || 'none'})`);
   }

   // A routing option is quoted live and can take several seconds: Stableyard answers "request_in_progress"
   // meanwhile, and the same call (same Idempotency-Key) returns the option once it is ready.
   const select = () => stableyard.selectCheckoutMethod(paymentId, clientSecret, method.id, `moodeng-opt:${paymentId}`);
   let selected = await select();
   for (let attempt = 0; attempt < 8 && !selected.ok && selected.code === 'request_in_progress'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      selected = await select();
   }
   if (!selected.ok) return stop(selected.code ?? 'select_method_failed', selected.error, selected.status, selected.requestId);
   const option = selected.data?.option;
   const execution = option?.execution;
   const atomic = String(option?.payerAmount?.amountAtomic ?? execution?.amountAtomic ?? '');
   if (
      !option?.id ||
      execution?.type !== 'deposit_address' ||
      !EVM_ADDRESS.test(String(execution.address ?? '')) ||
      execution.chainId !== BASE_CHAIN_ID ||
      String(execution.tokenAddress ?? '').toLowerCase() !== BASE_USDC_ADDRESS ||
      !/^[1-9][0-9]*$/.test(atomic)
   ) {
      return stop('unexpected_option', `option ${option?.id ?? '?'} is not a Base USDC deposit address`);
   }
   if (execution.amountAtomic && execution.amountAtomic !== atomic) {
      console.warn('[stableyard-deposit-address] option amounts differ', paymentId, execution.amountAtomic, atomic);
   }

   data.nextAction = {
      id: paymentId,
      type: 'transaction',
      expiresAt: option.expiresAt ?? execution.expiresAt ?? option.actionExpiresAt ?? option.quoteExpiresAt ?? source.nextAction?.expiresAt ?? null,
      depositInstructions: {
         address: execution.address,
         chainId: BASE_CHAIN_ID,
         tokenAddress: execution.tokenAddress,
         assetCode: 'USDC',
         decimals: 6,
         amount: usdcFromAtomic(atomic),
         amountAtomic: atomic
      }
   };
   data.checkoutOption = { id: option.id, methodId: method.id, providerFee: option.providerFee ?? null };
   return { data, optionId: option.id, clientSecret };
};

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

const ONBOARDING_ACTIONS = new Set([
   'status',
   'email_start',
   'email_confirm',
   'kyc_start',
   'kyc_import',
   'kyc_import_status',
   'kyc_reuse_check'
]);

/** Email verification + KYC for the caller's own Stableyard account (needed for QR payments). */
const handleOnboarding = async (
   admin: SupabaseClient,
   userId: string,
   email: string,
   action: string,
   body: { challengeId?: unknown; code?: unknown; email?: unknown; consent?: unknown }
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
      // Telegram / LINE / phone / TikTok / guest sign-ups only have a made-up login email that can't receive
      // Stableyard's code, so the person may type a real one; it's checked by the code they get.
      const typed = String(body.email ?? '')
         .trim()
         .toLowerCase();
      const unusable = (e: string) => !e || isPlaceholderEmail(e) || /^(guest|tiktok)_[^@]+@moodeng\.(app|credit)$/i.test(e);
      if (typed && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed) || typed.length > 254 || unusable(typed)))
         return json({ code: 'bad_email', error: 'Check the email address.' }, 400);
      const target = typed || (unusable(email) ? '' : email);
      if (!target) return json({ code: 'email_needed', error: 'Type an email you can open to get the code.' }, 409);
      const result = await stableyard.startEmailVerification(accountId, target);
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
   if (action === 'kyc_reuse_check') {
      const [reuse, kyc] = await Promise.all([reuseStatus(admin, userId, accountId), stableyard.getKyc(accountId)]);
      return json({ ok: true, accountId, step: 'kyc_reuse_check', reuse, consentText: KYC_CONSENT_TEXT, kyc: kyc.ok ? kyc.data : null });
   }
   if (action === 'kyc_import' || action === 'kyc_import_status') {
      if (action === 'kyc_import') {
         if (body.consent !== true) return json({ ok: false, code: 'consent_needed', error: 'Tap Share my ID to agree.' }, 400);
         const emailStatus = await stableyard.getEmailStatus(accountId);
         if (!emailStatus.ok || !isDone(emailStatus.data))
            return json({ ok: false, code: 'email_needed', error: 'Confirm your email first.' }, 409);
      }
      const outcome =
         action === 'kyc_import' ? await importKycToStableyard(admin, userId, accountId) : await refreshKycImport(admin, userId, accountId);
      if (!outcome.ok) {
         return json(
            { ok: false, accountId, code: outcome.code, error: outcome.error, requestId: outcome.requestId ?? null },
            outcome.status
         );
      }
      return json({ ok: true, accountId, step: action, import: outcome.import, verification: outcome.verification });
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
   'payout_activate',
   'qr_cash_decode',
   'qr_cash_create'
]);

// Merchant store-QR payments (decode / create) and re-activating the payout capability stay tester-only;
// every other qr action is the GCash / bank cash-out, which is open to everyone (see isBankPayoutPublic).
const TESTER_ONLY_QR_ACTIONS = new Set(['decode', 'create', 'payout_activate']);

// E-wallets (GCash, Maya, GrabPay…) are off since 2026-11-07: Stableyard says they face scrutiny on PHP
// rails and aren't a stable payout method. Banks only, unless telegram_bot_settings.bank_payout_ewallets
// is 'on' (then the app shows its E-wallet tab again; no deploy needed).
const EWALLET_NAME =
   /GCASH|MAYA PHILIPPINES|GRABPAY|SHOPEEPAY|COINS\.PH|PALAWANPAY|TAYOCASH|TOKTOKWALLET|STARPAY|MARCOPAY|LULU MONEY|BANANAPAY|LAZADA WALLET|OMNIPAY|PAY MONGO|SPEEDYPAY|TRAXIONPAY|JUANCASH|I-REMIT|USSC|BAYAD|NATIONLINK|PDAX/i;
const ewalletPayoutsOn = async (admin: SupabaseClient) => {
   const { data } = await admin.from('telegram_bot_settings').select('value').eq('key', 'bank_payout_ewallets').maybeSingle();
   return (
      String(data?.value ?? 'off')
         .trim()
         .toLowerCase() === 'on'
   );
};

// Hide the cash-out while Stableyard can't pay out. Their bank list fails whenever their payout provider
// is down (e.g. 503 payment_provider_unavailable, 2026-11-07 ~03:00 BKK), so 'status' checks it first and
// answers enabled:false → the app hides the Withdraw card until it works again. Cached a minute per instance.
let payoutUpCache: { at: number; up: boolean } | null = null;
const bankPayoutUp = async () => {
   if (payoutUpCache && Date.now() - payoutUpCache.at < 60_000) return payoutUpCache.up;
   const result = await stableyard.listBeneficiaryBanks('PH').catch(() => ({ ok: false as const, status: 0, error: 'unreachable' }));
   const banks = result.ok ? (result.data as { banks?: unknown[] } | null)?.banks : null;
   const up = result.ok && Array.isArray(banks) && banks.length > 0;
   if (!up)
      console.warn(
         '[stableyard-deposit-address] payout down, hiding cash-out',
         result.ok ? 'no banks' : `${result.status} ${result.error}`
      );
   payoutUpCache = { at: Date.now(), up };
   return up;
};

// Cash-out to the person's own bank QR (InstaPay / QR Ph "Receive" QR), paid from their own wallet: same
// Stableyard account, setup and limits as the bank cash-out, but it goes over Stableyard's QR rail, so it can
// work while their bank payout provider is down. Open to everyone unless telegram_bot_settings.qr_cashout is
// 'off' (then testers only, no deploy).
const QR_CASHOUT_ACTIONS = new Set(['qr_cash_decode', 'qr_cash_create']);
const isQrCashoutOn = async (admin: SupabaseClient) => {
   const { data } = await admin.from('telegram_bot_settings').select('value').eq('key', 'qr_cashout').maybeSingle();
   return (
      String(data?.value ?? 'on')
         .trim()
         .toLowerCase() !== 'off'
   );
};

/** Bank cash-out is public unless telegram_bot_settings.bank_payout_public is 'off' (kill switch, no deploy). */
const isBankPayoutPublic = async (admin: SupabaseClient) => {
   const { data } = await admin.from('telegram_bot_settings').select('value').eq('key', 'bank_payout_public').maybeSingle();
   return (
      String(data?.value ?? 'on')
         .trim()
         .toLowerCase() !== 'off'
   );
};

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
 *   qr_cash_decode / qr_cash_create → decode / create for a cash-out to the person's own bank QR
 *                (public, bank cash-out limits); Stableyard decides which QRs it takes
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
      // Set by the router for 'status': whether Stableyard's bank payout and the QR cash-out are up.
      bankUp?: unknown;
      qrCashout?: unknown;
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
   // 'status' must always carry the bankUp / qrCashout flags: the app hides the cash-out cards without
   // them, and the account (plus the email + Share my ID setup) is only made when the person taps a card.
   // Without this, everyone who hadn't set up yet never saw the QR card (2026-11-13).
   const statusFlags = { bankUp: body.bankUp !== false, qrCashout: body.qrCashout === true };
   if (!accountId && action === 'status') return json({ ok: true, step: 'status', noAccount: true, kyc: null, ...statusFlags });
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

   // The payment exists but we couldn't get its Base deposit address: say so plainly instead of leaving
   // the app waiting on a price that will never come.
   const depositProblem = (problem: NonNullable<CheckoutDeposit['problem']>) => {
      console.warn('[stableyard-deposit-address] no Base deposit', problem.code, problem.status, problem.requestId, problem.detail);
      return json(
         {
            ok: false,
            accountId,
            error: 'Could not get a price right now. Try again in a minute.',
            code: problem.code,
            detail: problem.detail,
            requestId: problem.requestId ?? null
         },
         502
      );
   };

   if (action === 'status') {
      const [source, kyc] = await Promise.all([stableyard.getPaymentSource(accountId), stableyard.getKyc(accountId)]);
      // A Stableyard hiccup on this read shouldn't hide the cash-out cards: still send the flags.
      if (!source.ok) {
         console.warn('[stableyard-deposit-address] status: payment source read failed', source.status, source.error);
         return json({ ok: true, accountId, step: 'status', paymentSource: null, kyc: kyc.ok ? kyc.data : null, ...statusFlags });
      }
      return json({
         ok: true,
         accountId,
         step: 'status',
         paymentSource: source.data,
         kyc: kyc.ok ? kyc.data : null,
         ...statusFlags
      });
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
      // Stableyard: offer a bank rail only when eligibility is `eligible` (an import can be `approved`
      // before the review clears). Older bodies without eligibility fall back to the status.
      const eligibility = kyc.ok
         ? String((kyc.data as { current?: { eligibility?: { status?: string } } })?.current?.eligibility?.status ?? '')
         : '';
      const kycApproved = kyc.ok && (eligibility ? eligibility === 'eligible' : DONE_STATUSES.has(kycStatus.toLowerCase()));
      const reuse = kycApproved ? null : await reuseStatus(admin, userId, accountId).catch(() => null);
      return json({
         ok: true,
         accountId,
         step: 'setup',
         emailVerified: email.ok && isDone(email.data),
         kycStatus,
         kycEligibility: eligibility || null,
         kycApproved,
         reuseAvailable: Boolean(reuse?.available),
         reuseImportStatus: reuse?.lastImport?.status ?? null,
         consentText: reuse?.available ? KYC_CONSENT_TEXT : null,
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
      const { data: quoteRows } = await admin
         .from('stableyard_qr_quotes')
         .update({ sent_tx_hash: txHash })
         .eq('user_id', userId)
         .eq('payment_id', paymentId)
         .select('option_id, checkout_secret');
      // A payment funded through a checkout option (see withBaseDeposit) is only matched once we report
      // the payer's transaction. Safe to repeat: calling 'sent' again re-submits the same hash.
      const quoteRow = (quoteRows ?? [])[0] as { option_id?: string | null; checkout_secret?: string | null } | undefined;
      let submitted: boolean | null = null;
      if (quoteRow?.option_id && quoteRow.checkout_secret) {
         for (let attempt = 0; attempt < 3 && !submitted; attempt += 1) {
            if (attempt) await new Promise((resolve) => setTimeout(resolve, 2000));
            const report = await stableyard.submitCheckoutTransaction(paymentId, quoteRow.checkout_secret, quoteRow.option_id, txHash);
            submitted = report.ok;
            if (!report.ok) {
               console.error(
                  '[stableyard-deposit-address] submit transaction failed',
                  paymentId,
                  report.status,
                  report.code,
                  report.requestId,
                  report.error
               );
            }
         }
      }
      return json({ ok: true, accountId, step: 'sent', submitted });
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
      if (!result.ok) return fail(result);
      const ewallets = await ewalletPayoutsOn(admin);
      const data = (result.data ?? {}) as { banks?: Array<{ name?: string }> };
      const banks = Array.isArray(data.banks) ? data.banks.filter((b) => ewallets || !EWALLET_NAME.test(String(b.name ?? ''))) : data.banks;
      return json({ ok: true, accountId, step: 'bank_list', ewallets, result: { ...data, banks } });
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
      // Older app versions still list e-wallets; refuse them while they're off (see EWALLET_NAME).
      if (EWALLET_NAME.test(String(body.bankName ?? '')) && !(await ewalletPayoutsOn(admin))) {
         return json({ error: 'E-wallets are paused for now. Pick a bank.', code: 'ewallets_paused' }, 400);
      }
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
      const resolved = await withBaseDeposit(result.data);
      if (resolved.problem) return depositProblem(resolved.problem);

      const data = resolved.data as {
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
         merchant_name: `Bank payout: ${bankName} ••${accountNumber.slice(-4)}`,
         option_id: resolved.optionId,
         checkout_secret: resolved.optionId ? resolved.clientSecret : null
      });
      if (logError) console.error('[stableyard-deposit-address] log bank quote failed', logError.message);
      return json({ ok: true, accountId, step: 'bank_create', result: resolved.data, quote });
   }

   const qrPayload = String(body.qrPayload ?? '').trim();
   if (!qrPayload || qrPayload.length > 4096) return json({ error: 'Paste the QR text (1–4096 characters).' }, 400);

   if (action === 'decode' || action === 'qr_cash_decode') {
      const result = await stableyard.decodeQr(accountId, country, qrPayload);
      if (result.ok) return json({ ok: true, accountId, step: action, result: result.data });
      // Stableyard's decode-qr broke on 2026-11-11 (409 "complete_offramp_readiness"); Stableyard said to skip
      // it and go straight to the payment. A real refusal (personal_qr_not_supported etc.) still shows; on a
      // readiness/server error, read the name printed in the QR (EMVCo tag 59) so the next step still knows
      // whose QR it is. The payment call does the real check.
      const local = result.code === 'personal_qr_not_supported' ? null : readEmvName(qrPayload);
      if (local && (result.status === 409 || result.status >= 500)) {
         console.warn('[stableyard-deposit-address] decode-qr failed, using local read', result.status, result.code, result.requestId);
         return json({ ok: true, accountId, step: action, localDecode: true, result: { merchant: { name: local, displayName: local } } });
      }
      return fail(result);
   }

   // create / qr_cash_create
   const cashout = action === 'qr_cash_create';
   const amount = String(body.amount ?? '').trim();
   if (!FIAT_AMOUNT.test(amount) || Number(amount) <= 0) return json({ error: 'Enter an amount like 100 or 100.50.' }, 400);
   if (cashout) {
      if (Number(amount) < BANK_MIN[country]) return json({ error: `The minimum is ${BANK_MIN[country]} ${rules.currency}.` }, 400);
      if (Number(amount) > BANK_MAX[country]) return json({ error: `The maximum for now is ${BANK_MAX[country]} ${rules.currency}.` }, 400);
   } else if (Number(amount) > rules.max) return json({ error: `Test payments are capped at ${rules.max} ${rules.currency}.` }, 400);
   // One key per press from the client, so a double-tap can't create two Payments.
   const requestKey = String(body.requestKey ?? '').trim();
   if (!/^[A-Za-z0-9-]{8,64}$/.test(requestKey)) return json({ error: 'Missing request key.' }, 400);
   const result = await stableyard.createQrPayment(
      accountId,
      { country, qrPayload, amount, currency: rules.currency },
      `moodeng-qr:${accountId}:${requestKey}`
   );
   if (!result.ok) return fail(result);
   const resolved = await withBaseDeposit(result.data);
   if (resolved.problem) return depositProblem(resolved.problem);

   // Log the quote next to the market rate so we can see Stableyard's real spread.
   const data = resolved.data as {
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
   // A cash-out QR names a person: log only that it was one, never their name.
   const merchant = cashout ? 'QR cash-out' : (data?.payment?.destination?.merchant?.name ?? String(body.merchant ?? '').slice(0, 120));
   const { error: logError } = await admin.from('stableyard_qr_quotes').insert({
      user_id: userId,
      payment_id: data?.payment?.id ?? null,
      country,
      fiat_currency: rules.currency,
      fiat_amount: Number(amount),
      usdc_amount: quote.usdc,
      market_rate: quote.marketRate,
      market_rate_at: quote.marketRateAt,
      merchant_name: merchant || null,
      option_id: resolved.optionId,
      checkout_secret: resolved.optionId ? resolved.clientSecret : null
   });
   if (logError) console.error('[stableyard-deposit-address] log qr quote failed', logError.message);
   return json({ ok: true, accountId, step: action, result: resolved.data, quote });
};

// EMVCo QR (QR Ph): "ID(2) LEN(2) VALUE" records. Returns the payee name (tag 59), or null if it isn't one.
const readEmvName = (payload: string): string | null => {
   if (!payload.startsWith('000201')) return null;
   let i = 0;
   while (i + 4 <= payload.length) {
      const id = payload.slice(i, i + 2);
      const len = Number(payload.slice(i + 2, i + 4));
      if (!Number.isInteger(len) || i + 4 + len > payload.length) return null;
      if (id === '59') return payload.slice(i + 4, i + 4 + len).trim() || null;
      i += 4 + len;
   }
   return null;
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

   const body = await req.json().catch(() => ({}));

   // Walt bridge through Relay (Indonesia track). Doesn't use Stableyard, so it runs before the
   // Stableyard switches below. See ./relay.ts.
   if (isRelayAction(body?.relay)) {
      const relayAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const relayToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      if (!relayToken) return json({ error: 'Missing authorization token' }, 401);
      const { data: relayUser, error: relayUserError } = await relayAdmin.auth.getUser(relayToken);
      if (relayUserError || !relayUser?.user?.id) return json({ error: 'Authentication required' }, 401);
      return handleRelay(relayAdmin, relayUser.user.id, String(body.relay), body, json);
   }

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
   // Store-QR payments and the admin payout tools stay with admins + stableyard_qr_testers.
   const isQrTester = async () => {
      if (await isAdmin()) return true;
      const { data: tester } = await admin.from('stableyard_qr_testers').select('user_id').eq('user_id', userId).maybeSingle();
      return Boolean(tester);
   };

   const refresh = Boolean(body?.refresh);
   const isQr = QR_ACTIONS.has(String(body?.qr ?? ''));
   const isOnboarding = ONBOARDING_ACTIONS.has(String(body?.onboarding ?? ''));

   if (isQr || isOnboarding) {
      // GCash / bank cash-out (and the email + ID setup it needs) is open to every signed-in borrower
      // since 2026-11-07. Kill switch: telegram_bot_settings bank_payout_public = 'off' → testers only again.
      const qrAction = String(body?.qr ?? '');
      const testerOnly =
         isQr && (TESTER_ONLY_QR_ACTIONS.has(qrAction) || (QR_CASHOUT_ACTIONS.has(qrAction) && !(await isQrCashoutOn(admin))));
      if ((testerOnly || !(await isBankPayoutPublic(admin))) && !(await isQrTester())) {
         return json({ error: 'Forbidden: not a QR payment tester', code: 'not_tester' }, 403);
      }
   } else if (Deno.env.get('STABLEYARD_DEPOSITS_PUBLIC') !== 'true' && !(await isAdmin())) {
      return json({ enabled: false, addresses: [], deposits: [] });
   }

   if (isQr) {
      if (String(body.qr) === 'status') {
         // Apps that know the QR cash-out send qrCashout:true and get bankUp / qrCashout back, so they can
         // still offer the QR while the bank payout is down. Older apps keep getting enabled:false then.
         const bankUp = await bankPayoutUp();
         const wantsQr = body.qrCashout === true;
         const qrOn = wantsQr && ((await isQrCashoutOn(admin)) || (await isQrTester()));
         if (!bankUp && !qrOn) return json({ enabled: false, code: 'payout_unavailable', error: 'Cash-out is unavailable right now.' });
         body.bankUp = bankUp;
         body.qrCashout = qrOn;
      }
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
