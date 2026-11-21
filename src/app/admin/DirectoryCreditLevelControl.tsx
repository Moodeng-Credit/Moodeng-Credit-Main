'use client';

import { useEffect, useState } from 'react';

import { type AdminDirectoryUser, shiftAdminCreditLevel } from '@/app/admin/adminSupabase';
import { useAdminLive } from '@/app/admin/useAdminLive';
import { MAX_CREDIT_LIMIT, STARTING_CREDIT_LIMIT } from '@/config/creditTiers';

// Move a borrower's credit limit one ladder step ($10) up or down from their Directory card — for
// mistakes, or a level-up they got by repaying early. The server (admin-call-approvals
// 'credit_level') does the step, so the ladder lives in one place, and posts a note to Discord.

type CreditUser = Pick<AdminDirectoryUser, 'id' | 'username' | 'user_role' | 'cs'>;

const effective = (cs: number | null | undefined) => Math.min(Math.max(Number(cs ?? 0) || 0, STARTING_CREDIT_LIMIT), MAX_CREDIT_LIMIT);

export default function DirectoryCreditLevelControl({ user }: { user: CreditUser }) {
   const [cs, setCs] = useState(user.cs);
   const [busy, setBusy] = useState(false);
   const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
   const live = useAdminLive();

   useEffect(() => setCs(user.cs), [user.cs]);

   if (user.user_role === 'lender') return null;

   const limit = effective(cs);

   const shift = async (direction: 'up' | 'down') => {
      if (!window.confirm(`Move ${user.username}'s credit limit one level ${direction} from $${limit}?`)) return;
      setBusy(true);
      setMessage(null);
      try {
         const result = await shiftAdminCreditLevel(user.id, direction);
         if (result.ok) {
            if (result.cs !== undefined) setCs(result.cs);
            live?.markChanged(user.id, 'Credit limit changed');
         }
         setMessage({ ok: result.ok, text: result.summary });
      } catch (err) {
         setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save.' });
      } finally {
         setBusy(false);
      }
   };

   const base = 'rounded-xl border border-[#3d1f6e] px-3 py-1.5 text-base font-black text-white hover:bg-[#2a1453] disabled:opacity-40';

   return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
         <span className="text-base font-black text-[#c9a7ff]">Credit limit ${limit}</span>
         <button type="button" disabled={busy || limit <= STARTING_CREDIT_LIMIT} onClick={() => shift('down')} className={base}>
            − 1 level
         </button>
         <button type="button" disabled={busy || limit >= MAX_CREDIT_LIMIT} onClick={() => shift('up')} className={base}>
            + 1 level
         </button>
         {message ? (
            <span className={`w-full text-sm font-bold ${message.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{message.text}</span>
         ) : null}
      </div>
   );
}
