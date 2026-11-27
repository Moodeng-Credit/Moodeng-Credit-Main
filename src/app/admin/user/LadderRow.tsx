import { useCallback, useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// A borrower's credit ladder on /admin/user/:id (2026-11-27): which ceiling they're on, why, and a way for
// the team to set their own number (or clear it). public.admin_limit_ceiling / admin_set_limit_ceiling.

type Ladder = {
   ceiling: number;
   source: 'team' | 'income_proof' | 'sign_up';
   monthly_php?: number | null;
   proof_until?: string | null;
   answered?: boolean;
   team_ceiling?: number | null;
   team_note?: string | null;
   team_set_at?: string | null;
};

const SOURCE: Record<Ladder['source'], string> = {
   team: 'set by the team',
   income_proof: 'from approved income proof',
   sign_up: 'from their sign-up answer'
};

export const ladderText = (l: Ladder, joinedAt?: string | null): string => {
   const trackA = Boolean(joinedAt) && Date.parse(joinedAt as string) < Date.parse('2026-10-01T00:00:00+07:00');
   const steps = trackA ? 'early member ladder, 2nd half' : l.ceiling <= 35 ? 'Limit Spin +$2–5, counts from day 7' : '$10 steps, 2nd half';
   const top = l.ceiling >= 135 ? 'no top' : `top $${l.ceiling}`;
   const extra =
      l.source === 'income_proof' && l.monthly_php
         ? ` · shows ₱${Math.round(l.monthly_php).toLocaleString('en-US')}/month${l.proof_until ? `, counts until ${l.proof_until}` : ''}`
         : l.source === 'sign_up' && l.answered === false
           ? ' · never answered income (default)'
           : l.source === 'team' && l.team_note
             ? ` · "${l.team_note}"`
             : '';
   return `${top} · ${steps} (${SOURCE[l.source]})${extra}`;
};

export default function LadderRow({ userId, joinedAt }: { userId: string; joinedAt?: string | null }) {
   const [ladder, setLadder] = useState<Ladder | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [value, setValue] = useState('');
   const [note, setNote] = useState('');
   const [isSaving, setIsSaving] = useState(false);

   const load = useCallback(async () => {
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('admin_limit_ceiling' as never, { p_user: userId } as never);
      if (rpcError) setError(rpcError.message);
      else setLadder(data as Ladder);
   }, [userId]);

   useEffect(() => {
      void load();
   }, [load]);

   const save = async (ceiling: number | null) => {
      setIsSaving(true);
      setError(null);
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc(
         'admin_set_limit_ceiling' as never,
         { p_user: userId, p_ceiling: ceiling, p_note: note || null } as never
      );
      setIsSaving(false);
      if (rpcError) {
         setError(rpcError.message);
         return;
      }
      setLadder(data as Ladder);
      setValue('');
      setNote('');
   };

   return (
      <div className="border-b border-[#2a1453] py-2 text-sm last:border-b-0">
         <div className="flex gap-3">
            <span className="w-36 shrink-0 text-[#a89bb8]">Ladder</span>
            <span className="min-w-0 flex-1 break-words font-bold text-white">
               {ladder ? ladderText(ladder, joinedAt) : error ? `⚠️ ${error}` : '…'}
            </span>
         </div>
         <div className="mt-2 flex flex-wrap items-center gap-2 pl-[9.75rem]">
            <input
               type="number"
               min={15}
               max={140}
               step={1}
               value={value}
               onChange={(event) => setValue(event.target.value)}
               placeholder="Top $"
               className="w-24 rounded-lg border border-[#2a1453] bg-[#14062b] px-2 py-1 text-white"
            />
            <input
               value={note}
               onChange={(event) => setNote(event.target.value)}
               placeholder="Why (optional)"
               className="min-w-0 flex-1 rounded-lg border border-[#2a1453] bg-[#14062b] px-2 py-1 text-white"
            />
            <button
               type="button"
               disabled={isSaving || !value}
               onClick={() => void save(Number(value))}
               className="rounded-lg bg-[#6b55f7] px-3 py-1 font-bold text-white disabled:opacity-50"
            >
               Set top
            </button>
            {ladder?.team_ceiling != null ? (
               <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void save(null)}
                  className="rounded-lg bg-[#34234f] px-3 py-1 font-bold text-[#d9c9f5]"
               >
                  Clear (use their income)
               </button>
            ) : null}
         </div>
         {error && ladder ? <p className="mt-1 pl-[9.75rem] text-xs text-red-300">⚠️ {error}</p> : null}
      </div>
   );
}
