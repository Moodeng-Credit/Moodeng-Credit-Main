import { type JSX, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { MECHA_AVATAR, type MechaMood, poseSrc, preloadMechaPoses } from '@/components/mecha/mechaAssets';
import { getMechaCopy, MECHA_LANGS } from '@/components/mecha/mechaCopy';
import type { EscalationState, FeedbackVote, MechaMessage } from '@/components/mecha/useMechaChat';

import '@/components/mecha/mecha.css';

const EMPTY_QUICK_REPLIES: string[] = [];

interface MechaChatPanelProps {
   locale?: string;
   messages: MechaMessage[];
   isSending: boolean;
   escalation: EscalationState;
   onSend: (text: string) => void;
   onEscalate: (contact?: string) => void;
   onRate?: (messageId: string, vote: FeedbackVote) => void;
   onRetry?: () => void;
   feedback?: Record<string, FeedbackVote>;
   quickReplies?: string[];
   variant?: 'floating' | 'page';
   onClose?: () => void;
   onRestart?: () => void;
   onLocaleChange?: (code: string) => void;
}

// When `mood` is set the avatar shows that pose and pops on each change, so Mecha
// visibly "changes form" as the conversation shifts. Without it, the plain head.
function Avatar({ size = 32, mood }: { size?: number; mood?: MechaMood }): JSX.Element {
   return (
      <span
         className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3effe] dark:bg-[#281b35]"
         style={{ width: size, height: size }}
      >
         <img
            key={mood ?? 'static'}
            src={mood ? poseSrc(mood) : MECHA_AVATAR}
            alt=""
            className={`h-full w-full object-contain${mood ? ' mecha-pose-pop' : ''}`}
         />
      </span>
   );
}

// Only these hosts (and their subdomains) become live links. The model answers
// from our curated knowledge base, but an allowlist means a stray or malformed
// URL can never render as a clickable, tappable link — it stays plain text.
const SAFE_LINK_HOSTS = ['base.app', 'moodeng.app', 'moodeng.credit', 'moneybees.ph', 'youtube.com', 'youtu.be'];

function safeHttpUrl(raw: string): string | null {
   try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      const host = u.hostname.toLowerCase();
      return SAFE_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? u.toString() : null;
   } catch {
      return null;
   }
}

const LINK_CLASS = 'font-semibold text-[#6c3fe0] underline underline-offset-2 dark:text-[#d8c2ff]';

// Turn markdown links [text](url) and bare https URLs into anchors — but only for
// allowlisted hosts; anything else renders as its plain label.
function linkify(text: string, keyBase: string): (string | JSX.Element)[] {
   const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
   const out: (string | JSX.Element)[] = [];
   let last = 0;
   let m: RegExpExecArray | null;
   let n = 0;
   while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const label = m[1] ?? m[3];
      const rawUrl = m[2] ?? m[3];
      const safe = safeHttpUrl(rawUrl);
      if (safe) {
         out.push(
            <a key={`${keyBase}-a${n}`} href={safe} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
               {label}
            </a>
         );
      } else {
         out.push(label);
      }
      last = pattern.lastIndex;
      n += 1;
   }
   if (last < text.length) out.push(text.slice(last));
   return out;
}

// Render **bold** and safe links from the model's markdown; everything else stays
// plain text (whitespace-pre-wrap keeps its line breaks).
function renderRich(text: string): (string | JSX.Element)[] {
   return text.split(/\*\*(.+?)\*\*/g).flatMap((part, i) =>
      i % 2 === 1 ? [<strong key={`b${i}`}>{linkify(part, `b${i}`)}</strong>] : linkify(part, `t${i}`)
   );
}

function TypingDots({ label }: { label: string }): JSX.Element {
   return (
      <span className="inline-flex items-center gap-1 px-1 py-0.5" aria-label={label}>
         {[0, 1, 2].map((i) => (
            <span key={i} className="mecha-dot h-1.5 w-1.5 rounded-full bg-[#8b7aa8] dark:bg-[#9a8fb0]" />
         ))}
      </span>
   );
}

export default function MechaChatPanel({
   locale,
   messages,
   isSending,
   escalation,
   onSend,
   onEscalate,
   onRate,
   onRetry,
   feedback,
   quickReplies = EMPTY_QUICK_REPLIES,
   variant = 'floating',
   onClose,
   onRestart,
   onLocaleChange
}: MechaChatPanelProps): JSX.Element {
   const copy = getMechaCopy(locale);
   const [draft, setDraft] = useState('');
   const [contact, setContact] = useState('');
   const scrollRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
   }, [messages, isSending, escalation]);

   useEffect(() => {
      preloadMechaPoses();
   }, []);

   const submit = () => {
      const text = draft.trim();
      if (!text) return;
      onSend(text);
      setDraft('');
   };

   const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
         e.preventDefault();
         submit();
      }
   };

   const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
   const showHandoff = (Boolean(lastAssistant?.offerHuman) || escalation === 'error') && escalation !== 'sent';
   const hasUserTurn = messages.some((m) => m.role === 'user');
   const showQuickReplies = quickReplies.length > 0 && !hasUserTurn;
   const lastMessage = messages[messages.length - 1];
   const showRetry = Boolean(onRetry) && !isSending && Boolean(lastMessage?.isError);
   // Rate only real, successful answers (an assistant turn following a question).
   const ratableId = hasUserTurn && !isSending && !lastAssistant?.isError ? lastAssistant?.id : undefined;

   // Mecha's headshot changes to match the moment — the heart of "giving it spirit".
   const headerMood: MechaMood = (() => {
      if (escalation === 'sent') return 'salute'; // handed you to the team — on it
      if (isSending) return 'think'; // working on your answer
      if (lastAssistant && feedback?.[lastAssistant.id] === 'up') return 'thumbsup'; // you liked it
      if (showHandoff || lastMessage?.isError) return 'shrug'; // not sure / something failed
      if (messages.length === 0) return 'wave'; // fresh open — say hi
      return 'present'; // resting, ready
   })();

   return (
      <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-[#17121F]">
         {/* Header */}
         <div className="flex items-center gap-3 border-b border-[#efe9fb] px-4 py-3 dark:border-[#2a2235]">
            <Avatar size={36} mood={headerMood} />
            <div className="min-w-0 flex-1">
               <p className="truncate text-[15px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">{copy.name}</p>
               <p className="flex items-center gap-1.5 text-[12px] leading-tight text-[#5b5470] dark:text-[#B5ACBE]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                  {copy.tagline}
               </p>
            </div>
            {onLocaleChange ? (
               <div className="flex items-center gap-0.5 rounded-full border border-[#e6ddf6] p-0.5 dark:border-[#40354F]" role="group" aria-label="Language">
                  {MECHA_LANGS.map((l) => {
                     const active = (locale || 'en') === l.code;
                     return (
                        <button
                           key={l.code}
                           type="button"
                           onClick={() => onLocaleChange(l.code)}
                           aria-pressed={active}
                           title={l.label}
                           className={`flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-semibold leading-none transition-colors ${
                              active
                                 ? 'bg-[#6c3fe0] text-white'
                                 : 'text-[#5b5470] hover:bg-[#f3effe] dark:text-[#B5ACBE] dark:hover:bg-[#281b35]'
                           }`}
                        >
                           <span aria-hidden="true">{l.flag}</span>
                           {l.short}
                        </button>
                     );
                  })}
               </div>
            ) : null}
            {onRestart && messages.length > 0 ? (
               <button
                  type="button"
                  onClick={onRestart}
                  className="rounded-full px-2 py-1 text-[12px] font-medium text-[#5b5470] transition-colors hover:bg-[#f3effe] dark:text-[#B5ACBE] dark:hover:bg-[#281b35]"
               >
                  {copy.restart}
               </button>
            ) : null}
            {onClose ? (
               <button
                  type="button"
                  onClick={onClose}
                  aria-label={copy.closeLabel}
                  className="shrink-0 rounded-full p-1.5 text-[#9a8fb0] transition-colors hover:bg-[#f3effe] hover:text-[#5b5470] dark:hover:bg-[#281b35]"
               >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                     <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
               </button>
            ) : null}
         </div>

         {/* Messages */}
         <div ref={scrollRef} className="mecha-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
               <div className="mecha-msg flex items-end gap-2">
                  <Avatar mood="wave" />
                  <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-[#f3effe] px-3.5 py-2.5 text-[14px] leading-snug text-[#1b0a36] dark:bg-[#241a33] dark:text-[#F8F4FF]">
                     {copy.greeting}
                  </div>
               </div>
            ) : null}

            {messages.map((m) =>
               m.role === 'user' ? (
                  <div key={m.id} className="mecha-msg flex justify-end">
                     <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#6c3fe0] px-3.5 py-2.5 text-[14px] leading-snug text-white">
                        {m.content}
                     </div>
                  </div>
               ) : (
                  <div key={m.id} className="mecha-msg flex items-end gap-2">
                     <Avatar mood={m.isError ? 'shrug' : 'present'} />
                     <div className="max-w-[82%]">
                        <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[#f3effe] px-3.5 py-2.5 text-[14px] leading-snug text-[#1b0a36] dark:bg-[#241a33] dark:text-[#F8F4FF]">
                           {renderRich(m.content)}
                        </div>
                        {onRate && m.id === ratableId ? (
                           <div className="mt-1 flex items-center gap-1 pl-1">
                              {feedback?.[m.id] ? (
                                 <span className="text-[11px] text-[#9a8fb0] dark:text-[#7b7091]">
                                    {feedback[m.id] === 'up' ? '👍' : '👎'} {copy.feedbackThanks}
                                 </span>
                              ) : (
                                 <>
                                    <button
                                       type="button"
                                       onClick={() => onRate(m.id, 'up')}
                                       aria-label={copy.feedbackUp}
                                       title={copy.feedbackUp}
                                       className="rounded-full px-1.5 py-0.5 text-[13px] opacity-60 transition-opacity hover:opacity-100"
                                    >
                                       👍
                                    </button>
                                    <button
                                       type="button"
                                       onClick={() => onRate(m.id, 'down')}
                                       aria-label={copy.feedbackDown}
                                       title={copy.feedbackDown}
                                       className="rounded-full px-1.5 py-0.5 text-[13px] opacity-60 transition-opacity hover:opacity-100"
                                    >
                                       👎
                                    </button>
                                 </>
                              )}
                           </div>
                        ) : null}
                     </div>
                  </div>
               )
            )}

            {isSending ? (
               <div className="mecha-msg flex items-end gap-2">
                  <Avatar mood="think" />
                  <div className="rounded-2xl rounded-bl-md bg-[#f3effe] px-2 py-2 dark:bg-[#241a33]">
                     <TypingDots label={copy.typingLabel} />
                  </div>
               </div>
            ) : null}

            {showQuickReplies ? (
               <div className="pt-1">
                  <p className="mb-2 pl-1 text-[12px] font-medium text-[#5b5470] dark:text-[#B5ACBE]">{copy.suggestionsLabel}</p>
                  <div className="flex flex-wrap gap-2">
                     {quickReplies.map((q) => (
                        <button
                           key={q}
                           type="button"
                           onClick={() => onSend(q)}
                           className="rounded-full border border-[#e6ddf6] px-3 py-1.5 text-[13px] font-medium text-[#6c3fe0] transition-colors hover:bg-[#f3effe] dark:border-[#40354F] dark:text-[#d8c2ff] dark:hover:bg-[#281b35]"
                        >
                           {q}
                        </button>
                     ))}
                  </div>
               </div>
            ) : null}

            {showRetry ? (
               <div className="pl-1">
                  <button
                     type="button"
                     onClick={onRetry}
                     className="inline-flex items-center gap-1.5 rounded-full border border-[#e6ddf6] px-3 py-1.5 text-[13px] font-semibold text-[#6c3fe0] transition-colors hover:bg-[#f3effe] dark:border-[#40354F] dark:text-[#d8c2ff] dark:hover:bg-[#281b35]"
                  >
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 12a8 8 0 1 1 2.3 5.6M4 20v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                     </svg>
                     {copy.tryAgain}
                  </button>
               </div>
            ) : null}

            {showHandoff ? (
               <div className="rounded-2xl border border-[#e6ddf6] bg-[#f3effe] p-3.5 dark:border-[#40354F] dark:bg-[#211830]">
                  <p className="text-[13px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">{copy.humanTitle}</p>
                  <p className="mt-1 text-[13px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">{copy.humanBody}</p>
                  <input
                     type="text"
                     value={contact}
                     onChange={(e) => setContact(e.target.value)}
                     placeholder={copy.contactPlaceholder}
                     className="mt-2.5 w-full rounded-xl border border-[#e6ddf6] bg-white px-3 py-2 text-[13px] text-[#1b0a36] outline-none placeholder:text-[#9a8fb0] focus:border-[#6c3fe0] dark:border-[#40354F] dark:bg-[#1e1730] dark:text-[#F8F4FF]"
                  />
                  <button
                     type="button"
                     onClick={() => onEscalate(contact.trim() || undefined)}
                     disabled={escalation === 'sending'}
                     className="mt-2.5 w-full rounded-xl bg-[#6c3fe0] px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                  >
                     {escalation === 'sending' ? copy.humanSending : copy.humanCta}
                  </button>
               </div>
            ) : null}
         </div>

         {/* Composer */}
         <div className="border-t border-[#efe9fb] px-3 py-3 dark:border-[#2a2235]">
            <div className="flex items-end gap-2">
               <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  maxLength={1000}
                  placeholder={copy.inputPlaceholder}
                  className="mecha-scroll max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-[#e6ddf6] bg-white px-3.5 py-2.5 text-[14px] leading-snug text-[#1b0a36] outline-none placeholder:text-[#9a8fb0] focus:border-[#6c3fe0] dark:border-[#40354F] dark:bg-[#1e1730] dark:text-[#F8F4FF]"
               />
               <button
                  type="button"
                  onClick={submit}
                  disabled={!draft.trim() || isSending}
                  aria-label={copy.send}
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-white transition-opacity hover:opacity-95 disabled:opacity-40"
               >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                     <path d="M4 12l16-8-6 16-3-6-7-2z" fill="currentColor" />
                  </svg>
               </button>
            </div>
            {variant === 'floating' ? (
               <p className="mt-2 text-center text-[11px] leading-tight text-[#9a8fb0] dark:text-[#7b7091]">
                  {copy.footerNote}
               </p>
            ) : null}
         </div>
      </div>
   );
}
