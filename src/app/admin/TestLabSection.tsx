'use client';

import { useState } from 'react';

import useWallet, { useActivePaymentMethod } from '@/hooks/useWallet';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import AnyNetworkDeposit from '@/views/repay/AnyNetworkDeposit';

// Admin → More → Test lab: a place to try things for real before people do. Tools: the Stableyard
// credential check, email + KYC setup for your own Stableyard account, a Stableyard External QR
// payment test, a bank payout (off-ramp) test, and a Stableyard deposit test. (The old Semaphore SMS tools were removed on
// 2026-10-20: Moodeng no longer uses Semaphore, and its error replies blanked this whole page.)

const cardClass = 'space-y-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4 sm:p-5';
const smallButton = 'rounded-lg border border-[#2a1453] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60';

type StableyardCheck = { ok: boolean; stableyardStatus?: number; error?: string; code?: string | null; partner?: unknown };

// Stableyard credential check (GET /v2/partners/config via the stableyard-partner-check function —
// Stableyard's email says /v2/partners/me, which 404s). A 200 is what Stableyard asks to see before
// going live; the summary shows which modules and deposit networks are live for our app.
function StableyardCheckCard() {
   const [checking, setChecking] = useState(false);
   const [result, setResult] = useState<StableyardCheck | null>(null);

   const runCheck = async (raw = false) => {
      setChecking(true);
      const { data, error } = await getSupabaseBrowserClient().functions.invoke('stableyard-partner-check', {
         body: raw ? { raw: true } : {}
      });
      let next = data as StableyardCheck | null;
      if (error) {
         const context = (error as { context?: { json?: () => Promise<StableyardCheck> } }).context;
         next = (await context?.json?.().catch(() => null)) ?? { ok: false, error: error.message };
      }
      setResult(next ?? { ok: false, error: 'No response' });
      setChecking(false);
   };

   return (
      <div className={cardClass}>
         <div className="flex items-center justify-between gap-3">
            <p className="text-base font-bold text-white">Stableyard</p>
            <div className="flex gap-2">
               <button type="button" onClick={() => void runCheck(true)} disabled={checking} className={smallButton}>
                  Full config
               </button>
               <button type="button" onClick={() => void runCheck()} disabled={checking} className={smallButton}>
                  {checking ? 'Checking…' : 'Check credentials'}
               </button>
            </div>
         </div>
         {result ? (
            <>
               <p className={`text-sm font-semibold ${result.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                  {result.ok
                     ? `Connected (HTTP ${result.stableyardStatus}). Tell Stableyard GET /v2/partners/config returns 200.`
                     : `Failed${result.stableyardStatus ? ` (HTTP ${result.stableyardStatus})` : ''}: ${result.error}`}
               </p>
               <pre className="max-h-64 overflow-auto rounded-xl border border-[#2a1453] p-3 text-xs text-[#a89bb8]">
                  {JSON.stringify(result.ok ? result.partner : { code: result.code ?? null }, null, 2)}
               </pre>
            </>
         ) : (
            <p className="text-sm text-[#a89bb8]">Calls GET /v2/partners/config with the production credentials.</p>
         )}
      </div>
   );
}

type OnboardingResult = {
   ok?: boolean;
   step?: string;
   accountId?: string;
   error?: string;
   stableyardStatus?: number;
   code?: string | null;
   requestId?: string | null;
   result?: { challenge?: { id?: string }; verificationUrl?: string; nextAction?: { type?: string } };
   email?: unknown;
   kyc?: { current?: { status?: string; verificationUrl?: string } };
   response?: unknown;
};

// Stableyard QR payments need the account owner to verify their email and pass KYC first. This runs
// those steps for YOUR account (stableyard-deposit-address, onboarding actions). The code goes to your
// Moodeng sign-in email; the KYC link is for you to open and finish yourself.
function StableyardOnboardingCard() {
   const [busy, setBusy] = useState<string | null>(null);
   const [result, setResult] = useState<OnboardingResult | null>(null);
   const [challengeId, setChallengeId] = useState('');
   const [code, setCode] = useState('');

   const run = async (onboarding: string, extra: Record<string, string> = {}) => {
      setBusy(onboarding);
      const { data, error } = await getSupabaseBrowserClient().functions.invoke('stableyard-deposit-address', {
         body: { onboarding, ...extra }
      });
      let next = data as OnboardingResult | null;
      if (error) {
         const context = (error as { context?: { json?: () => Promise<OnboardingResult> } }).context;
         next = (await context?.json?.().catch(() => null)) ?? { ok: false, error: error.message };
      }
      const challenge = next?.result?.challenge?.id;
      if (challenge) setChallengeId(challenge);
      setResult(next ?? { ok: false, error: 'No response' });
      setBusy(null);
   };

   const kycUrl = result?.result?.verificationUrl ?? result?.kyc?.current?.verificationUrl;
   const failed = result && !result.ok;

   return (
      <div className={cardClass}>
         <div className="flex items-center justify-between gap-3">
            <p className="text-base font-bold text-white">Stableyard email + KYC (QR payments)</p>
            <button type="button" onClick={() => void run('status')} disabled={busy !== null} className={smallButton}>
               {busy === 'status' ? 'Checking…' : 'Check status'}
            </button>
         </div>
         <p className="text-sm text-[#a89bb8]">
            For YOUR Stableyard account. 1) Send a code to your sign-in email. 2) Enter it. 3) Start KYC and finish it yourself on your
            phone. &quot;Share my Didit KYC&quot; mints a Didit Reusable KYC token for Stableyard (needs their Didit app ID in the vault).
         </p>
         <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void run('email_start')} disabled={busy !== null} className={smallButton}>
               {busy === 'email_start' ? 'Sending…' : '1. Send email code'}
            </button>
            <input
               value={code}
               onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
               inputMode="numeric"
               placeholder="6-digit code"
               className="w-28 rounded-lg border border-[#2a1453] bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-[#a89bb8]"
            />
            <button
               type="button"
               onClick={() => void run('email_confirm', { challengeId, code })}
               disabled={busy !== null || !challengeId || code.length !== 6}
               className={smallButton}
            >
               {busy === 'email_confirm' ? 'Confirming…' : '2. Confirm code'}
            </button>
            <button type="button" onClick={() => void run('kyc_start')} disabled={busy !== null} className={smallButton}>
               {busy === 'kyc_start' ? 'Starting…' : '3. Start KYC'}
            </button>
            <button type="button" onClick={() => void run('didit_share')} disabled={busy !== null} className={smallButton}>
               {busy === 'didit_share' ? 'Sharing…' : 'Share my Didit KYC'}
            </button>
         </div>
         {kycUrl ? (
            <a href={kycUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-emerald-300 underline">
               Open your KYC verification
            </a>
         ) : null}
         {result ? (
            <>
               <p className={`text-sm font-semibold ${failed ? 'text-red-300' : 'text-emerald-300'}`}>
                  {failed
                     ? `Failed${result.stableyardStatus ? ` (HTTP ${result.stableyardStatus})` : ''}: ${result.error}${
                          result.requestId ? ` · request ID ${result.requestId}` : ''
                       }`
                     : `Done: ${result.step}${result.result?.nextAction?.type ? ` · next: ${result.result.nextAction.type}` : ''}`}
               </p>
               <pre className="max-h-64 overflow-auto rounded-xl border border-[#2a1453] p-3 text-xs text-[#a89bb8]">
                  {JSON.stringify(result, null, 2)}
               </pre>
            </>
         ) : null}
      </div>
   );
}

type DepositInstructions = { address: string; chainId: number; tokenAddress: string; assetCode: string; decimals: number; amount: string };

type QrResult = {
   ok?: boolean;
   step?: string;
   error?: string;
   stableyardStatus?: number;
   code?: string | null;
   requestId?: string | null;
   result?: {
      payment?: { id?: string; status?: string; destination?: { merchant?: { name?: string } | null } };
      nextAction?: { type?: string; depositInstructions?: DepositInstructions } | null;
      merchant?: { displayName?: string };
   };
   [key: string]: unknown;
};

const BASE_CHAIN_ID = 8453;
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

// Stableyard External QR payment test: pay a PH/VN merchant QR in pesos/dong with USDC from YOUR
// Moodeng wallet. Decode and create move no money; only "Send" does, after a confirm. Personal QRs
// (a friend's GCash) are rejected by Stableyard: use a store's QR Ph. Capped at ₱2,000 / ₫1,000,000.
function StableyardQrCard() {
   const { payUsdc } = useWallet();
   const paymentMethod = useActivePaymentMethod();
   const [busy, setBusy] = useState<string | null>(null);
   const [result, setResult] = useState<QrResult | null>(null);
   const [country, setCountry] = useState<'PH' | 'VN'>('PH');
   const [qrPayload, setQrPayload] = useState('');
   const [amount, setAmount] = useState('');
   const [paymentId, setPaymentId] = useState('');
   const [deposit, setDeposit] = useState<DepositInstructions | null>(null);
   const [sentHash, setSentHash] = useState('');

   const run = async (qr: string, extra: Record<string, string> = {}) => {
      setBusy(qr);
      const { data, error } = await getSupabaseBrowserClient().functions.invoke('stableyard-deposit-address', {
         body: { qr, ...extra }
      });
      let next = data as QrResult | null;
      if (error) {
         const context = (error as { context?: { json?: () => Promise<QrResult> } }).context;
         next = (await context?.json?.().catch(() => null)) ?? { ok: false, error: error.message };
      }
      const id = next?.result?.payment?.id;
      if (id) setPaymentId(id);
      const instructions = next?.result?.nextAction?.depositInstructions;
      if (qr === 'create' || qr === 'get') setDeposit(instructions ?? null);
      setResult(next ?? { ok: false, error: 'No response' });
      setBusy(null);
   };

   // Only offer the in-app send for USDC on Base, which is what the Moodeng wallet holds.
   const canSend =
      deposit !== null &&
      deposit.chainId === BASE_CHAIN_ID &&
      deposit.tokenAddress.toLowerCase() === BASE_USDC &&
      deposit.decimals === 6 &&
      !sentHash;

   const send = async () => {
      if (!deposit) return;
      const merchant = result?.result?.payment?.destination?.merchant?.name ?? 'the merchant';
      if (
         !window.confirm(
            `Send ${deposit.amount} USDC from your Moodeng wallet to pay ${amount} ${country === 'PH' ? 'PHP' : 'VND'} to ${merchant}?`
         )
      ) {
         return;
      }
      setBusy('send');
      const outcome = await payUsdc({
         method: paymentMethod,
         to: deposit.address,
         usdAmount: deposit.amount,
         loanId: `stableyard-qr:${paymentId}`
      });
      if (outcome) setSentHash(outcome.hash);
      setBusy(null);
   };

   const failed = result && !result.ok;
   const qrReady = qrPayload.trim().length > 0;

   return (
      <div className={cardClass}>
         <div className="flex items-center justify-between gap-3">
            <p className="text-base font-bold text-white">Stableyard QR payment (test)</p>
            <button type="button" onClick={() => void run('status')} disabled={busy !== null} className={smallButton}>
               {busy === 'status' ? 'Checking…' : 'Check setup'}
            </button>
         </div>
         <p className="text-sm text-[#a89bb8]">
            Pay a store&apos;s QR Ph (or Vietnam QR) with USDC from YOUR Moodeng wallet. Personal QRs like a friend&apos;s GCash don&apos;t
            work. Steps 1–3 move no money. Step 4 sends the USDC. Max ₱2,000 or ₫1,000,000.
         </p>
         <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void run('use_wallet')} disabled={busy !== null} className={smallButton}>
               {busy === 'use_wallet' ? 'Saving…' : '1. Pay from my Moodeng wallet'}
            </button>
            <select
               value={country}
               onChange={(event) => setCountry(event.target.value as 'PH' | 'VN')}
               className="rounded-lg border border-[#2a1453] bg-[#1c0a3a] px-2 py-1.5 text-xs text-white"
            >
               <option value="PH">Philippines (PHP)</option>
               <option value="VN">Vietnam (VND)</option>
            </select>
         </div>
         <textarea
            value={qrPayload}
            onChange={(event) => setQrPayload(event.target.value)}
            rows={3}
            placeholder="Paste the QR's text (scan it with any QR reader app and copy the text, starts with 000201…)"
            className="w-full rounded-lg border border-[#2a1453] bg-transparent px-3 py-2 font-mono text-xs text-white placeholder:text-[#a89bb8]"
         />
         <div className="flex flex-wrap items-center gap-2">
            <button
               type="button"
               onClick={() => void run('decode', { country, qrPayload })}
               disabled={busy !== null || !qrReady}
               className={smallButton}
            >
               {busy === 'decode' ? 'Reading…' : '2. Read QR'}
            </button>
            <input
               value={amount}
               onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
               inputMode="decimal"
               placeholder={country === 'PH' ? 'Amount in PHP' : 'Amount in VND'}
               className="w-32 rounded-lg border border-[#2a1453] bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-[#a89bb8]"
            />
            <button
               type="button"
               onClick={() => {
                  setSentHash('');
                  void run('create', { country, qrPayload, amount, requestKey: crypto.randomUUID() });
               }}
               disabled={busy !== null || !qrReady || !amount}
               className={smallButton}
            >
               {busy === 'create' ? 'Getting quote…' : '3. Get USDC quote'}
            </button>
         </div>
         {deposit ? (
            <div className="space-y-2 rounded-xl border border-[#2a1453] p-3 text-sm text-white">
               <p>
                  To pay, send exactly{' '}
                  <span className="font-bold">
                     {deposit.amount} {deposit.assetCode}
                  </span>{' '}
                  on {deposit.chainId === BASE_CHAIN_ID ? 'Base' : `chain ${deposit.chainId}`}.
               </p>
               {canSend ? (
                  <button
                     type="button"
                     onClick={() => void send()}
                     disabled={busy !== null}
                     className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-[#1c0a3a] disabled:opacity-60"
                  >
                     {busy === 'send' ? 'Sending…' : `4. Send ${deposit.amount} USDC`}
                  </button>
               ) : sentHash ? null : (
                  <p className="text-xs text-amber-300">Not USDC on Base, so this card can&apos;t send it. See the details below.</p>
               )}
            </div>
         ) : null}
         {sentHash ? <p className="break-all text-sm font-semibold text-emerald-300">Sent: {sentHash}</p> : null}
         {paymentId ? (
            <button type="button" onClick={() => void run('get', { paymentId })} disabled={busy !== null} className={smallButton}>
               {busy === 'get' ? 'Checking…' : `Check payment ${paymentId}`}
            </button>
         ) : null}
         {result ? (
            <>
               <p className={`text-sm font-semibold ${failed ? 'text-red-300' : 'text-emerald-300'}`}>
                  {failed
                     ? `Failed${result.stableyardStatus ? ` (HTTP ${result.stableyardStatus})` : ''}: ${result.error}${
                          result.code ? ` · ${result.code}` : ''
                       }${result.requestId ? ` · request ID ${result.requestId}` : ''}`
                     : `Done: ${result.step}${result.result?.payment?.status ? ` · payment ${result.result.payment.status}` : ''}${
                          result.result?.nextAction?.type ? ` · next: ${result.result.nextAction.type}` : ''
                       }`}
               </p>
               <pre className="max-h-64 overflow-auto rounded-xl border border-[#2a1453] p-3 text-xs text-[#a89bb8]">
                  {JSON.stringify(result, null, 2)}
               </pre>
            </>
         ) : null}
      </div>
   );
}

type BankOption = { code: string; name: string };

// Stableyard bank payout test (off-ramp): send pesos/dong to a bank account or e-wallet (GCash, Maya…)
// with USDC from YOUR Moodeng wallet. "Get quote" creates the Payment but moves no money; only "Send"
// does, after a confirm. Uses the same payment source as the QR card. ₱50–₱5,000 (₫20,000–₫2,000,000).
function StableyardBankPayoutCard() {
   const { payUsdc } = useWallet();
   const paymentMethod = useActivePaymentMethod();
   const [busy, setBusy] = useState<string | null>(null);
   const [result, setResult] = useState<QrResult | null>(null);
   const [country, setCountry] = useState<'PH' | 'VN'>('PH');
   const [banks, setBanks] = useState<BankOption[]>([]);
   const [bankCode, setBankCode] = useState('');
   const [accountNumber, setAccountNumber] = useState('');
   const [beneficiaryName, setBeneficiaryName] = useState('');
   const [amount, setAmount] = useState('');
   const [paymentId, setPaymentId] = useState('');
   const [deposit, setDeposit] = useState<DepositInstructions | null>(null);
   const [sentHash, setSentHash] = useState('');

   const run = async (qr: string, extra: Record<string, string> = {}) => {
      setBusy(qr);
      const { data, error } = await getSupabaseBrowserClient().functions.invoke('stableyard-deposit-address', {
         body: { qr, ...extra }
      });
      let next = data as QrResult | null;
      if (error) {
         const context = (error as { context?: { json?: () => Promise<QrResult> } }).context;
         next = (await context?.json?.().catch(() => null)) ?? { ok: false, error: error.message };
      }
      if (qr === 'bank_list') {
         const list = ((next?.result as { banks?: BankOption[] } | undefined)?.banks ?? []).slice();
         list.sort((a, b) => a.name.localeCompare(b.name));
         setBanks(list);
         setBankCode(list.find((bank) => bank.name === 'GCASH')?.code ?? list[0]?.code ?? '');
         // The list is long; show a short summary instead of dumping it.
         setResult(next?.ok ? { ok: true, step: `bank_list · ${list.length} banks` } : (next ?? { ok: false, error: 'No response' }));
         setBusy(null);
         return;
      }
      const id = next?.result?.payment?.id;
      if (id) setPaymentId(id);
      const instructions = next?.result?.nextAction?.depositInstructions;
      if (qr === 'bank_create' || qr === 'get') setDeposit(instructions ?? null);
      setResult(next ?? { ok: false, error: 'No response' });
      setBusy(null);
   };

   const bankName = banks.find((bank) => bank.code === bankCode)?.name ?? '';
   const currency = country === 'PH' ? 'PHP' : 'VND';
   const canSend =
      deposit !== null &&
      deposit.chainId === BASE_CHAIN_ID &&
      deposit.tokenAddress.toLowerCase() === BASE_USDC &&
      deposit.decimals === 6 &&
      !sentHash;

   const send = async () => {
      if (!deposit) return;
      if (
         !window.confirm(
            `Send ${deposit.amount} USDC from your Moodeng wallet to pay out ${amount} ${currency} to ${bankName} ••${accountNumber.slice(-4)}?`
         )
      ) {
         return;
      }
      setBusy('send');
      const outcome = await payUsdc({
         method: paymentMethod,
         to: deposit.address,
         usdAmount: deposit.amount,
         loanId: `stableyard-bank:${paymentId}`
      });
      if (outcome) {
         setSentHash(outcome.hash);
         void run('sent', { paymentId, txHash: outcome.hash });
      }
      setBusy(null);
   };

   const failed = result && !result.ok;

   return (
      <div className={cardClass}>
         <div className="flex items-center justify-between gap-3">
            <p className="text-base font-bold text-white">Stableyard bank payout (off-ramp test)</p>
            <button type="button" onClick={() => void run('status')} disabled={busy !== null} className={smallButton}>
               {busy === 'status' ? 'Checking…' : 'Check setup'}
            </button>
         </div>
         <p className="text-sm text-[#a89bb8]">
            Cash out USDC from YOUR Moodeng wallet to a bank or e-wallet (GCash, Maya…). Try your own account first. Steps 1–3 move no
            money. Step 4 sends the USDC. ₱50–₱5,000.
         </p>
         <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void run('use_wallet')} disabled={busy !== null} className={smallButton}>
               {busy === 'use_wallet' ? 'Saving…' : '1. Pay from my Moodeng wallet'}
            </button>
            <select
               value={country}
               onChange={(event) => {
                  setCountry(event.target.value as 'PH' | 'VN');
                  setBanks([]);
                  setBankCode('');
               }}
               className="rounded-lg border border-[#2a1453] bg-[#1c0a3a] px-2 py-1.5 text-xs text-white"
            >
               <option value="PH">Philippines (PHP)</option>
               <option value="VN">Vietnam (VND)</option>
            </select>
            <button type="button" onClick={() => void run('bank_list', { country })} disabled={busy !== null} className={smallButton}>
               {busy === 'bank_list' ? 'Loading…' : '2. Load banks'}
            </button>
         </div>
         {banks.length ? (
            <div className="flex flex-wrap items-center gap-2">
               <select
                  value={bankCode}
                  onChange={(event) => setBankCode(event.target.value)}
                  className="max-w-[220px] rounded-lg border border-[#2a1453] bg-[#1c0a3a] px-2 py-1.5 text-xs text-white"
               >
                  {banks.map((bank) => (
                     <option key={bank.code} value={bank.code}>
                        {bank.name}
                     </option>
                  ))}
               </select>
               <input
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 20))}
                  inputMode="numeric"
                  placeholder={bankName === 'GCASH' ? 'GCash number 09…' : 'Account number'}
                  className="w-40 rounded-lg border border-[#2a1453] bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-[#a89bb8]"
               />
               <input
                  value={beneficiaryName}
                  onChange={(event) => setBeneficiaryName(event.target.value.slice(0, 100))}
                  placeholder="Name on the account"
                  className="w-40 rounded-lg border border-[#2a1453] bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-[#a89bb8]"
               />
               <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  placeholder={`Amount in ${currency}`}
                  className="w-32 rounded-lg border border-[#2a1453] bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-[#a89bb8]"
               />
               <button
                  type="button"
                  onClick={() => {
                     setSentHash('');
                     void run('bank_create', {
                        country,
                        bankCode,
                        bankName,
                        accountNumber,
                        beneficiaryName,
                        amount,
                        requestKey: crypto.randomUUID()
                     });
                  }}
                  disabled={busy !== null || !bankCode || accountNumber.length < 6 || beneficiaryName.trim().length < 2 || !amount}
                  className={smallButton}
               >
                  {busy === 'bank_create' ? 'Getting quote…' : '3. Get USDC quote'}
               </button>
            </div>
         ) : null}
         {deposit ? (
            <div className="space-y-2 rounded-xl border border-[#2a1453] p-3 text-sm text-white">
               <p>
                  To cash out, send exactly{' '}
                  <span className="font-bold">
                     {deposit.amount} {deposit.assetCode}
                  </span>{' '}
                  on {deposit.chainId === BASE_CHAIN_ID ? 'Base' : `chain ${deposit.chainId}`}.
               </p>
               {canSend ? (
                  <button
                     type="button"
                     onClick={() => void send()}
                     disabled={busy !== null}
                     className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-[#1c0a3a] disabled:opacity-60"
                  >
                     {busy === 'send' ? 'Sending…' : `4. Send ${deposit.amount} USDC`}
                  </button>
               ) : sentHash ? null : (
                  <p className="text-xs text-amber-300">Not USDC on Base, so this card can&apos;t send it. See the details below.</p>
               )}
            </div>
         ) : null}
         {sentHash ? <p className="break-all text-sm font-semibold text-emerald-300">Sent: {sentHash}</p> : null}
         {paymentId ? (
            <button type="button" onClick={() => void run('get', { paymentId })} disabled={busy !== null} className={smallButton}>
               {busy === 'get' ? 'Checking…' : `Check payment ${paymentId}`}
            </button>
         ) : null}
         {result ? (
            <>
               <p className={`text-sm font-semibold ${failed ? 'text-red-300' : 'text-emerald-300'}`}>
                  {failed
                     ? `Failed${result.stableyardStatus ? ` (HTTP ${result.stableyardStatus})` : ''}: ${result.error}${
                          result.code ? ` · ${result.code}` : ''
                       }${result.requestId ? ` · request ID ${result.requestId}` : ''}`
                     : `Done: ${result.step}${result.result?.payment?.status ? ` · payment ${result.result.payment.status}` : ''}${
                          result.result?.nextAction?.type ? ` · next: ${result.result.nextAction.type}` : ''
                       }`}
               </p>
               <pre className="max-h-64 overflow-auto rounded-xl border border-[#2a1453] p-3 text-xs text-[#a89bb8]">
                  {JSON.stringify(result, null, 2)}
               </pre>
            </>
         ) : null}
      </div>
   );
}

export default function TestLabSection() {
   return (
      <div className="space-y-6">
         <StableyardCheckCard />
         <StableyardOnboardingCard />
         <StableyardQrCard />
         <div className={cardClass}>
            <p className="text-base font-bold text-white">Money screen (testers)</p>
            <p className="text-sm text-[#a89bb8]">
               What borrowers will see: balance, Add money (crypto now, GCash/bank coming) and Cash out to GCash or a bank.
            </p>
            <a href="/money" className={`${smallButton} inline-block`}>
               Open /money
            </a>
         </div>
         <StableyardBankPayoutCard />
         <div className={cardClass}>
            <p className="text-base font-bold text-white">Stableyard deposits (test)</p>
            <p className="text-sm text-[#a89bb8]">
               Not shown to borrowers yet. Creates a real Stableyard account + deposit addresses for YOUR account, settling as USDC on Base
               to your Moodeng wallet. Send the minimum from an exchange to try a deposit end to end.
            </p>
            <div className="rounded-2xl bg-[#f5f4fa] p-3">
               <AnyNetworkDeposit />
            </div>
         </div>
      </div>
   );
}
