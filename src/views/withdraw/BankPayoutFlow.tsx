import { useEffect, useMemo, useRef, useState } from 'react';

import { ArrowRight, CheckCircle2, Clock, Landmark, Loader2, ShieldCheck, XCircle } from 'lucide-react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// "Straight to GCash or bank" cash-out through Stableyard (an off-ramp): the borrower picks a bank or
// e-wallet, types the account number and a peso amount, gets a USDC quote, then sends that USDC from
// their Moodeng wallet to Stableyard's escrow address, and Stableyard pays the pesos out over InstaPay.
// Everything server-side goes through stableyard-deposit-address (qr: setup / bank_list / bank_create /
// get / sent), which only answers admins + stableyard_qr_testers while this is being tested.
// Stableyard needs a verified email + its own KYC on the person's account before it pays out fiat.

const FN = 'stableyard-deposit-address';
const MIN_PHP = 50;
const MAX_PHP = 5000;
// Shown first in the bank list: what most borrowers use.
const POPULAR = ['GCASH', 'MAYA PHILIPPINES, INC./ MAYA WALLET', 'GOTYME BANK', 'BDO', 'BPI', 'GRABPAY', 'MARIBANK', 'UNIONDIGITAL BANK'];
const DONE = new Set(['succeeded', 'completed']);
const FAILED = new Set(['failed', 'cancelled', 'expired', 'refunded', 'requires_intervention']);

type Bank = { code: string; name: string };
type DepositInstructions = { address: string; chainId: number; tokenAddress: string; decimals: number; amount: string };
type FnResult = {
   ok?: boolean;
   code?: string | null;
   error?: string;
   emailVerified?: boolean;
   kycApproved?: boolean;
   kycStatus?: string;
   kycUrl?: string | null;
   sourceReady?: boolean;
   result?: {
      banks?: Bank[];
      challenge?: { id?: string };
      verificationUrl?: string;
      payment?: { id?: string; status?: string; quoteExpiresAt?: string };
      nextAction?: { expiresAt?: string | null; depositInstructions?: DepositInstructions } | null;
   };
};

const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const PREVIEW: Record<string, FnResult> = {
   setup: { ok: true, emailVerified: true, kycApproved: true, sourceReady: true },
   bank_list: {
      ok: true,
      result: { banks: POPULAR.map((name, i) => ({ code: `BLC_${i}`, name })).concat([{ code: 'BLC_X', name: 'METROBANK' }]) }
   },
   bank_create: {
      ok: true,
      result: {
         payment: { id: 'payment_preview', status: 'requires_action' },
         nextAction: {
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            depositInstructions: {
               address: '0x9f2e000000000000000000000000000000c41a',
               chainId: 8453,
               tokenAddress: BASE_USDC,
               decimals: 6,
               amount: '1.79'
            }
         }
      }
   },
   get: { ok: true, result: { payment: { id: 'payment_preview', status: 'succeeded' } } },
   sent: { ok: true }
};

async function call(isPreview: boolean, body: Record<string, string>): Promise<FnResult> {
   if (isPreview) {
      await new Promise((r) => setTimeout(r, 600));
      // ?sim=verify shows the one-time email + ID screen.
      if (body.qr === 'setup' && new URLSearchParams(window.location.search).get('sim') === 'verify') {
         return { ok: true, emailVerified: true, kycApproved: false, kycStatus: 'not_started' };
      }
      return PREVIEW[body.qr ?? body.onboarding ?? ''] ?? { ok: true };
   }
   const { data, error } = await getSupabaseBrowserClient().functions.invoke(FN, { body });
   if (!error) return (data as FnResult) ?? { ok: false, error: 'No response' };
   const context = (error as { context?: { json?: () => Promise<FnResult> } }).context;
   return (await context?.json?.().catch(() => null)) ?? { ok: false, error: error.message };
}

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const shortBank = (name: string) => (name.startsWith('MAYA PHILIPPINES') ? 'Maya' : name === 'GCASH' ? 'GCash' : name);

const inputClass =
   'w-full rounded-[14px] border border-[var(--border-card)] bg-[var(--surface)] px-[14px] py-[13px] text-[16px] text-[var(--ink)] outline-none focus:border-[var(--primary)]';
const primaryClass =
   'w-full rounded-[16px] px-[20px] py-[16px] flex items-center justify-center gap-[8px] text-[16px] font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-[var(--disabled)] disabled:cursor-not-allowed active:scale-[0.98] transition-all';
const linkClass = 'w-full text-center text-[14px] font-semibold text-[var(--primary)] py-[8px] hover:underline disabled:opacity-60';

function Panel({ children }: { children: React.ReactNode }) {
   return (
      <div
         className="rounded-[18px] border border-[var(--border-card)] bg-[var(--surface)] p-[16px] space-y-[12px]"
         style={{ boxShadow: 'var(--card-shadow)' }}
      >
         {children}
      </div>
   );
}

function ErrorLine({ text }: { text: string }) {
   return (
      <p className="rounded-[12px] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-[12px] py-[10px] text-[13px] text-[var(--danger-text)]">
         {text}
      </p>
   );
}

type Step = 'loading' | 'verify' | 'form' | 'quote' | 'sending' | 'tracking';

export default function BankPayoutFlow({
   isPreview,
   spendable,
   send,
   onDone
}: {
   isPreview: boolean;
   spendable: number | null;
   send: (
      toAddress: string,
      amount: string,
      exchange: string,
      onSubmitted?: () => void
   ) => Promise<{ hash: string; confirmed: boolean } | null>;
   onDone: () => void;
}) {
   const [step, setStep] = useState<Step>('loading');
   const [error, setError] = useState('');
   const [busy, setBusy] = useState(false);
   const [setup, setSetup] = useState<FnResult | null>(null);
   const [challengeId, setChallengeId] = useState('');
   const [code, setCode] = useState('');
   const [banks, setBanks] = useState<Bank[]>([]);
   const [bankCode, setBankCode] = useState('');
   const [accountNumber, setAccountNumber] = useState('');
   const [accountName, setAccountName] = useState('');
   const [amount, setAmount] = useState('');
   const [paymentId, setPaymentId] = useState('');
   const [deposit, setDeposit] = useState<DepositInstructions | null>(null);
   const [expiresAt, setExpiresAt] = useState<number | null>(null);
   const [now, setNow] = useState(Date.now());
   const [status, setStatus] = useState('');
   const requestKey = useRef('');

   const bank = banks.find((b) => b.code === bankCode);
   const isEwallet = bank ? /GCASH|MAYA|GRABPAY|SHOPEEPAY|COINS|PALAWANPAY/.test(bank.name) : false;
   const amountNum = Number(amount);
   const amountOk = amount !== '' && amountNum >= MIN_PHP && amountNum <= MAX_PHP;
   const nameOk = accountName.trim().length >= 2;
   const accountOk = isEwallet ? /^09\d{9}$/.test(accountNumber) : accountNumber.length >= 6;

   const sortedBanks = useMemo(() => {
      const top = POPULAR.map((name) => banks.find((b) => b.name === name)).filter((b): b is Bank => Boolean(b));
      const rest = banks.filter((b) => !POPULAR.includes(b.name)).sort((a, b) => a.name.localeCompare(b.name));
      return { top, rest };
   }, [banks]);

   const loadSetup = async () => {
      setError('');
      setStep('loading');
      const res = await call(isPreview, { qr: 'setup' });
      setSetup(res);
      if (!res.ok) {
         setError(res.code === 'no_wallet' ? 'Set up your Moodeng wallet first.' : (res.error ?? 'Could not start. Try again.'));
         setStep('verify');
         return;
      }
      if (!res.emailVerified || !res.kycApproved) {
         setStep('verify');
         return;
      }
      const list = await call(isPreview, { qr: 'bank_list', country: 'PH' });
      const all = list.result?.banks ?? [];
      setBanks(all);
      setBankCode((current) => current || all.find((b) => b.name === 'GCASH')?.code || all[0]?.code || '');
      if (!list.ok) setError(list.error ?? 'Could not load banks. Try again.');
      setStep('form');
   };

   useEffect(() => {
      void loadSetup();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Quote countdown.
   useEffect(() => {
      if (step !== 'quote') return;
      const t = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(t);
   }, [step]);

   // After the USDC is sent, follow the payout until Stableyard says it landed or failed.
   useEffect(() => {
      if (step !== 'tracking' || !paymentId || DONE.has(status) || FAILED.has(status)) return;
      const t = setTimeout(
         async () => {
            const res = await call(isPreview, { qr: 'get', paymentId });
            const next = res.result?.payment?.status;
            if (next) setStatus(next);
            else setNow(Date.now()); // re-arm the poll on a failed read
         },
         isPreview ? 1500 : 8000
      );
      return () => clearTimeout(t);
   }, [step, paymentId, status, now, isPreview]);

   const runOnboarding = async (action: string, extra: Record<string, string> = {}) => {
      setBusy(true);
      setError('');
      const res = await call(isPreview, { onboarding: action, ...extra });
      setBusy(false);
      if (!res.ok) return setError(res.error ?? 'Something went wrong. Try again.');
      if (res.result?.challenge?.id) setChallengeId(res.result.challenge.id);
      if (action === 'kyc_start' && res.result?.verificationUrl) window.open(res.result.verificationUrl, '_blank', 'noopener');
      if (action === 'email_confirm') void loadSetup();
   };

   const getQuote = async () => {
      setBusy(true);
      setError('');
      requestKey.current = crypto.randomUUID();
      const res = await call(isPreview, {
         qr: 'bank_create',
         country: 'PH',
         bankCode,
         bankName: bank?.name ?? '',
         accountNumber,
         beneficiaryName: accountName.trim(),
         amount: String(amountNum),
         requestKey: requestKey.current
      });
      setBusy(false);
      const instructions = res.result?.nextAction?.depositInstructions;
      if (!res.ok || !instructions || !res.result?.payment?.id) {
         return setError(res.error ?? 'Could not get a price right now. Try again in a minute.');
      }
      if (instructions.chainId !== 8453 || instructions.tokenAddress.toLowerCase() !== BASE_USDC || instructions.decimals !== 6) {
         return setError('This payout needs a different coin. Please contact support.');
      }
      setPaymentId(res.result.payment.id);
      setDeposit(instructions);
      const expiry = res.result.nextAction?.expiresAt ?? res.result.payment.quoteExpiresAt;
      setExpiresAt(expiry ? new Date(expiry).getTime() : null);
      setNow(Date.now());
      setStep('quote');
   };

   const usdc = deposit ? Number(deposit.amount) : 0;
   const notEnough = spendable != null && usdc > spendable;
   const secondsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null;
   const expired = secondsLeft === 0;

   const confirmSend = async () => {
      if (!deposit) return;
      setBusy(true);
      setError('');
      setStep('sending');
      try {
         const outcome = await send(deposit.address, deposit.amount, `${shortBank(bank?.name ?? 'bank')} via Stableyard`);
         if (!outcome) {
            setStep('quote');
            return;
         }
         void call(isPreview, { qr: 'sent', paymentId, txHash: outcome.hash });
         setStatus('processing');
         setStep('tracking');
      } catch (err) {
         setError((err as Error).message || 'The send did not go through. Nothing left your wallet.');
         setStep('quote');
      } finally {
         setBusy(false);
      }
   };

   const accountLabel = `${shortBank(bank?.name ?? '')} ••${accountNumber.slice(-4)}`;

   if (step === 'loading') {
      return (
         <Panel>
            <div className="flex items-center gap-[10px] text-[14px] text-[var(--text-muted)]">
               <Loader2 className="w-[18px] h-[18px] animate-spin" /> Getting things ready…
            </div>
         </Panel>
      );
   }

   if (step === 'verify') {
      const emailDone = Boolean(setup?.emailVerified);
      return (
         <div className="space-y-[12px]">
            <Panel>
               <div className="flex items-start gap-[12px]">
                  <ShieldCheck className="w-[22px] h-[22px] text-[var(--primary)] shrink-0 mt-[2px]" />
                  <div>
                     <p className="text-[16px] font-semibold text-[var(--ink)]">One-time check by our payout partner</p>
                     <p className="text-[13px] text-[var(--text-muted)] leading-[18px] mt-[4px]">
                        Stableyard sends the pesos to your GCash or bank. Before the first cash-out they need to confirm your email and ID.
                     </p>
                  </div>
               </div>
               {error ? <ErrorLine text={error} /> : null}
               <div className="space-y-[8px]">
                  <p className="text-[13px] font-semibold text-[var(--ink)]">1. Email {emailDone ? '✓' : ''}</p>
                  {!emailDone ? (
                     <>
                        <button className={primaryClass} disabled={busy} onClick={() => void runOnboarding('email_start')}>
                           {challengeId ? 'Send the code again' : 'Send me a code'}
                        </button>
                        {challengeId ? (
                           <div className="flex gap-[8px]">
                              <input
                                 value={code}
                                 onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                 inputMode="numeric"
                                 placeholder="6-digit code"
                                 className={inputClass}
                              />
                              <button
                                 className="shrink-0 rounded-[14px] px-[16px] font-semibold text-white bg-[var(--primary)] disabled:bg-[var(--disabled)]"
                                 disabled={busy || code.length !== 6}
                                 onClick={() => void runOnboarding('email_confirm', { challengeId, code })}
                              >
                                 Confirm
                              </button>
                           </div>
                        ) : null}
                     </>
                  ) : null}
                  <p className="text-[13px] font-semibold text-[var(--ink)] pt-[4px]">2. ID check {setup?.kycApproved ? '✓' : ''}</p>
                  {!setup?.kycApproved ? (
                     <button
                        className={primaryClass}
                        disabled={busy || !emailDone}
                        onClick={() => (setup?.kycUrl ? window.open(setup.kycUrl, '_blank', 'noopener') : void runOnboarding('kyc_start'))}
                     >
                        {setup?.kycStatus && setup.kycStatus !== 'not_started' ? 'Continue ID check' : 'Start ID check'}
                     </button>
                  ) : null}
                  {setup?.kycStatus === 'requires_review' || setup?.kycStatus === 'in_review' ? (
                     <p className="text-[12px] text-[var(--text-muted)]">Your ID is being reviewed. This usually takes a few minutes.</p>
                  ) : null}
               </div>
            </Panel>
            <button className={linkClass} disabled={busy} onClick={() => void loadSetup()}>
               I finished — check again
            </button>
         </div>
      );
   }

   if (step === 'form') {
      return (
         <div className="space-y-[12px]">
            <Panel>
               <label className="block">
                  <span className="text-[13px] font-semibold text-[var(--ink)]">Send to</span>
                  <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={`${inputClass} mt-[6px]`}>
                     <optgroup label="Popular">
                        {sortedBanks.top.map((b) => (
                           <option key={b.code} value={b.code}>
                              {shortBank(b.name)}
                           </option>
                        ))}
                     </optgroup>
                     <optgroup label="All banks and e-wallets">
                        {sortedBanks.rest.map((b) => (
                           <option key={b.code} value={b.code}>
                              {b.name}
                           </option>
                        ))}
                     </optgroup>
                  </select>
               </label>
               <label className="block">
                  <span className="text-[13px] font-semibold text-[var(--ink)]">
                     {isEwallet ? `${shortBank(bank?.name ?? '')} number` : 'Account number'}
                  </span>
                  <input
                     value={accountNumber}
                     onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 20))}
                     inputMode="numeric"
                     placeholder={isEwallet ? '09XX XXX XXXX' : 'Account number'}
                     className={`${inputClass} mt-[6px]`}
                  />
                  {accountNumber && !accountOk ? (
                     <span className="text-[12px] text-[var(--danger)]">
                        {isEwallet ? 'Use the 11-digit number that starts with 09.' : 'Check the account number.'}
                     </span>
                  ) : null}
               </label>
               <label className="block">
                  <span className="text-[13px] font-semibold text-[var(--ink)]">Name on the account</span>
                  <input
                     value={accountName}
                     onChange={(e) => setAccountName(e.target.value.slice(0, 100))}
                     autoComplete="name"
                     placeholder={isEwallet ? `Full name on your ${shortBank(bank?.name ?? '')}` : 'Full name on the account'}
                     className={`${inputClass} mt-[6px]`}
                  />
               </label>
               <label className="block">
                  <span className="text-[13px] font-semibold text-[var(--ink)]">Amount in pesos</span>
                  <div className="relative mt-[6px]">
                     <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[16px] text-[var(--text-muted)]">₱</span>
                     <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{0,2}).*/, '$1'))}
                        inputMode="decimal"
                        placeholder="0"
                        className={`${inputClass} pl-[30px]`}
                     />
                  </div>
                  <span className="text-[12px] text-[var(--text-faint)]">
                     {peso(MIN_PHP)}–{peso(MAX_PHP)}
                     {spendable != null ? ` · ${spendable} USDC in your wallet` : ''}
                  </span>
               </label>
               {error ? <ErrorLine text={error} /> : null}
            </Panel>
            <button
               className={primaryClass}
               disabled={busy || !bankCode || !accountOk || !nameOk || !amountOk}
               onClick={() => void getQuote()}
            >
               {busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : null}
               {busy ? 'Getting your price…' : 'See how much USDC'}
               {!busy ? <ArrowRight className="w-4 h-4" /> : null}
            </button>
            <p className="text-[12px] text-[var(--text-faint)] text-center leading-[17px]">
               Nothing leaves your wallet until you confirm on the next screen.
            </p>
         </div>
      );
   }

   if (step === 'quote' || step === 'sending') {
      return (
         <div className="space-y-[12px]">
            <Panel>
               <div className="flex items-center gap-[12px]">
                  <div className="w-[44px] h-[44px] rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                     <Landmark className="w-[22px] h-[22px] text-[var(--primary)]" />
                  </div>
                  <div>
                     <p className="text-[13px] text-[var(--text-muted)]">{accountLabel} gets</p>
                     <p className="text-[26px] font-semibold text-[var(--ink)] leading-[1.1]">{peso(amountNum)}</p>
                  </div>
               </div>
               <div className="rounded-[12px] bg-[var(--surface-2)] px-[12px] py-[10px] text-[14px] text-[var(--ink)] flex justify-between">
                  <span>You send</span>
                  <span className="font-semibold">{deposit?.amount} USDC</span>
               </div>
               {secondsLeft != null ? (
                  <p className={`text-[12px] flex items-center gap-[6px] ${expired ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>
                     <Clock className="w-[14px] h-[14px]" />
                     {expired
                        ? 'This price expired. Get a new one.'
                        : `Price held for ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
                  </p>
               ) : null}
               {notEnough ? <ErrorLine text={`You have ${spendable} USDC. Lower the peso amount and try again.`} /> : null}
               {error ? <ErrorLine text={error} /> : null}
            </Panel>
            {expired ? (
               <button className={primaryClass} disabled={busy} onClick={() => void getQuote()}>
                  Get a new price
               </button>
            ) : (
               <button className={primaryClass} disabled={busy || notEnough || spendable == null} onClick={() => void confirmSend()}>
                  {step === 'sending' ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : null}
                  {step === 'sending' ? 'Sending…' : `Cash out ${peso(amountNum)}`}
               </button>
            )}
            <button className={linkClass} disabled={busy} onClick={() => setStep('form')}>
               Change details
            </button>
         </div>
      );
   }

   // tracking
   const done = DONE.has(status);
   const failed = FAILED.has(status);
   return (
      <div className="space-y-[12px]">
         <Panel>
            <div className="flex flex-col items-center text-center gap-[10px] py-[8px]">
               {done ? (
                  <CheckCircle2 className="w-[44px] h-[44px] text-[var(--green)]" />
               ) : failed ? (
                  <XCircle className="w-[44px] h-[44px] text-[var(--danger)]" />
               ) : (
                  <Loader2 className="w-[40px] h-[40px] text-[var(--primary)] animate-spin" />
               )}
               <p className="text-[20px] font-semibold text-[var(--ink)]">
                  {done
                     ? `${peso(amountNum)} sent to ${accountLabel}`
                     : failed
                       ? 'The payout did not go through'
                       : `Sending ${peso(amountNum)} to ${accountLabel}`}
               </p>
               <p className="text-[13px] text-[var(--text-muted)] leading-[18px]">
                  {done
                     ? 'Check your app. It can take a few minutes to show.'
                     : failed
                       ? "Don't worry, your USDC is safe. Message us and we'll sort it out."
                       : 'Usually a few minutes. You can leave this page; we will keep sending it.'}
               </p>
            </div>
         </Panel>
         <button className={primaryClass} onClick={onDone}>
            Done
         </button>
      </div>
   );
}
