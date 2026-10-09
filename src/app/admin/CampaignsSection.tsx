'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
   type CampaignAudience,
   type CampaignChannel,
   type CampaignPerson,
   type CampaignRecipient,
   type CampaignSendResult,
   type CampaignSummary,
   getCampaignAudience,
   listCampaignRecipients,
   listCampaigns,
   sendCampaign
} from '@/app/admin/adminSupabase';

// Admin → Campaigns (admin-campaigns edge function). Pick a ready-made audience — always computed from
// live data — write one message, send. Each person gets it on the best channel they can receive:
// Messenger when Meta's 24h window is open, otherwise email (unless they unsubscribed) + app push.
// A retry of the same campaign skips whoever already got it.

const MAX_PER_SEND = 100;
const MAX_MESSAGE = 2000;
const PLACEHOLDER = '{first_name}';
// Someone contacted by a campaign this recently is left unticked by default.
const RECENTLY_CONTACTED_DAYS = 7;

const AUDIENCES: Array<{ id: CampaignAudience; label: string; hint: string }> = [
   { id: 'past_idle', label: 'Past borrowers, idle', hint: 'Repaid, nothing open now, last loan funded more than N days ago.' },
   { id: 'fb_not_borrowing', label: 'Facebook connected, not borrowing', hint: 'Confirmed Messenger, nothing open right now.' }
];

const CHANNEL_LABEL: Record<CampaignChannel, string> = { messenger: 'Messenger', email: 'Email', push: 'Push' };

const DETAIL_LABEL: Record<string, string> = {
   already_sent: 'already sent in this campaign',
   no_longer_in_audience: 'no longer in the audience (borrowed since?)',
   unsubscribed: 'unsubscribed from email',
   no_email: 'no email on file',
   no_device: 'notifications not turned on',
   push_failed: 'push failed'
};

const fill = (template: string, name: string) => template.replace(/\{\s*first_name\s*\}/gi, name);
const shortDate = (iso: string | null) =>
   iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const daysAgo = (iso: string | null) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null);
// The campaign id must be a UUID (the server checks); every browser the admin panel runs in has this.
const newId = () => crypto.randomUUID();
const errorText = (err: unknown, fallback: string) => (err as { message?: string } | null)?.message || fallback;

function ChannelChips({ channels }: { channels: CampaignChannel[] }) {
   return (
      <span className="flex flex-wrap gap-1.5">
         {channels.map((c) => (
            <span
               className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c === 'messenger' ? 'bg-[#0b2a55] text-[#7fb4ff]' : 'bg-[#12052a] text-[#a89bb8]'}`}
               key={c}
            >
               {CHANNEL_LABEL[c]}
            </span>
         ))}
      </span>
   );
}

export default function CampaignsSection() {
   const [audience, setAudience] = useState<CampaignAudience>('past_idle');
   const [idleDays, setIdleDays] = useState(30);
   const [people, setPeople] = useState<CampaignPerson[]>([]);
   const [loading, setLoading] = useState(false);
   const [loadError, setLoadError] = useState<string | null>(null);
   const [selected, setSelected] = useState<Set<string>>(new Set());

   const [name, setName] = useState('');
   const [subject, setSubject] = useState('');
   const [message, setMessage] = useState('');
   const [sending, setSending] = useState(false);
   const [sendError, setSendError] = useState<string | null>(null);
   const [result, setResult] = useState<CampaignSendResult | null>(null);
   // One id per campaign: pressing Send again after a partial failure retries only what failed.
   const campaignId = useRef(newId());
   const messageRef = useRef<HTMLTextAreaElement>(null);

   const [history, setHistory] = useState<CampaignSummary[]>([]);
   const [historyError, setHistoryError] = useState<string | null>(null);
   const [openCampaign, setOpenCampaign] = useState<string | null>(null);
   const [recipients, setRecipients] = useState<CampaignRecipient[] | null>(null);

   const loadAudience = useCallback(async () => {
      setLoading(true);
      setLoadError(null);
      try {
         const { people: rows } = await getCampaignAudience(audience, idleDays);
         setPeople(rows);
         // Everyone ticked, except people a campaign reached in the last week.
         setSelected(
            new Set(rows.filter((p) => (daysAgo(p.lastContactedAt) ?? Infinity) >= RECENTLY_CONTACTED_DAYS).map((p) => p.userId))
         );
      } catch (err) {
         setLoadError(errorText(err, 'Could not load the audience.'));
         setPeople([]);
         setSelected(new Set());
      } finally {
         setLoading(false);
      }
   }, [audience, idleDays]);

   const loadHistory = useCallback(async () => {
      setHistoryError(null);
      try {
         setHistory((await listCampaigns()).campaigns);
      } catch (err) {
         setHistoryError(errorText(err, 'Could not load campaigns.'));
      }
   }, []);

   useEffect(() => {
      void loadAudience();
   }, [loadAudience]);
   useEffect(() => {
      void loadHistory();
   }, [loadHistory]);

   const selectedPeople = useMemo(() => people.filter((p) => selected.has(p.userId)), [people, selected]);
   const plan = useMemo(() => {
      const count = (c: CampaignChannel) => selectedPeople.filter((p) => p.channels.includes(c)).length;
      return { messenger: count('messenger'), email: count('email'), push: count('push') };
   }, [selectedPeople]);

   const toggle = (id: string) =>
      setSelected((prev) => {
         const next = new Set(prev);
         if (next.has(id)) next.delete(id);
         else next.add(id);
         return next;
      });
   const allSelected = people.length > 0 && people.every((p) => selected.has(p.userId));

   const insertPlaceholder = () => {
      const el = messageRef.current;
      const start = el?.selectionStart ?? message.length;
      const end = el?.selectionEnd ?? message.length;
      setMessage(message.slice(0, start) + PLACEHOLDER + message.slice(end));
      requestAnimationFrame(() => {
         el?.focus();
         el?.setSelectionRange(start + PLACEHOLDER.length, start + PLACEHOLDER.length);
      });
   };

   const canSend =
      !sending && subject.trim() && message.trim() && selectedPeople.length > 0 && selectedPeople.length <= MAX_PER_SEND;

   const send = async () => {
      if (!canSend) return;
      const n = selectedPeople.length;
      if (!window.confirm(`Send "${subject.trim()}" to ${n} ${n === 1 ? 'person' : 'people'}?`)) return;
      setSending(true);
      setSendError(null);
      setResult(null);
      try {
         const res = await sendCampaign({
            campaignId: campaignId.current,
            name: name.trim() || subject.trim(),
            audience,
            idleDays,
            subject: subject.trim(),
            message: message.trim(),
            userIds: selectedPeople.map((p) => p.userId)
         });
         setResult(res);
         if (res.failed === 0) {
            // Done — the next send is a new campaign.
            campaignId.current = newId();
            setName('');
            setSubject('');
            setMessage('');
         }
         void loadHistory();
         void loadAudience();
      } catch (err) {
         setSendError(errorText(err, 'Could not send.'));
      } finally {
         setSending(false);
      }
   };

   const openRecipients = async (id: string) => {
      if (openCampaign === id) {
         setOpenCampaign(null);
         setRecipients(null);
         return;
      }
      setOpenCampaign(id);
      setRecipients(null);
      try {
         setRecipients((await listCampaignRecipients(id)).sends);
      } catch (err) {
         setHistoryError(errorText(err, 'Could not load recipients.'));
      }
   };

   const preview = selectedPeople[0] ?? null;
   const problems = result?.outcomes.filter((o) => o.status !== 'sent') ?? [];
   const nameOf = (userId: string) => {
      const p = people.find((x) => x.userId === userId);
      return p ? p.displayName || p.username || p.email || userId : userId;
   };

   return (
      <div className="space-y-6">
         {/* 1. Audience */}
         <div className="space-y-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
            <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">1 · Audience</p>
            <div className="flex flex-wrap items-center gap-2">
               {AUDIENCES.map((a) => (
                  <button
                     className={`rounded-full px-4 py-1.5 text-sm font-black ${audience === a.id ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
                     key={a.id}
                     onClick={() => setAudience(a.id)}
                     type="button"
                  >
                     {a.label}
                  </button>
               ))}
               {audience === 'past_idle' ? (
                  <label className="flex items-center gap-2 text-sm font-bold text-[#a89bb8]">
                     No loan in the last
                     <input
                        className="w-20 rounded-full border border-[#2a1453] bg-[#12052a] px-3 py-1 text-sm text-white"
                        min={0}
                        onChange={(e) => setIdleDays(Math.max(0, Number(e.target.value) || 0))}
                        type="number"
                        value={idleDays}
                     />
                     days
                  </label>
               ) : null}
               <button
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
                  disabled={loading}
                  onClick={() => void loadAudience()}
                  type="button"
               >
                  {loading ? 'Loading…' : 'Refresh'}
               </button>
            </div>
            <p className="text-sm text-[#a89bb8]">{AUDIENCES.find((a) => a.id === audience)?.hint} Active accounts only, no test accounts.</p>

            {loadError ? <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 font-bold text-red-300">{loadError}</p> : null}
            {!loading && !loadError && people.length === 0 ? <p className="text-lg text-[#a89bb8]">Nobody in this audience right now.</p> : null}

            {people.length ? (
               <>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                     <button
                        className="rounded-full bg-[#241044] px-4 py-1.5 font-black text-[#c9b8ff]"
                        onClick={() => setSelected(allSelected ? new Set() : new Set(people.map((p) => p.userId)))}
                        type="button"
                     >
                        {allSelected ? 'Untick all' : `Tick all (${people.length})`}
                     </button>
                     <span className="font-bold text-white">
                        {selectedPeople.length} selected → Messenger {plan.messenger} · Email {plan.email} · Push {plan.push}
                     </span>
                  </div>
                  <ul className="divide-y divide-[#2a1453] overflow-hidden rounded-xl border border-[#2a1453] bg-[#12052a]">
                     {people.map((p) => {
                        const checked = selected.has(p.userId);
                        const contacted = daysAgo(p.lastContactedAt);
                        return (
                           <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${checked ? 'bg-[#241044]' : ''}`} key={p.userId}>
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                 <input
                                    checked={checked}
                                    className="size-5 shrink-0 accent-[#8336f0]"
                                    onChange={() => toggle(p.userId)}
                                    type="checkbox"
                                 />
                                 <span className="min-w-0">
                                    <span className="block break-words font-black">
                                       {p.firstName}
                                       {p.username ? <span className="font-bold text-[#a89bb8]"> · @{p.username}</span> : null}
                                    </span>
                                    <span className="block break-all text-sm text-[#a89bb8]">
                                       {p.email ?? 'no email'}
                                       {` · ${p.fundedLoans} loan${p.fundedLoans === 1 ? '' : 's'}`}
                                       {p.lastFundedAt ? ` · last funded ${shortDate(p.lastFundedAt)}` : ''}
                                       {p.unsubscribed ? ' · unsubscribed from email' : ''}
                                    </span>
                                    {contacted !== null ? (
                                       <span
                                          className={`block text-xs font-bold ${contacted < RECENTLY_CONTACTED_DAYS ? 'text-amber-300' : 'text-[#7a6b8f]'}`}
                                       >
                                          Last campaign: {contacted === 0 ? 'today' : `${contacted}d ago`}
                                       </span>
                                    ) : null}
                                 </span>
                              </label>
                              <ChannelChips channels={p.channels} />
                           </li>
                        );
                     })}
                  </ul>
               </>
            ) : null}
         </div>

         {/* 2. Message */}
         <div className="space-y-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
            <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">2 · Message</p>
            <input
               className="w-full rounded-xl border border-[#2a1453] bg-[#12052a] px-3 py-2 text-sm text-white placeholder:text-[#7a6b8f]"
               maxLength={120}
               onChange={(e) => setName(e.target.value)}
               placeholder="Campaign name (just for you, e.g. “October come-back”)"
               value={name}
            />
            <input
               className="w-full rounded-xl border border-[#2a1453] bg-[#12052a] px-3 py-2 text-base font-bold text-white placeholder:text-[#7a6b8f]"
               maxLength={200}
               onChange={(e) => setSubject(e.target.value)}
               placeholder="Subject — email subject and push title"
               value={subject}
            />
            <textarea
               className="min-h-40 w-full rounded-xl border border-[#2a1453] bg-[#12052a] p-3 text-base text-white placeholder:text-[#7a6b8f]"
               maxLength={MAX_MESSAGE}
               onChange={(e) => setMessage(e.target.value)}
               placeholder={`Hi ${PLACEHOLDER},\n\nYour Moodeng limit is waiting…`}
               ref={messageRef}
               value={message}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#a89bb8]">
               <button className="rounded-full bg-[#241044] px-4 py-1.5 font-black text-[#c9b8ff]" onClick={insertPlaceholder} type="button">
                  + Insert first name
               </button>
               <span>
                  {message.length}/{MAX_MESSAGE} · Messenger gets the message only; email adds an unsubscribe link; push shows the subject and
                  the start of the message.
               </span>
            </div>

            {preview && (subject.trim() || message.trim()) ? (
               <div className="rounded-xl border border-[#2a1453] bg-white p-4 text-[#1a1a1a]">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7a6b8f]">
                     Preview for {preview.firstName} · via {preview.channels.map((c) => CHANNEL_LABEL[c]).join(' + ')}
                  </p>
                  <p className="mt-1 font-black">{fill(subject.trim(), preview.firstName)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{fill(message.trim(), preview.firstName)}</p>
               </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
               <button
                  className="rounded-full bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                  disabled={!canSend}
                  onClick={() => void send()}
                  type="button"
               >
                  {sending
                     ? `Sending to ${selectedPeople.length}…`
                     : `Send to ${selectedPeople.length} ${selectedPeople.length === 1 ? 'person' : 'people'}`}
               </button>
               {selectedPeople.length > MAX_PER_SEND ? (
                  <span className="text-sm font-bold text-amber-300">Max {MAX_PER_SEND} per send — untick some.</span>
               ) : null}
               {sending ? <span className="text-sm text-[#a89bb8]">About a second per email — keep this tab open.</span> : null}
            </div>

            {sendError ? <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 font-bold text-red-300">{sendError}</p> : null}
            {result ? (
               <div className="rounded-xl border border-[#2a1453] bg-[#12052a] p-3 text-sm">
                  <p className="font-black text-emerald-300">
                     Reached {result.reached} {result.reached === 1 ? 'person' : 'people'} ✓ — Messenger {result.messenger} · Email{' '}
                     {result.email} · Push {result.push}
                  </p>
                  {problems.length ? (
                     <ul className="mt-2 space-y-1 text-amber-300">
                        {problems.map((p) => (
                           <li key={`${p.userId}-${p.channel ?? 'none'}-${p.detail ?? p.status}`}>
                              {nameOf(p.userId)}
                              {p.channel ? ` (${CHANNEL_LABEL[p.channel]})` : ''}: {DETAIL_LABEL[p.detail ?? ''] ?? p.detail ?? p.status}
                           </li>
                        ))}
                        {result.failed ? <li className="text-[#a89bb8]">Press Send again to retry the failed ones — nobody gets it twice.</li> : null}
                     </ul>
                  ) : null}
               </div>
            ) : null}
         </div>

         {/* 3. History */}
         <div className="space-y-3">
            <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">Past campaigns</p>
            {historyError ? <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 font-bold text-red-300">{historyError}</p> : null}
            {!history.length && !historyError ? <p className="text-[#a89bb8]">No campaigns yet.</p> : null}
            <ul className="divide-y divide-[#2a1453] overflow-hidden rounded-2xl border border-[#2a1453] bg-[#1c0a3a]">
               {history.map((c) => (
                  <li key={c.id}>
                     <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left" onClick={() => void openRecipients(c.id)} type="button">
                        <span className="min-w-0 flex-1">
                           <span className="block break-words font-black">{c.name}</span>
                           <span className="block text-sm text-[#a89bb8]">
                              {shortDate(c.created_at)} · {AUDIENCES.find((a) => a.id === c.audience)?.label ?? c.audience}
                              {c.audience === 'past_idle' && c.audience_params?.idleDays !== undefined ? ` (${c.audience_params.idleDays}d)` : ''}
                           </span>
                        </span>
                        <span className="text-sm font-bold text-white">
                           {c.reached} reached · Messenger {c.messenger} · Email {c.email} · Push {c.push}
                           {c.failed ? <span className="text-amber-300"> · {c.failed} failed</span> : null}
                        </span>
                     </button>
                     {openCampaign === c.id ? (
                        <div className="border-t border-[#2a1453] bg-[#12052a] px-4 py-3 text-sm">
                           {recipients === null ? (
                              <p className="text-[#a89bb8]">Loading…</p>
                           ) : (
                              <ul className="space-y-1">
                                 {recipients.map((r) => (
                                    <li key={`${r.user_id}-${r.channel}`}>
                                       <span className="font-bold">{r.users?.display_name || r.users?.username || r.users?.email || r.user_id}</span>
                                       {` · ${CHANNEL_LABEL[r.channel]} · `}
                                       <span className={r.status === 'sent' ? 'text-emerald-300' : r.status === 'failed' ? 'text-red-300' : 'text-[#a89bb8]'}>
                                          {r.status}
                                       </span>
                                       {r.detail ? <span className="text-[#7a6b8f]"> ({DETAIL_LABEL[r.detail] ?? r.detail})</span> : null}
                                    </li>
                                 ))}
                              </ul>
                           )}
                        </div>
                     ) : null}
                  </li>
               ))}
            </ul>
         </div>
      </div>
   );
}
