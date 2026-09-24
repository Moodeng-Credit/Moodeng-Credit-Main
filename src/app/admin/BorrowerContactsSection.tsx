'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CONTACT_STEP_EXEMPT_USER_IDS } from '../../config/contactVerification';
import { type BorrowerContactRow, listBorrowerContacts } from './adminSupabase';

// Every way to reach each borrower in one list — so the team can message a late payer, check who
// still hasn't added Facebook, or export the lot. Borrowers only; lenders never appear here.

type Filter = 'all' | 'no-facebook' | 'late';

const hasFacebook = (r: BorrowerContactRow) => Boolean(r.messengerVerifiedAt || r.facebookContact);
const isLatePayer = (r: BorrowerContactRow) => r.repaidLateCount > 0 || r.overdueNowCount > 0;

const shortDate = (iso: string | null) =>
   iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const csvCell = (value: string | number | null) => {
   const text = value === null ? '' : String(value);
   return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function downloadCsv(rows: BorrowerContactRow[]) {
   const header = [
      'username',
      'name (KYC)',
      'display name',
      'email',
      'facebook messenger verified',
      'facebook (profile)',
      'whatsapp',
      'whatsapp verified',
      'telegram',
      'line',
      'funded loans',
      'repaid late',
      'overdue now'
   ];
   const lines = rows.map((r) =>
      [
         r.username,
         r.kycName,
         r.displayName,
         r.email,
         shortDate(r.messengerVerifiedAt),
         r.facebookContact,
         r.whatsappNumber,
         shortDate(r.whatsappVerifiedAt),
         r.telegramUsername ? `@${r.telegramUsername}` : null,
         r.lineId,
         r.fundedLoanCount,
         r.repaidLateCount,
         r.overdueNowCount
      ]
         .map(csvCell)
         .join(',')
   );
   const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `moodeng-borrower-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
   a.click();
   URL.revokeObjectURL(url);
}

function Chip({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'good' | 'warn' | 'bad' }) {
   const cls =
      tone === 'good'
         ? 'bg-emerald-900/50 text-emerald-300'
         : tone === 'warn'
           ? 'bg-amber-900/50 text-amber-300'
           : tone === 'bad'
             ? 'bg-red-950/60 text-red-300'
             : 'bg-[#241044] text-[#d8cce8]';
   return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${cls}`}>{children}</span>;
}

export default function BorrowerContactsSection() {
   const [rows, setRows] = useState<BorrowerContactRow[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [filter, setFilter] = useState<Filter>('all');
   const [search, setSearch] = useState('');

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         setRows(await listBorrowerContacts());
      } catch (err) {
         setError((err as { message?: string } | null)?.message || 'Could not load borrower contacts.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const visible = useMemo(() => {
      const q = search.trim().toLowerCase();
      return rows.filter((r) => {
         if (filter === 'no-facebook' && (hasFacebook(r) || CONTACT_STEP_EXEMPT_USER_IDS.has(r.id))) return false;
         if (filter === 'late' && !isLatePayer(r)) return false;
         if (!q) return true;
         return [r.username, r.kycName, r.displayName, r.email, r.telegramUsername, r.facebookContact, r.whatsappNumber, r.lineId]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
      });
   }, [rows, filter, search]);

   const counts = useMemo(
      () => ({
         all: rows.length,
         'no-facebook': rows.filter((r) => !hasFacebook(r) && !CONTACT_STEP_EXEMPT_USER_IDS.has(r.id)).length,
         late: rows.filter(isLatePayer).length
      }),
      [rows]
   );

   const FILTERS: Array<{ id: Filter; label: string }> = [
      { id: 'all', label: 'All borrowers' },
      { id: 'no-facebook', label: 'Missing Facebook' },
      { id: 'late', label: 'Late / overdue' }
   ];

   return (
      <div className="space-y-4">
         <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
               <button
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${filter === f.id ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  type="button"
               >
                  {f.label} ({counts[f.id]})
               </button>
            ))}
            <input
               className="min-w-48 flex-1 rounded-full border border-[#2a1453] bg-[#1c0a3a] px-4 py-1.5 text-sm font-bold text-white placeholder:text-[#7a6b8f]"
               onChange={(e) => setSearch(e.target.value)}
               placeholder="Search name, username, handle…"
               value={search}
            />
            <button
               className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               disabled={loading}
               onClick={() => void load()}
               type="button"
            >
               {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
               className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               disabled={!visible.length}
               onClick={() => downloadCsv(visible)}
               type="button"
            >
               Download CSV
            </button>
         </div>

         {error ? <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">{error}</div> : null}

         {!loading && !visible.length && !error ? <p className="text-lg text-[#a89bb8]">No borrowers match.</p> : null}

         <ul className="space-y-3">
            {visible.map((r) => (
               <li className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4" key={r.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                     <div className="min-w-0">
                        <p className="break-words text-xl font-black">{r.kycName ?? r.displayName ?? r.username}</p>
                        <p className="break-all text-sm text-[#a89bb8]">
                           @{r.username}
                           {r.email ? ` · ${r.email}` : ''}
                        </p>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {r.overdueNowCount ? <Chip tone="bad">Overdue now ({r.overdueNowCount})</Chip> : null}
                        {r.repaidLateCount ? <Chip tone="warn">Repaid late ×{r.repaidLateCount}</Chip> : null}
                        <Chip>{r.fundedLoanCount} funded loan{r.fundedLoanCount === 1 ? '' : 's'}</Chip>
                        {CONTACT_STEP_EXEMPT_USER_IDS.has(r.id) ? <Chip tone="good">Facebook not required</Chip> : null}
                     </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                     {r.messengerVerifiedAt ? (
                        <Chip tone="good">Facebook Messenger ✓ {shortDate(r.messengerVerifiedAt)}</Chip>
                     ) : r.facebookContact ? null : (
                        <Chip tone="warn">No Facebook yet</Chip>
                     )}
                     {r.facebookContact ? (
                        /^https?:\/\//i.test(r.facebookContact) ? (
                           <a className="underline" href={r.facebookContact} rel="noreferrer" target="_blank">
                              <Chip>Facebook: {r.facebookContact.replace(/^https?:\/\/(www\.)?/i, '')}</Chip>
                           </a>
                        ) : (
                           <Chip>Facebook: {r.facebookContact}</Chip>
                        )
                     ) : null}
                     {r.whatsappNumber ? (
                        <a href={`https://wa.me/${r.whatsappNumber.replace(/\D/g, '')}`} rel="noreferrer" target="_blank">
                           <Chip tone={r.whatsappVerifiedAt ? 'good' : 'plain'}>
                              WhatsApp {r.whatsappNumber}
                              {r.whatsappVerifiedAt ? ' ✓' : ''}
                           </Chip>
                        </a>
                     ) : null}
                     {r.telegramUsername ? (
                        <a href={`https://t.me/${r.telegramUsername}`} rel="noreferrer" target="_blank">
                           <Chip>Telegram @{r.telegramUsername}</Chip>
                        </a>
                     ) : null}
                     {r.lineId ? <Chip>LINE {r.lineId}</Chip> : null}
                  </div>
               </li>
            ))}
         </ul>
      </div>
   );
}
