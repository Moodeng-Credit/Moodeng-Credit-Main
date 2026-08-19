'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   type FraudAlert,
   type FraudAlertStatus,
   listFraudAlerts,
   setFraudAlertStatus
} from './adminSupabase';

const SIGNAL_LABEL: Record<string, string> = {
   shared_wallet: 'Shared wallet',
   self_deal_wallet: 'Self-deal (same wallet both sides)',
   counterparty_shared_wallet: 'Counterparties share a wallet',
   counterparty_shared_ip: 'Counterparties share an IP',
   datacenter_ip: 'Datacenter / hosting login',
   impossible_travel: 'Impossible travel',
   subnet_cluster: 'Subnet cluster',
   shared_device: 'Shared device (one phone, many accounts)',
   application_colocation: 'Applied from same location',
   shared_payout_destination: 'Shared payout destination (mule herder)',
   fast_offramp: 'Fast off-ramp to exchange'
};

const CRITICAL = new Set([
   'self_deal_wallet',
   'counterparty_shared_wallet',
   'impossible_travel',
   'shared_device',
   'shared_payout_destination'
]);

function statusClass(s: FraudAlertStatus): string {
   if (s === 'confirmed') return 'bg-red-900/50 text-red-300';
   if (s === 'ignored') return 'bg-[#241044] text-[#a89bb8]';
   return 'bg-amber-900/50 text-amber-300';
}

// Render the alert's details jsonb as a compact human line.
function describe(a: FraudAlert): string {
   const d = a.details ?? {};
   const get = (k: string) => (d[k] == null ? '' : String(d[k]));
   switch (a.signal_type) {
      case 'shared_wallet':
         return `wallet ${get('wallet_address')} on ${get('account_count')} accounts`;
      case 'self_deal_wallet':
         return `loan ${get('tracking_id') || get('loan_id')} — same wallet both sides`;
      case 'counterparty_shared_wallet':
         return `loan ${get('tracking_id') || get('loan_id')} — shared wallet ${get('wallet')}`;
      case 'counterparty_shared_ip':
         return `loan ${get('tracking_id') || get('loan_id')} — same IP`;
      case 'datacenter_ip':
         return `${get('username')} from ${get('asn_org')} (${get('hosting_logins')}×)`;
      case 'impossible_travel':
         return `${get('username')}: ${get('location_a')} → ${get('location_b')} (${get('distance_km')}km / ${get('hours_apart')}h)`;
      case 'subnet_cluster':
         return `${get('account_count')} accounts in one block${get('asn_org') ? ` (${get('asn_org')})` : ''}`;
      case 'shared_device':
         return `${get('username')} — device shared with ${get('other_accounts')} other account(s) — loan ${get('tracking_id') || get('loan_id')}`;
      case 'application_colocation':
         return `${get('username')} — applied ${get('distance_m')}m from ${get('other_accounts')} other account(s) — loan ${get('tracking_id') || get('loan_id')}`;
      case 'shared_payout_destination':
         return `${get('borrower_count')} borrowers → ${get('destination_label') || 'the same wallet'} ${get('terminal_destination')}${d.is_exchange_deposit ? ' (exchange deposit)' : ''}`;
      case 'fast_offramp':
         return `loan ${get('loan_id')} → ${get('destination_label') || 'exchange'} ${get('hours_to_offramp')}h after funding`;
      default:
         return JSON.stringify(d).slice(0, 120);
   }
}

export default function FraudAlertQueue() {
   const [alerts, setAlerts] = useState<FraudAlert[]>([]);
   const [loading, setLoading] = useState(false);
   const [busy, setBusy] = useState<string | null>(null);
   const [filter, setFilter] = useState<FraudAlertStatus | 'all'>('open');
   const [notes, setNotes] = useState<Record<string, string>>({});

   const load = useCallback(async () => {
      setLoading(true);
      try {
         setAlerts(await listFraudAlerts());
      } catch {
         /* surfaced via empty state */
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const act = useCallback(
      async (id: string, status: FraudAlertStatus) => {
         setBusy(id);
         try {
            await setFraudAlertStatus(id, status, notes[id] ?? null);
            setAlerts((prev) =>
               prev.map((a) =>
                  a.id === id ? { ...a, review_status: status, reviewed_note: notes[id] ?? a.reviewed_note } : a
               )
            );
         } finally {
            setBusy(null);
         }
      },
      [notes]
   );

   const shown = useMemo(
      () => (filter === 'all' ? alerts : alerts.filter((a) => a.review_status === filter)),
      [alerts, filter]
   );
   const counts = useMemo(() => {
      const c = { open: 0, ignored: 0, confirmed: 0 };
      alerts.forEach((a) => (c[a.review_status] += 1));
      return c;
   }, [alerts]);

   return (
      <div className="space-y-4">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-3xl font-black">
               Alert queue <span className="text-xl font-bold text-[#a89bb8]">({counts.open} open)</span>
            </h3>
            <div className="flex items-center gap-2">
               {(['open', 'confirmed', 'ignored', 'all'] as const).map((f) => (
                  <button
                     key={f}
                     type="button"
                     onClick={() => setFilter(f)}
                     className={`rounded-full px-4 py-1.5 text-sm font-black capitalize ${filter === f ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
                  >
                     {f}
                     {f !== 'all' ? ` (${counts[f]})` : ''}
                  </button>
               ))}
               <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               >
                  {loading ? '…' : 'Refresh'}
               </button>
            </div>
         </div>

         {shown.length ? (
            <div className="space-y-3">
               {shown.map((a) => {
                  const critical = CRITICAL.has(a.signal_type);
                  return (
                     <article
                        key={a.id}
                        className={`rounded-2xl border bg-[#1c0a3a] p-5 ${critical ? 'border-red-900' : 'border-[#2a1453]'}`}
                     >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                           <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                 <span className="text-xl font-black">
                                    {SIGNAL_LABEL[a.signal_type] ?? a.signal_type}
                                 </span>
                                 {critical ? (
                                    <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-black uppercase text-red-300">
                                       critical
                                    </span>
                                 ) : null}
                              </div>
                              <p className="mt-1 break-words text-lg font-bold text-[#cfc6dd]">{describe(a)}</p>
                              <p className="mt-1 text-sm font-medium text-[#6f6385]">
                                 {new Date(a.created_at).toLocaleString()}
                              </p>
                           </div>
                           <span
                              className={`shrink-0 rounded-full px-3 py-1 text-sm font-black uppercase ${statusClass(a.review_status)}`}
                           >
                              {a.review_status}
                           </span>
                        </div>

                        {a.reviewed_note ? (
                           <p className="mt-2 rounded-xl bg-[#241044] p-2 text-sm font-bold text-[#a89bb8]">
                              note: {a.reviewed_note}
                           </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                           <input
                              value={notes[a.id] ?? ''}
                              onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                              placeholder="optional note"
                              className="min-w-40 flex-1 rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 py-2 text-base font-bold text-white placeholder:text-[#6f6385]"
                           />
                           <button
                              type="button"
                              onClick={() => act(a.id, 'confirmed')}
                              disabled={busy === a.id}
                              className="rounded-xl bg-red-600 px-4 py-2 text-base font-black text-white disabled:opacity-50"
                           >
                              Confirm fraud
                           </button>
                           <button
                              type="button"
                              onClick={() => act(a.id, 'ignored')}
                              disabled={busy === a.id}
                              className="rounded-xl bg-[#34234f] px-4 py-2 text-base font-black text-white disabled:opacity-50"
                           >
                              Ignore
                           </button>
                           {a.review_status !== 'open' ? (
                              <button
                                 type="button"
                                 onClick={() => act(a.id, 'open')}
                                 disabled={busy === a.id}
                                 className="rounded-xl border border-[#3d1f6e] px-4 py-2 text-base font-black text-[#a89bb8] disabled:opacity-50"
                              >
                                 Reopen
                              </button>
                           ) : null}
                        </div>
                     </article>
                  );
               })}
            </div>
         ) : (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               {loading ? 'Loading alerts…' : `No ${filter === 'all' ? '' : filter} alerts. The daily scan writes here when it finds new signals.`}
            </div>
         )}
      </div>
   );
}
