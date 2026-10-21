'use client';

import { useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import AnyNetworkDeposit from '@/views/repay/AnyNetworkDeposit';

// Admin → More → Test lab: a place to try things for real before people do. Tools: the Stableyard
// credential check, email + KYC setup for your own Stableyard account, and a Stableyard deposit test. (The old Semaphore SMS tools were removed on
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

   const runCheck = async () => {
      setChecking(true);
      const { data, error } = await getSupabaseBrowserClient().functions.invoke('stableyard-partner-check', { body: {} });
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
            <button type="button" onClick={() => void runCheck()} disabled={checking} className={smallButton}>
               {checking ? 'Checking…' : 'Check credentials'}
            </button>
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
            phone.
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

export default function TestLabSection() {
   return (
      <div className="space-y-6">
         <StableyardCheckCard />
         <StableyardOnboardingCard />
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
