'use client';

// Admin → Support → WhatsApp: the business number's chats (SendPulse), read and answered from the admin
// panel so the team doesn't need the WhatsApp Business app or the SendPulse login.
//
// WhatsApp's rule: free text only within 24h of the person's last message. Outside that window (or to a
// brand-new number) only a Meta-approved template can be sent, so the composer switches to a template picker.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
   getWhatsAppChats,
   getWhatsAppMessages,
   getWhatsAppTemplates,
   sendWhatsAppReply,
   sendWhatsAppTemplateMessage,
   type WhatsAppChatRow,
   type WhatsAppMessageRow,
   type WhatsAppTemplateRow
} from '@/app/admin/adminSupabase';

const BUSINESS_NUMBER = '+66 95 165 9077';
const CHATS_POLL_MS = 20_000;
const THREAD_POLL_MS = 8_000;
const TEXT_MAX = 1024;

const cardClass = 'rounded-3xl border border-[#2a1453] bg-[#1c0a3a]';

const bangkokTime = (iso: string | null, withDate = false) => {
   if (!iso) return '';
   const d = new Date(iso);
   if (Number.isNaN(d.getTime())) return '';
   const sameDay =
      new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' }) === d.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' });
   return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      ...(withDate || !sameDay ? { day: 'numeric', month: 'short' } : {})
   });
};

const formatPhone = (digits: string | null) => (digits ? `+${digits}` : '');

const chatTitle = (c: WhatsAppChatRow) => c.name || c.user?.displayName || formatPhone(c.phone) || 'Unknown';

const reasonText = (reason: string, detail?: string) => {
   const d = (detail ?? '').toLowerCase();
   if (d.includes('24') || d.includes('window') || d.includes('re-engagement') || d.includes('131047'))
      return 'WhatsApp blocked it: it has been over 24h since they last wrote. Send an approved template instead.';
   if (d.includes('balance') || d.includes('insufficient'))
      return 'SendPulse balance is empty. Top up WhatsApp funds in SendPulse to send templates.';
   const map: Record<string, string> = {
      not_configured: 'SendPulse is not connected on the server.',
      auth_failed: 'SendPulse login failed on the server.',
      bad_phone: 'That phone number doesn’t look right. Use the full number with country code, e.g. +63 917 123 4567.',
      missing_params: 'Fill in every blank in the template.',
      missing_fields: 'Write a message first.',
      too_long: `Keep it under ${TEXT_MAX} characters.`,
      'Forbidden: admin account required': 'Your account isn’t an admin.'
   };
   return map[reason] ?? `Couldn’t send (${reason}${detail ? `: ${detail.slice(0, 160)}` : ''}).`;
};

export default function WhatsAppInboxSection() {
   const [chats, setChats] = useState<WhatsAppChatRow[]>([]);
   const [chatsError, setChatsError] = useState<string | null>(null);
   const [loadingChats, setLoadingChats] = useState(true);
   const [search, setSearch] = useState('');
   const [selectedId, setSelectedId] = useState<string | null>(null);
   const [newChat, setNewChat] = useState(false);
   const [templates, setTemplates] = useState<WhatsAppTemplateRow[] | null>(null);

   const loadChats = useCallback(async () => {
      const res = await getWhatsAppChats();
      setLoadingChats(false);
      if (!res.ok) {
         setChatsError(reasonText(res.reason, res.detail));
         return;
      }
      setChatsError(null);
      setChats(res.chats);
   }, []);

   useEffect(() => {
      void loadChats();
      const t = window.setInterval(() => {
         if (document.visibilityState === 'visible') void loadChats();
      }, CHATS_POLL_MS);
      return () => window.clearInterval(t);
   }, [loadChats]);

   useEffect(() => {
      void getWhatsAppTemplates().then((res) => setTemplates(res.ok ? res.templates : []));
   }, []);

   const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return chats;
      const qDigits = q.replace(/\D/g, '');
      return chats.filter(
         (c) =>
            chatTitle(c).toLowerCase().includes(q) ||
            (c.user?.username ?? '').toLowerCase().includes(q) ||
            (qDigits.length >= 3 && (c.phone ?? '').includes(qDigits))
      );
   }, [chats, search]);

   const selected = chats.find((c) => c.contactId === selectedId) ?? null;
   const unreadTotal = chats.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0);

   const openChat = (id: string) => {
      setNewChat(false);
      setSelectedId(id);
      // Opening marks it read on SendPulse; mirror that right away.
      setChats((prev) => prev.map((c) => (c.contactId === id ? { ...c, unread: 0 } : c)));
   };

   const showThreadOnMobile = Boolean(selectedId || newChat);

   return (
      <section className="space-y-6">
         <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
               <h2 className="break-words text-2xl font-black sm:text-3xl">WhatsApp</h2>
               <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
                  Chats on our business number <span className="font-black text-white">{BUSINESS_NUMBER}</span>. Read and reply here — no
                  WhatsApp Business app needed. Times are Bangkok time.
               </p>
            </div>
            <div className="flex gap-2">
               <button
                  type="button"
                  onClick={() => void loadChats()}
                  className="rounded-xl border border-[#2a1453] bg-[#1c0a3a] px-4 py-2.5 text-sm font-black text-purple-200 hover:border-[#8336f0]"
               >
                  Refresh
               </button>
               <button
                  type="button"
                  onClick={() => {
                     setSelectedId(null);
                     setNewChat(true);
                  }}
                  className="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-black text-[#0b2a17] hover:brightness-110"
               >
                  + New chat
               </button>
            </div>
         </div>

         <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            {/* Chat list */}
            <div
               className={`${cardClass} flex h-[78vh] min-h-[520px] flex-col overflow-hidden ${showThreadOnMobile ? 'hidden lg:flex' : 'flex'}`}
            >
               <div className="border-b border-[#2a1453] p-3">
                  <input
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                     placeholder="Search name, @username or number"
                     className="w-full rounded-xl border border-[#2a1453] bg-[#140726] px-3 py-2.5 text-sm text-white placeholder:text-[#6f6385] focus:border-[#8336f0] focus:outline-none"
                  />
                  <p className="mt-2 px-1 text-xs font-bold text-[#a89bb8]">
                     {chats.length} chats{unreadTotal ? ` · ${unreadTotal} unread` : ''}
                  </p>
               </div>
               <div className="flex-1 overflow-y-auto">
                  {loadingChats ? <p className="p-4 text-sm text-[#a89bb8]">Loading chats…</p> : null}
                  {chatsError ? <p className="p-4 text-sm font-bold text-red-300">{chatsError}</p> : null}
                  {!loadingChats && !chatsError && !filtered.length ? <p className="p-4 text-sm text-[#a89bb8]">No chats found.</p> : null}
                  {filtered.map((c) => {
                     const active = c.contactId === selectedId;
                     return (
                        <button
                           key={c.contactId}
                           type="button"
                           onClick={() => openChat(c.contactId)}
                           className={`flex w-full items-start gap-3 border-b border-[#2a1453]/60 px-4 py-3 text-left transition ${
                              active ? 'bg-[#2a1453]' : 'hover:bg-[#20103e]'
                           }`}
                        >
                           <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20 text-sm font-black text-[#25D366]">
                              {chatTitle(c)
                                 .replace(/[^\p{L}\p{N}]/gu, '')
                                 .slice(0, 1)
                                 .toUpperCase() || '#'}
                           </div>
                           <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                 <p className={`truncate text-sm ${c.unread ? 'font-black text-white' : 'font-bold text-purple-100'}`}>
                                    {chatTitle(c)}
                                 </p>
                                 <span className="shrink-0 text-[11px] text-[#a89bb8]">{bangkokTime(c.lastAt)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                 <p className="truncate text-xs text-[#a89bb8]">
                                    {c.lastDirection === 2 ? 'You: ' : ''}
                                    {c.lastText || formatPhone(c.phone)}
                                 </p>
                                 {c.unread ? (
                                    <span className="shrink-0 rounded-full bg-[#25D366] px-1.5 text-[11px] font-black text-[#0b2a17]">
                                       {c.unread}
                                    </span>
                                 ) : null}
                              </div>
                              {c.user ? (
                                 <p className="mt-0.5 truncate text-[11px] font-bold text-[#c9a4ff]">
                                    Moodeng: {c.user.username ? `@${c.user.username}` : c.user.displayName}
                                 </p>
                              ) : null}
                           </div>
                        </button>
                     );
                  })}
               </div>
            </div>

            {/* Thread / new chat */}
            <div
               className={`${cardClass} h-[78vh] min-h-[520px] flex-col overflow-hidden ${showThreadOnMobile ? 'flex' : 'hidden lg:flex'}`}
            >
               {newChat ? (
                  <NewChatPanel
                     templates={templates}
                     onBack={() => setNewChat(false)}
                     onSent={() => {
                        setNewChat(false);
                        window.setTimeout(() => void loadChats(), 1500);
                     }}
                  />
               ) : selected ? (
                  <ThreadPanel
                     key={selected.contactId}
                     chat={selected}
                     templates={templates}
                     onBack={() => setSelectedId(null)}
                     onSent={() => void loadChats()}
                  />
               ) : (
                  <div className="flex flex-1 items-center justify-center p-8 text-center text-[#a89bb8]">
                     <div>
                        <p className="text-4xl">💬</p>
                        <p className="mt-3 font-bold">Pick a chat on the left, or start a new one.</p>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </section>
   );
}

function ThreadPanel({
   chat,
   templates,
   onBack,
   onSent
}: {
   chat: WhatsAppChatRow;
   templates: WhatsAppTemplateRow[] | null;
   onBack: () => void;
   onSent: () => void;
}) {
   const [messages, setMessages] = useState<WhatsAppMessageRow[] | null>(null);
   const [canFreeText, setCanFreeText] = useState(false);
   const [lastInboundAt, setLastInboundAt] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [draft, setDraft] = useState('');
   const [sending, setSending] = useState(false);
   const [sendError, setSendError] = useState<string | null>(null);
   const scrollRef = useRef<HTMLDivElement>(null);
   const lastCount = useRef(0);

   const load = useCallback(async () => {
      const res = await getWhatsAppMessages(chat.contactId);
      if (!res.ok) {
         setError(reasonText(res.reason, res.detail));
         return;
      }
      setError(null);
      setMessages(res.messages);
      setCanFreeText(res.canFreeText);
      setLastInboundAt(res.lastInboundAt);
   }, [chat.contactId]);

   useEffect(() => {
      void load();
      const t = window.setInterval(() => {
         if (document.visibilityState === 'visible') void load();
      }, THREAD_POLL_MS);
      return () => window.clearInterval(t);
   }, [load]);

   // Stick to the bottom when new messages arrive.
   useEffect(() => {
      const n = messages?.length ?? 0;
      if (n !== lastCount.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      lastCount.current = n;
   }, [messages]);

   const send = async () => {
      const text = draft.trim();
      if (!text || sending) return;
      setSending(true);
      setSendError(null);
      const res = await sendWhatsAppReply(chat.contactId, text);
      setSending(false);
      if (!res.ok) {
         setSendError(reasonText(res.reason, res.detail));
         return;
      }
      setDraft('');
      await load();
      onSent();
   };

   const hoursLeft = lastInboundAt ? Math.max(0, 24 - (Date.now() - Date.parse(lastInboundAt)) / 3_600_000) : 0;

   return (
      <>
         <div className="flex items-center gap-3 border-b border-[#2a1453] px-4 py-3">
            <button
               type="button"
               onClick={onBack}
               className="rounded-lg px-2 py-1 text-lg font-black text-purple-200 hover:bg-[#2a1453] lg:hidden"
               aria-label="Back to chats"
            >
               ←
            </button>
            <div className="min-w-0 flex-1">
               <p className="truncate font-black">{chatTitle(chat)}</p>
               <p className="truncate text-xs text-[#a89bb8]">
                  {formatPhone(chat.phone)}
                  {chat.user ? (
                     <>
                        {' · '}
                        <span className="font-bold text-[#c9a4ff]">
                           Moodeng {chat.user.username ? `@${chat.user.username}` : chat.user.displayName}
                        </span>
                     </>
                  ) : (
                     ' · not linked to a Moodeng account'
                  )}
               </p>
            </div>
         </div>

         <div ref={scrollRef} className="min-h-[180px] flex-1 space-y-2 overflow-y-auto bg-[#140726] px-4 py-4">
            {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}
            {!messages && !error ? <p className="text-sm text-[#a89bb8]">Loading messages…</p> : null}
            {messages && !messages.length ? <p className="text-sm text-[#a89bb8]">No messages yet.</p> : null}
            {messages?.map((m) => {
               const mine = m.direction === 2;
               return (
                  <div key={m.id || `${m.createdAt}-${m.text}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                     <div
                        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                           mine ? 'rounded-br-md bg-[#1f6b45] text-white' : 'rounded-bl-md bg-[#2a1453] text-purple-50'
                        }`}
                     >
                        {m.text}
                        <span className="ml-2 inline-block align-bottom text-[10px] text-white/60">
                           {bangkokTime(m.createdAt)}
                           {mine && m.status === 6 ? ' · failed' : mine && m.status && m.status >= 4 ? ' · ✓✓' : ''}
                        </span>
                     </div>
                  </div>
               );
            })}
         </div>

         <div className="max-h-[55%] shrink-0 overflow-y-auto border-t border-[#2a1453] p-3">
            {messages === null && !error ? null : canFreeText ? (
               <div>
                  <div className="flex items-end gap-2">
                     <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.slice(0, TEXT_MAX))}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void send();
                           }
                        }}
                        rows={2}
                        placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
                        className="min-h-[52px] flex-1 resize-y rounded-xl border border-[#2a1453] bg-[#140726] px-3 py-2.5 text-sm text-white placeholder:text-[#6f6385] focus:border-[#8336f0] focus:outline-none"
                     />
                     <button
                        type="button"
                        disabled={!draft.trim() || sending}
                        onClick={() => void send()}
                        className="rounded-xl bg-[#25D366] px-5 py-3 text-sm font-black text-[#0b2a17] hover:brightness-110 disabled:opacity-40"
                     >
                        {sending ? 'Sending…' : 'Send'}
                     </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#a89bb8]">
                     Free replies allowed for about {Math.floor(hoursLeft)}h more (24h after their last message).
                  </p>
                  {sendError ? <p className="mt-1.5 text-sm font-bold text-red-300">{sendError}</p> : null}
               </div>
            ) : (
               <div>
                  <p className="mb-2 rounded-xl bg-[#3a2a0c] px-3 py-2 text-xs font-bold text-amber-200">
                     {lastInboundAt
                        ? 'Over 24h since they last wrote, so WhatsApp only allows an approved template. Once they reply, you can chat freely again.'
                        : 'They haven’t written to us yet, so WhatsApp only allows an approved template.'}
                  </p>
                  <TemplateSender
                     templates={templates}
                     defaultName={chat.name ?? chat.user?.displayName ?? ''}
                     onSend={(t) => sendWhatsAppTemplateMessage({ contactId: chat.contactId, ...t })}
                     onSent={async () => {
                        await load();
                        onSent();
                     }}
                  />
               </div>
            )}
         </div>
      </>
   );
}

function NewChatPanel({ templates, onBack, onSent }: { templates: WhatsAppTemplateRow[] | null; onBack: () => void; onSent: () => void }) {
   const [phone, setPhone] = useState('');
   const digits = phone.replace(/\D/g, '');
   const phoneOk = digits.length >= 8 && digits.length <= 15;

   return (
      <div className="flex flex-1 flex-col overflow-y-auto p-5">
         <div className="flex items-center gap-2">
            <button
               type="button"
               onClick={onBack}
               className="rounded-lg px-2 py-1 text-lg font-black text-purple-200 hover:bg-[#2a1453]"
               aria-label="Back"
            >
               ←
            </button>
            <h3 className="text-xl font-black">Start a new WhatsApp chat</h3>
         </div>
         <p className="mt-2 text-sm text-[#a89bb8]">
            WhatsApp only lets a business start a chat with an approved template. When they reply, the chat shows up on the left and you can
            write freely.
         </p>
         <label className="mt-5 block text-xs font-black uppercase tracking-wide text-[#a89bb8]">Phone number (with country code)</label>
         <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="+63 917 123 4567"
            className="mt-1.5 w-full max-w-sm rounded-xl border border-[#2a1453] bg-[#140726] px-3 py-2.5 text-sm text-white placeholder:text-[#6f6385] focus:border-[#8336f0] focus:outline-none"
         />
         {phone && !phoneOk ? <p className="mt-1 text-xs font-bold text-amber-200">Use the full number, country code first.</p> : null}
         {digits.startsWith('0') ? (
            <p className="mt-1 text-xs font-bold text-amber-200">
               Drop the leading 0 and add the country code (PH = 63, TH = 66, ID = 62).
            </p>
         ) : null}
         <div className="mt-5">
            <TemplateSender
               templates={templates}
               disabled={!phoneOk || digits.startsWith('0')}
               onSend={(t) => sendWhatsAppTemplateMessage({ phone: digits, ...t })}
               onSent={onSent}
            />
         </div>
      </div>
   );
}

function TemplateSender({
   templates,
   defaultName = '',
   disabled = false,
   onSend,
   onSent
}: {
   templates: WhatsAppTemplateRow[] | null;
   defaultName?: string;
   disabled?: boolean;
   onSend: (t: { name: string; language: string; params: string[] }) => Promise<{ ok: boolean; reason?: string; detail?: string }>;
   onSent: () => void | Promise<void>;
}) {
   const [key, setKey] = useState('');
   const [params, setParams] = useState<string[]>([]);
   const [sending, setSending] = useState(false);
   const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

   const tpl = templates?.find((t) => `${t.name}|${t.language}` === key) ?? null;

   useEffect(() => {
      // Pre-fill {{1}} with their first name — most of our templates start "Hi {{1}}".
      setParams(tpl ? Array.from({ length: tpl.params }, (_, i) => (i === 0 ? (defaultName.split(' ')[0] ?? '') : '')) : []);
      setResult(null);
   }, [tpl, defaultName]);

   if (templates === null) return <p className="text-sm text-[#a89bb8]">Loading templates…</p>;
   if (!templates.length) return <p className="text-sm font-bold text-amber-200">No approved templates found in SendPulse.</p>;

   const preview = tpl ? tpl.content.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => params[Number(n) - 1] || `{{${n}}}`) : '';

   const send = async () => {
      if (!tpl || sending) return;
      setSending(true);
      setResult(null);
      const res = await onSend({ name: tpl.name, language: tpl.language, params });
      setSending(false);
      if (!res.ok) {
         setResult({ ok: false, text: reasonText(res.reason ?? 'send_failed', res.detail) });
         return;
      }
      setResult({ ok: true, text: 'Sent ✓' });
      await onSent();
   };

   return (
      <div className="space-y-3">
         <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-xl border border-[#2a1453] bg-[#140726] px-3 py-2.5 text-sm text-white focus:border-[#8336f0] focus:outline-none"
         >
            <option value="">Choose a template…</option>
            {templates.map((t) => (
               <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                  {t.name} ({t.language}
                  {t.category ? ` · ${t.category.toLowerCase()}` : ''})
               </option>
            ))}
         </select>
         {tpl ? (
            <>
               {params.map((p, i) => (
                  <input
                     key={i}
                     value={p}
                     onChange={(e) => setParams((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                     placeholder={`Fill in {{${i + 1}}}`}
                     className="w-full rounded-xl border border-[#2a1453] bg-[#140726] px-3 py-2 text-sm text-white placeholder:text-[#6f6385] focus:border-[#8336f0] focus:outline-none"
                  />
               ))}
               <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#1f6b45] px-3.5 py-2 text-sm text-white">
                  {preview || '(no preview text)'}
               </div>
               <button
                  type="button"
                  disabled={disabled || sending || params.some((p) => !p.trim())}
                  onClick={() => void send()}
                  className="rounded-xl bg-[#25D366] px-5 py-3 text-sm font-black text-[#0b2a17] hover:brightness-110 disabled:opacity-40"
               >
                  {sending ? 'Sending…' : 'Send template'}
               </button>
            </>
         ) : null}
         {result ? <p className={`text-sm font-bold ${result.ok ? 'text-[#25D366]' : 'text-red-300'}`}>{result.text}</p> : null}
      </div>
   );
}
