import { type JSX, useState } from 'react';

import { ChevronDown, Facebook, Info, MessageCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { pickText } from '@/components/mecha/stepContext';

import { identifySupport, isSupportChatEnabled, openSupportChat } from '@/lib/support/liveChat';
import type { HelpTopic } from '@/views/help/helpTopics';
import { SUPPORT_FACEBOOK_URL, TELEGRAM_URL } from '@/views/support/constants';

// One expandable answer, plus the "still not clear?" row underneath it.
//
// The row is the whole point of the redesign. Answering in place fixes the
// common case, but a canned answer that does not fit your situation is worse
// than no answer if it dead-ends — so every topic ends with three live ways out,
// and each one carries the question with it:
//
//   Ask us   → opens the chat with the topic attached; the team is pinged in
//              Telegram by the tawk-webhook function, and the reply comes back
//              here plus by email.
//   Telegram → t.me deep link with the question pre-filled as the message.
//   Facebook → Messenger cannot pre-fill, so we copy the question to the
//              clipboard first and say so, which is the closest honest thing.

interface HelpTopicCardProps {
   topic: HelpTopic;
   locale: string;
}

export default function HelpTopicCard({ topic, locale }: HelpTopicCardProps): JSX.Element {
   const navigate = useNavigate();
   const [isOpen, setIsOpen] = useState(false);
   const [copied, setCopied] = useState(false);

   const question = pickText(topic.question, locale);
   const steps = (locale === 'fil' ? topic.steps.fil : topic.steps.en) ?? topic.steps.en;
   const panelId = `help-topic-${topic.id}`;

   const askUs = () => {
      identifySupport({ data: { from_page: 'Help hub', help_topic: topic.id } });
      openSupportChat(question);
   };

   const openFacebook = async () => {
      // Best-effort: if the clipboard is unavailable (older Safari, insecure
      // context) we still open Messenger — they just retype the question.
      try {
         await navigator.clipboard.writeText(question);
         setCopied(true);
         window.setTimeout(() => setCopied(false), 4000);
      } catch {
         /* clipboard unavailable — opening Messenger is still the useful half */
      }
      window.open(SUPPORT_FACEBOOK_URL, '_blank', 'noopener,noreferrer');
   };

   const telegramHref = `${TELEGRAM_URL}?text=${encodeURIComponent(question)}`;

   return (
      <div className="overflow-hidden rounded-2xl border border-[#efe9fb] bg-white transition-colors dark:border-[#2a2235] dark:bg-[#171320]">
         <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls={panelId}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#faf7ff] dark:hover:bg-[#1e1730]"
         >
            <span className="text-2xl" aria-hidden="true">
               {topic.emoji}
            </span>
            <span className="min-w-0 flex-1">
               <span className="block truncate text-[14px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">
                  {pickText(topic.title, locale)}
               </span>
               <span className="block truncate text-[13px] text-[#5b5470] dark:text-[#B5ACBE]">{pickText(topic.subtitle, locale)}</span>
            </span>
            <ChevronDown
               className={`h-4 w-4 shrink-0 text-[#8b8299] transition-transform ${isOpen ? 'rotate-180' : ''}`}
               aria-hidden="true"
            />
         </button>

         {isOpen ? (
            <div id={panelId} className="border-t border-[#f3effe] px-4 pb-4 pt-3 dark:border-[#2a2235]">
               <ol className="ml-4 list-decimal space-y-1.5 text-[13.5px] leading-relaxed text-[#3d3450] marker:text-[#8b8299] dark:text-[#D5CEDD]">
                  {steps.map((step) => (
                     <li key={step}>{step}</li>
                  ))}
               </ol>

               {topic.watchOut ? (
                  <div className="mt-3 flex gap-2 rounded-xl bg-[#f7f3ff] px-3 py-2.5 dark:bg-[#1e1730]">
                     <Info className="mt-[2px] h-4 w-4 shrink-0 text-[#6c3fe0] dark:text-[#d8c2ff]" aria-hidden="true" />
                     <p className="text-[13px] leading-snug text-[#3d3450] dark:text-[#D5CEDD]">{pickText(topic.watchOut, locale)}</p>
                  </div>
               ) : null}

               {topic.guide ? (
                  <button
                     type="button"
                     onClick={() => navigate(topic.guide!.path)}
                     className="mt-3 text-[13px] font-semibold text-[#6c3fe0] underline-offset-2 hover:underline dark:text-[#d8c2ff]"
                  >
                     {pickText(topic.guide.label, locale)} →
                  </button>
               ) : null}

               {/* The escape hatch */}
               <div className="mt-4 border-t border-[#f3effe] pt-3 dark:border-[#2a2235]">
                  <p className="text-[13px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">
                     {locale === 'fil' ? 'Hindi pa rin malinaw?' : 'Still not clear?'}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">
                     {locale === 'fil'
                        ? 'Dalhin ang tanong na ito sa isang tao — sasagutin ka namin.'
                        : "Take this question to a person — we'll get back to you."}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                     {isSupportChatEnabled ? (
                        <button
                           type="button"
                           onClick={askUs}
                           className="inline-flex items-center gap-1.5 rounded-full bg-[#6c3fe0] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#5c33c8]"
                        >
                           <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                           {locale === 'fil' ? 'Tanungin kami' : 'Ask us'}
                        </button>
                     ) : null}
                     <a
                        href={telegramHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#e6ddf6] px-3.5 py-2 text-[13px] font-semibold text-[#5b5470] transition-colors hover:bg-[#f3effe] dark:border-[#40354F] dark:text-[#B5ACBE] dark:hover:bg-[#281b35]"
                     >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        Telegram
                     </a>
                     <button
                        type="button"
                        onClick={openFacebook}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#e6ddf6] px-3.5 py-2 text-[13px] font-semibold text-[#5b5470] transition-colors hover:bg-[#f3effe] dark:border-[#40354F] dark:text-[#B5ACBE] dark:hover:bg-[#281b35]"
                     >
                        <Facebook className="h-3.5 w-3.5" aria-hidden="true" />
                        Facebook
                     </button>
                  </div>
                  {copied ? (
                     <p className="mt-2 text-[12.5px] text-[#6c3fe0] dark:text-[#d8c2ff]">
                        {locale === 'fil' ? 'Nakopya ang tanong — i-paste mo na lang.' : 'Question copied — just paste it.'}
                     </p>
                  ) : null}
               </div>
            </div>
         ) : null}
      </div>
   );
}
