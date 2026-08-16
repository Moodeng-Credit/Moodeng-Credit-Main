'use client';

import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Lender-facing proof that a loan was refunded to them. RLS ("lenders read own refunds") scopes
// public.loan_refunds to the signed-in lender, so a plain select returns only their own rows.

interface RefundRow {
   id: string;
   loan_id: string;
   amount: number | string;
   coin: string | null;
   reason: string | null;
   tx_hash: string;
   created_at: string;
   loans?: { tracking_id?: string | null } | null;
}

function money(v: number | string | null | undefined): string {
   return Number(v ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function shortHash(h: string): string {
   return h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}

export default function RefundReceipts() {
   const [rows, setRows] = useState<RefundRow[] | null>(null);

   useEffect(() => {
      let active = true;
      void (async () => {
         // Embedded loans(tracking_id) is best-effort — if loans RLS hides it, we still show the refund.
         const { data, error } = await getSupabaseBrowserClient()
            .from('loan_refunds')
            .select('id, loan_id, amount, coin, reason, tx_hash, created_at, loans(tracking_id)')
            .order('created_at', { ascending: false });
         if (!active) return;
         setRows(error ? [] : ((data as unknown as RefundRow[]) ?? []));
      })();
      return () => {
         active = false;
      };
   }, []);

   if (!rows || rows.length === 0) return null;

   return (
      <section className="px-md-5 pb-md-3">
         <div className="bg-md-neutral-100 rounded-md-lg p-4 shadow-md-card flex flex-col gap-3">
            <div className="flex items-center gap-2">
               <span className="inline-flex h-6 items-center rounded-full bg-emerald-100 px-2 text-xs font-semibold text-emerald-700">Refunded</span>
               <h3 className="text-md-body font-semibold text-md-primary-2000">Money returned to you</h3>
            </div>
            {rows.map((r) => (
               <div key={r.id} className="rounded-md-lg border border-md-neutral-300 p-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                     <span className="text-md-body font-semibold text-md-primary-2000">
                        {money(r.amount)} {r.coin ?? 'USDC'} returned
                     </span>
                     <span className="text-xs text-md-neutral-700">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.loans?.tracking_id ? <span className="text-xs text-md-neutral-700">Loan {r.loans.tracking_id}</span> : null}
                  {r.reason ? <span className="text-sm text-md-neutral-800">Reason: {r.reason}</span> : null}
                  <a
                     href={`https://basescan.org/tx/${r.tx_hash}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-xs font-medium text-md-primary-900 underline break-all"
                  >
                     On-chain proof: {shortHash(r.tx_hash)}
                  </a>
               </div>
            ))}
         </div>
      </section>
   );
}
