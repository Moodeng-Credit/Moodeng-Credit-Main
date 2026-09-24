'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CONTACT_STEP_EXEMPT_USER_IDS } from '../../config/contactVerification';
import {
   type BorrowerContactRow,
   getMessengerProfiles,
   listBorrowerContacts,
   logAdminAction,
   type MessengerProfile,
   sendMessengerToBorrower
} from './adminSupabase';

// Every way to reach each borrower in one list — so the team can message a late payer, check who
// still hasn't added Facebook, or export the lot. Borrowers only; lenders never appear here.

type Filter = 'all' | 'no-facebook' | 'late';

// Messenger only delivers free-form messages within 24h of the borrower's last message to the Page.
// Outside it, the team replies from the Page inbox (Meta Business Suite) instead.
const PAGE_INBOX_URL = 'https://business.facebook.com/latest/inbox/messenger?asset_id=1148756028310286';

const SEND_ERRORS: Record<string, string> = {
   outside_24h_window: "They haven't messaged the Page in the last 24h, so Messenger won't deliver it. Reply from the Page inbox instead.",
   contact_not_found: "Couldn't find their Messenger contact in SendPulse.",
   not_verified: "They haven't confirmed Messenger yet.",
   sendpulse_not_configured: 'SendPulse API key is not set on the server.'
};

const hasFacebook = (r: BorrowerContactRow) => Boolean(r.messengerVerifiedAt || r.facebookContact);
const isLatePayer = (r: BorrowerContactRow) => r.repaidLateCount > 0 || r.overdueNowCount > 0;

const shortDate = (iso: string | null) =>
   iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const csvCell = (value: string | number | null) => {
   const text = value === null ? '' : String(value);
   return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function downloadCsv(rows: BorrowerContactRow[], fbNames: Map<string, string>) {
   const header = [
      'username',
      'name (KYC)',
      'display name',
      'email',
      'facebook name',
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
         fbNames.get(r.id) ?? null,
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
   const [profiles, setProfiles] = useState<Map<string, MessengerProfile>>(new Map());
   const [composingFor, setComposingFor] = useState<string | null>(null);
   const [draft, setDraft] = useState('');
   const [sending, setSending] = useState(false);
   const [sendNote, setSendNote] = useState<{ userId: string; ok: boolean; text: string } | null>(null);

   const fbNames = useMemo(() => {
      const names = new Map<string, string>();
      for (const [id, p] of profiles) if (p.name) names.set(id, p.name);
      return names;
   }, [profiles]);

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         const loaded = await listBorrowerContacts();
         setRows(loaded);
         // Facebook names come from SendPulse — best-effort, the list works without them.
         const verified = loaded.filter((r) => r.messengerVerifiedAt).map((r) => r.id);
         getMessengerProfiles(verified)
            .then((list) => setProfiles(new Map(list.map((p) => [p.userId, p]))))
            .catch(() => setProfiles(new Map()));
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
         return [r.username, r.kycName, r.displayName, r.email, fbNames.get(r.id), r.telegramUsername, r.facebookContact, r.whatsappNumber, r.lineId]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
      });
   }, [rows, filter, search, fbNames]);

   const send = async (row: BorrowerContactRow) => {
      const text = draft.trim();
      if (!text || sending) return;
      setSending(true);
      const result = await sendMessengerToBorrower(row.id, text);
      setSending(false);
      if (result.ok) {
         setSendNote({ userId: row.id, ok: true, text: 'Sent on Messenger ✓' });
         setDraft('');
         setComposingFor(null);
         void logAdminAction({
            action: 'messenger_message_sent',
            target_user_id: row.id,
            metadata: { length: text.length }
         }).catch(() => undefined);
      } else {
         setSendNote({ userId: row.id, ok: false, text: SEND_ERRORS[result.reason ?? ''] ?? `Couldn't send (${result.reason ?? 'error'}).` });
      }
   };

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
               onClick={() => downloadCsv(visible, fbNames)}
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
                        <Chip tone="good">
                           Facebook{fbNames.get(r.id) ? `: ${fbNames.get(r.id)}` : ''} · Messenger ✓ {shortDate(r.messengerVerifiedAt)}
                        </Chip>
                     ) : r.facebookContact || CONTACT_STEP_EXEMPT_USER_IDS.has(r.id) ? null : (
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

                  {r.messengerVerifiedAt ? (
                     <div className="mt-3 space-y-2">
                        {composingFor === r.id ? (
                           <div className="flex flex-col gap-2">
                              <textarea
                                 className="min-h-24 w-full rounded-xl border border-[#2a1453] bg-[#12052a] p-3 text-base text-white placeholder:text-[#7a6b8f]"
                                 maxLength={2000}
                                 onChange={(e) => setDraft(e.target.value)}
                                 placeholder={`Message ${fbNames.get(r.id) ?? r.username} on Messenger…`}
                                 value={draft}
                              />
                              <div className="flex flex-wrap gap-2">
                                 <button
                                    className="rounded-full bg-[#8336f0] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
                                    disabled={sending || !draft.trim()}
                                    onClick={() => void send(r)}
                                    type="button"
                                 >
                                    {sending ? 'Sending…' : 'Send'}
                                 </button>
                                 <button
                                    className="rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8]"
                                    onClick={() => setComposingFor(null)}
                                    type="button"
                                 >
                                    Cancel
                                 </button>
                              </div>
                           </div>
                        ) : (
                           <div className="flex flex-wrap items-center gap-2">
                              <button
                                 className="rounded-full bg-[#0866ff] px-4 py-1.5 text-sm font-black text-white"
                                 onClick={() => {
                                    setComposingFor(r.id);
                                    setDraft('');
                                    setSendNote(null);
                                 }}
                                 type="button"
                              >
                                 💬 Message on Messenger
                              </button>
                              {profiles.get(r.id) && !profiles.get(r.id)?.canMessageNow ? (
                                 <span className="text-sm text-amber-300">Outside the 24h window — use the Page inbox</span>
                              ) : null}
                              <a className="text-sm font-bold text-[#a89bb8] underline" href={PAGE_INBOX_URL} rel="noreferrer" target="_blank">
                                 Page inbox
                              </a>
                           </div>
                        )}
                        {sendNote?.userId === r.id ? (
                           <p className={`text-sm font-bold ${sendNote.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                              {sendNote.text}{' '}
                              {!sendNote.ok ? (
                                 <a className="underline" href={PAGE_INBOX_URL} rel="noreferrer" target="_blank">
                                    Open Page inbox
                                 </a>
                              ) : null}
                           </p>
                        ) : null}
                     </div>
                  ) : null}
               </li>
            ))}
         </ul>
      </div>
   );
}
