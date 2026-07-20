'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   type ComingDueLoan,
   type ComingDueParty,
   extendLoan,
   type ExtendLoanResult,
   listComingDueLoans,
   type LoanNotifyResult
} from './adminSupabase';

function contactLine(party: ComingDueParty | null): string {
   if (!party) return '—';
   const parts = [party.email, party.telegram_username ? `@${party.telegram_username}` : null].filter(Boolean);
   return parts.length ? parts.join(' · ') : '—';
}

function money(value: number | null | undefined): string {
   return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function shortDate(value: string | null): string {
   if (!value) return '—';
   const d = new Date(value);
   return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

// yyyy-mm-dd in local time, for <input type="date"> and preset buttons.
function toDateInputValue(date: Date): string {
   const y = date.getFullYear();
   const m = `${date.getMonth() + 1}`.padStart(2, '0');
   const d = `${date.getDate()}`.padStart(2, '0');
   return `${y}-${m}-${d}`;
}

// Add whole days to the loan's current due date and return a yyyy-mm-dd string.
function presetDate(dueDate: string, days: number): string {
   const base = new Date(dueDate);
   base.setDate(base.getDate() + days);
   return toDateInputValue(base);
}

const PRESETS = [7, 14, 30];

type Outcome = { result: ExtendLoanResult; notify: LoanNotifyResult | null; notifyError: string | null };

export default function LoanExtensionSection({
   initialLoanId,
   actorUserId,
   initialLoans
}: {
   initialLoanId?: string | null;
   actorUserId?: string | null;
   initialLoans?: ComingDueLoan[];
}) {
   const [loans, setLoans] = useState<ComingDueLoan[]>(initialLoans ?? []);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [search, setSearch] = useState('');
   const [selectedId, setSelectedId] = useState<string | null>(initialLoanId ?? null);
   const [newDate, setNewDate] = useState('');
   const [reason, setReason] = useState('');
   const [submitting, setSubmitting] = useState(false);
   const [outcome, setOutcome] = useState<Outcome | null>(null);

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         setLoans(await listComingDueLoans({ includeTest: true }));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load loans.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      if (initialLoans) return; // preview/tests inject data and skip the live fetch
      void load();
   }, [load, initialLoans]);

   useEffect(() => {
      if (initialLoanId) setSelectedId(initialLoanId);
   }, [initialLoanId]);

   const selected = useMemo(() => loans.find((l) => l.id === selectedId) ?? null, [loans, selectedId]);

   // Default the new date to +7 days once a loan is picked.
   useEffect(() => {
      if (selected && !newDate) setNewDate(presetDate(selected.due_date, 7));
      if (!selected) setNewDate('');
   }, [selected, newDate]);

   const shown = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return loans.slice(0, 40);
      return loans
         .filter((l) => {
            const fields = [l.tracking_id, l.borrower?.username, l.lender?.username, l.reason];
            return fields.some((f) => (f ?? '').toLowerCase().includes(q));
         })
         .slice(0, 40);
   }, [loans, search]);

   const handleSubmit = useCallback(async () => {
      if (!selected || !newDate) return;
      setSubmitting(true);
      setError(null);
      setOutcome(null);
      try {
         // Interpret the chosen calendar day as end-of-day local time.
         const newDueDate = new Date(`${newDate}T23:59:59`).toISOString();
         const result = await extendLoan({
            loanId: selected.id,
            newDueDate,
            reason: reason.trim() || null,
            actorUserId
         });
         setOutcome(result);
         setReason('');
         await load();
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not extend this loan.');
      } finally {
         setSubmitting(false);
      }
   }, [selected, newDate, reason, actorUserId, load]);

   return (
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
         {/* Loan picker */}
         <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
               <h3 className="text-2xl font-black">Pick a loan</h3>
               <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               >
                  {loading ? '…' : 'Refresh'}
               </button>
            </div>
            <input
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder="Search by tracking ID, borrower, lender, or reason"
               className="w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-bold text-white placeholder:text-[#6f6385]"
            />
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
               {shown.length ? (
                  shown.map((l) => {
                     const active = l.id === selectedId;
                     return (
                        <button
                           key={l.id}
                           type="button"
                           onClick={() => {
                              setSelectedId(l.id);
                              setNewDate('');
                              setOutcome(null);
                           }}
                           className={`w-full rounded-2xl border px-4 py-3 text-left ${active ? 'border-[#8336f0] bg-[#2a1453]' : 'border-[#2a1453] bg-[#150730] hover:border-[#8336f0]'}`}
                        >
                           <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-bold text-[#cfc6dd]">{l.tracking_id}</span>
                              <span className={`text-xs font-black ${l.days_until_due < 0 ? 'text-red-300' : 'text-[#a89bb8]'}`}>
                                 {l.days_until_due < 0 ? `${Math.abs(l.days_until_due)}d overdue` : `due ${shortDate(l.due_date)}`}
                              </span>
                           </div>
                           <div className="mt-1 text-sm font-bold text-white">
                              {l.borrower?.username ?? '—'} <span className="text-[#a89bb8]">→</span> {l.lender?.username ?? '—'}
                           </div>
                           <div className="text-xs font-medium text-[#a89bb8]">{money(l.outstanding)} outstanding</div>
                        </button>
                     );
                  })
               ) : (
                  <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-lg font-black text-[#a89bb8]">
                     {loading ? 'Loading loans…' : 'No active loans match.'}
                  </div>
               )}
            </div>
         </div>

         {/* Extension form */}
         <div className="space-y-4">
            <h3 className="text-2xl font-black">Extend the due date</h3>
            {!selected ? (
               <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-6 text-lg font-black text-[#a89bb8]">
                  Select a loan on the left to extend it.
               </div>
            ) : (
               <div className="space-y-5 rounded-3xl border border-[#2a1453] bg-[#150730] p-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                     <Field label="Tracking" value={selected.tracking_id} mono />
                     <Field label="Current due" value={shortDate(selected.due_date)} />
                     <Field label="Borrower" value={selected.borrower?.username ?? '—'} />
                     <Field label="Lender" value={selected.lender?.username ?? '—'} />
                     <Field label="Borrower contact" value={contactLine(selected.borrower)} />
                     <Field label="Outstanding" value={money(selected.outstanding)} />
                  </div>

                  <div>
                     <p className="mb-2 text-sm font-black uppercase tracking-wide text-[#a89bb8]">New due date</p>
                     <div className="flex flex-wrap gap-2">
                        {PRESETS.map((days) => {
                           const value = presetDate(selected.due_date, days);
                           const active = newDate === value;
                           return (
                              <button
                                 key={days}
                                 type="button"
                                 onClick={() => setNewDate(value)}
                                 className={`rounded-full px-4 py-1.5 text-sm font-black ${active ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
                              >
                                 +{days} days
                              </button>
                           );
                        })}
                     </div>
                     <input
                        type="date"
                        value={newDate}
                        min={toDateInputValue(new Date())}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="mt-3 w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-bold text-white"
                     />
                     {newDate ? (
                        <p className="mt-2 text-sm font-bold text-[#cfc6dd]">
                           Moves due date from {shortDate(selected.due_date)} to {shortDate(new Date(`${newDate}T23:59:59`).toISOString())}.
                        </p>
                     ) : null}
                  </div>

                  <div>
                     <p className="mb-2 text-sm font-black uppercase tracking-wide text-[#a89bb8]">
                        Reason (optional — shown to both parties)
                     </p>
                     <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="e.g. Borrower requested a one-week grace period."
                        className="w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-medium text-white placeholder:text-[#6f6385]"
                     />
                  </div>

                  {error ? (
                     <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-base font-bold text-red-300">{error}</div>
                  ) : null}

                  <button
                     type="button"
                     onClick={handleSubmit}
                     disabled={submitting || !newDate}
                     className="w-full rounded-2xl bg-[#8336f0] px-6 py-4 text-lg font-black text-white disabled:opacity-50"
                  >
                     {submitting ? 'Extending…' : 'Extend loan & notify both parties'}
                  </button>

                  {outcome ? (
                     <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-4 text-base font-bold text-emerald-200">
                        <p>
                           Loan {outcome.result.tracking_id} extended by {outcome.result.days_extended} day
                           {outcome.result.days_extended === 1 ? '' : 's'} — new due date {shortDate(outcome.result.new_due_date)}.
                        </p>
                        <p className="mt-1 text-sm text-emerald-300/90">
                           {outcome.notifyError
                              ? `Due date changed, but the borrower notification failed: ${outcome.notifyError}`
                              : outcome.notify
                                ? `Borrower notified via ${[outcome.notify.borrowerEmailSent ? 'email' : null, outcome.notify.borrowerTelegramSent ? 'Telegram' : null].filter(Boolean).join(' + ') || 'no channel on file'}.${outcome.notify.teamConfigured ? ` Team channel: ${outcome.notify.teamNotified ? 'posted' : 'failed'}.` : ''}`
                                : 'Due date changed.'}
                        </p>
                     </div>
                  ) : null}
               </div>
            )}
         </div>
      </div>
   );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
   return (
      <div>
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <p className={`mt-0.5 break-words font-bold text-white ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
   );
}
