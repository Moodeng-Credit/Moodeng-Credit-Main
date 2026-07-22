import { type JSX, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { poseSrc } from '@/components/mecha/mechaAssets';
import MechaChatPanel from '@/components/mecha/MechaChatPanel';
import { getMechaCopy } from '@/components/mecha/mechaCopy';
import { loadMechaLocale, saveMechaLocale } from '@/components/mecha/mechaStorage';
import { type LocalizedText, pickText } from '@/components/mecha/stepContext';
import { useMechaChat } from '@/components/mecha/useMechaChat';

import { useLocalization } from '@/i18n';

// Chat-first help destination (Direction 03). Public + shareable — the link to
// paste into the Facebook group. Cards seed the chat rather than deep-linking to
// auth-gated guide pages, so it works for logged-out visitors too.

type PopularItem = { emoji: string; title: LocalizedText; subtitle: LocalizedText; ask: LocalizedText };

const POPULAR: PopularItem[] = [
   {
      emoji: '🪪',
      title: { en: 'Verify your ID', fil: 'I-verify ang ID mo' },
      subtitle: { en: 'The quick 3-minute check', fil: 'Mabilis na 3-minutong check' },
      ask: { en: 'How do I verify my ID?', fil: 'Paano i-verify ang ID ko?' }
   },
   {
      emoji: '🏦',
      title: { en: 'Cash out to a bank', fil: 'Mag-cash out sa bank' },
      subtitle: { en: 'USDC → pesos, step by step', fil: 'USDC → pesos, hakbang-hakbang' },
      ask: { en: 'How do I cash out to GCash or my bank?', fil: 'Paano mag-cash out sa GCash o sa bank ko?' }
   },
   {
      emoji: '🔗',
      title: { en: "Wallet won't connect", fil: 'Ayaw kumonekta ng wallet' },
      subtitle: { en: 'The reset that works', fil: 'Ang reset na gumagana' },
      ask: { en: "My wallet won't connect to Moodeng — what do I do?", fil: 'Ayaw kumonekta ng wallet ko sa Moodeng — ano ang gagawin ko?' }
   },
   {
      emoji: '💸',
      title: { en: 'How to repay', fil: 'Paano magbayad' },
      subtitle: { en: 'Buy USDC + send on Base', fil: 'Bumili ng USDC + ipadala sa Base' },
      ask: { en: 'How do I repay my loan?', fil: 'Paano bayaran ang loan ko?' }
   },
   {
      emoji: '📈',
      title: { en: 'Grow my credit limit', fil: 'Palakihin ang credit limit' },
      subtitle: { en: 'From $15 upward', fil: 'Mula $15 pataas' },
      ask: { en: 'How do I increase my credit limit?', fil: 'Paano tumaas ang credit limit ko?' }
   },
   {
      emoji: '🟣',
      title: { en: 'Coinbase vs Base', fil: 'Coinbase vs Base' },
      subtitle: { en: 'Which one do I need?', fil: 'Alin ang kailangan ko?' },
      ask: { en: 'Do I need the Coinbase app or a Base Account?', fil: 'Kailangan ko ba ang Coinbase app o Base Account?' }
   }
];

export default function HelpHub(): JSX.Element {
   const { locale: appLocale } = useLocalization();
   const [locale, setLocale] = useState<string>(() => loadMechaLocale(appLocale));
   const changeLocale = (code: string) => {
      saveMechaLocale(code);
      setLocale(code);
   };
   const navigate = useNavigate();
   const copy = getMechaCopy(locale);
   const chat = useMechaChat({ locale, getContext: () => ({ page: 'Help hub', step: 'help-hub' }), persistKey: 'help' });

   return (
      <div className="min-h-screen bg-[#faf8ff] px-4 pb-16 pt-8 dark:bg-[#100d17]">
         <div className="mx-auto w-full max-w-xl">
            {/* Header */}
            <div className="flex items-center gap-3">
               <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#f3effe] dark:bg-[#281b35]">
                  <img src={poseSrc('wave')} alt="" className="h-11 w-11 object-contain" />
               </span>
               <div>
                  <h1 className="text-[22px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">{copy.helpTitle}</h1>
                  <p className="text-[14px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">{copy.helpSubtitle}</p>
               </div>
            </div>

            {/* Chat card */}
            <div className="mt-5 h-[520px] max-h-[70vh] overflow-hidden rounded-3xl border border-[#efe9fb] bg-white shadow-[0_12px_44px_rgba(27,10,54,0.10)] dark:border-[#2a2235] dark:bg-[#17121F]">
               <MechaChatPanel
                  locale={locale}
                  messages={chat.messages}
                  isSending={chat.isSending}
                  escalation={chat.escalation}
                  onSend={chat.send}
                  onEscalate={chat.escalate}
                  onRate={chat.rate}
                  onRetry={chat.retryLast}
                  feedback={chat.feedback}
                  onRestart={chat.reset}
                  onLocaleChange={changeLocale}
                  quickReplies={POPULAR.slice(0, 4).map((p) => pickText(p.ask, locale))}
                  variant="page"
               />
            </div>

            {/* Popular topics */}
            <p className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-wide text-[#5b5470] dark:text-[#B5ACBE]">
               {copy.popularLabel}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
               {POPULAR.map((item) => (
                  <button
                     key={item.title.en}
                     type="button"
                     onClick={() => chat.send(pickText(item.ask, locale))}
                     className="flex items-center gap-3 rounded-2xl border border-[#efe9fb] bg-white px-4 py-3 text-left transition-colors hover:border-[#d9c9fb] hover:bg-[#faf7ff] dark:border-[#2a2235] dark:bg-[#171320] dark:hover:bg-[#1e1730]"
                  >
                     <span className="text-2xl">{item.emoji}</span>
                     <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">{pickText(item.title, locale)}</span>
                        <span className="block truncate text-[13px] text-[#5b5470] dark:text-[#B5ACBE]">{pickText(item.subtitle, locale)}</span>
                     </span>
                  </button>
               ))}
            </div>

            {/* Browse everything */}
            <button
               type="button"
               onClick={() => navigate('/support/faq')}
               className="mt-5 w-full rounded-2xl border border-[#efe9fb] bg-white px-4 py-3 text-center text-[14px] font-medium text-[#6c3fe0] transition-colors hover:bg-[#f3effe] dark:border-[#2a2235] dark:bg-[#171320] dark:text-[#d8c2ff] dark:hover:bg-[#1e1730]"
            >
               {copy.browseAll}
            </button>
         </div>
      </div>
   );
}
