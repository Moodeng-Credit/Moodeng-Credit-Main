'use client';

import { useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import AnyNetworkDeposit from '@/views/repay/AnyNetworkDeposit';

// Admin → More → Test lab: a place to try things for real before people do. Tools: the Stableyard
// credential check and a Stableyard deposit test. (The old Semaphore SMS tools were removed on
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

export default function TestLabSection() {
   return (
      <div className="space-y-6">
         <StableyardCheckCard />
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
