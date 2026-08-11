import { type JSX, useMemo, useState } from 'react';

import { Facebook, Mail, MessageCircle, Search, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { type LocalizedText, pickText } from '@/components/mecha/stepContext';

import { useLocalization } from '@/i18n';
import { isSupportChatEnabled, openSupportChat } from '@/lib/support/liveChat';
import HelpTopicCard from '@/views/help/HelpTopicCard';
import { HELP_CATEGORIES, HELP_TOPICS, type HelpTopic } from '@/views/help/helpTopics';
import { SUPPORT_EMAIL, SUPPORT_FACEBOOK_URL, TELEGRAM_SUPPORT_URL } from '@/views/support/constants';

// The Moodeng help center. Public + shareable — this is the link to paste into
// the Facebook group.
//
// It is built to feel like a real fintech help center: a search, categorized
// answers a borrower can open in place, and — because a canned answer that does
// not fit is worse than none — a human channel on every answer and at the
// bottom of the page. The answers themselves live in helpTopics.ts, sourced
// from the team's vetted troubleshooting / FAQ / guide content so nothing here
// is invented and nothing drifts.
//
// Live chat is not required for the page to work: when it is unconfigured the
// "Message the team" card is dropped and Telegram / Facebook / email lead.

const COPY = {
   title: { en: 'How can we help?', fil: 'Paano ka namin matutulungan?' },
   subtitle: {
      en: 'Search below, or browse the topics. A real person is one tap away on every answer.',
      fil: 'Maghanap sa ibaba, o mag-browse ng mga paksa. May totoong tao na isang tap lang sa bawat sagot.'
   },
   searchPlaceholder: { en: 'Search help — wallet, cash out, verify…', fil: 'Maghanap — wallet, cash out, verify…' },
   chatTitle: { en: 'Message the Moodeng team', fil: 'Mag-message sa Moodeng team' },
   chatBody: {
      en: 'Payouts, verification, wallets, repayments — anything. We answer here and by email, so you will not miss the reply.',
      fil: 'Payout, verification, wallet, bayad — kahit ano. Sasagot kami dito at sa email, kaya hindi mo mami-miss ang sagot.'
   },
   chatCta: { en: 'Start a conversation', fil: 'Magsimula ng usapan' },
   replyTime: { en: 'We usually reply within a few hours.', fil: 'Karaniwan kaming sumasagot sa loob ng ilang oras.' },
   resultsLabel: { en: 'Results', fil: 'Mga resulta' },
   noResults: { en: 'No answers matched — try different words, or reach us below.', fil: 'Walang tumugmang sagot — subukan ang ibang salita, o kontakin kami sa ibaba.' },
   clearSearch: { en: 'Clear search', fil: 'I-clear ang search' },
   stillLabel: { en: 'Still need help?', fil: 'Kailangan mo pa ng tulong?' },
   stillBody: {
      en: 'Reach the Moodeng team directly — pick whichever is easiest.',
      fil: 'Kontakin nang diretso ang Moodeng team — piliin ang pinakamadali.'
   },
   telegram: { en: 'Telegram', fil: 'Telegram' },
   facebook: { en: 'Facebook', fil: 'Facebook' },
   email: { en: 'Email', fil: 'Email' },
   browseAll: { en: 'Browse all FAQs & guides →', fil: 'Tingnan lahat ng FAQ at gabay →' }
} satisfies Record<string, LocalizedText>;

/** Flatten a topic into one lowercase haystack for search. */
function haystack(topic: HelpTopic): string {
   const parts: string[] = [
      topic.title.en,
      topic.title.fil,
      topic.subtitle.en,
      topic.subtitle.fil,
      topic.question.en,
      topic.question.fil,
      ...(topic.keywords ?? [])
   ];
   if (topic.intro) parts.push(topic.intro.en, topic.intro.fil);
   if (topic.steps) parts.push(...topic.steps.en, ...topic.steps.fil);
   if (topic.watchOut) parts.push(topic.watchOut.en, topic.watchOut.fil);
   return parts.join(' • ').toLowerCase();
}

export default function HelpHub(): JSX.Element {
   const { locale } = useLocalization();
   const navigate = useNavigate();
   const t = (key: keyof typeof COPY) => pickText(COPY[key], locale);
   const [query, setQuery] = useState('');

   const trimmed = query.trim().toLowerCase();
   const results = useMemo(() => {
      if (!trimmed) return null;
      // Match on every whitespace-separated term, so "cash bank" narrows rather
      // than widens — the same behaviour the FAQ search uses.
      const terms = trimmed.split(/\s+/);
      return HELP_TOPICS.filter((topic) => {
         const hay = haystack(topic);
         return terms.every((term) => hay.includes(term));
      });
   }, [trimmed]);

   return (
      <div className="min-h-screen bg-[#faf8ff] px-4 pb-16 pt-8 dark:bg-[#100d17]">
         <div className="mx-auto w-full max-w-2xl">
            {/* Header */}
            <div className="flex items-center gap-3">
               <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#f3effe] dark:bg-[#281b35]">
                  <img src="/brand/moodeng-logo.png" alt="" className="h-11 w-11 object-contain" />
               </span>
               <div>
                  <h1 className="text-[22px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">{t('title')}</h1>
                  <p className="text-[14px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">{t('subtitle')}</p>
               </div>
            </div>

            {/* Search */}
            <div className="relative mt-5">
               <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8b8299]" aria-hidden="true" />
               <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                  className="w-full rounded-2xl border border-[#efe9fb] bg-white py-3.5 pl-11 pr-11 text-[15px] text-[#1b0a36] shadow-[0_8px_30px_rgba(27,10,54,0.06)] outline-none transition-colors placeholder:text-[#9a8fb0] focus:border-[#c8a6f8] dark:border-[#2a2235] dark:bg-[#17121F] dark:text-[#F8F4FF] dark:placeholder:text-[#8f819e] dark:focus:border-[#6c3fe0]"
               />
               {query ? (
                  <button
                     type="button"
                     onClick={() => setQuery('')}
                     aria-label={t('clearSearch')}
                     className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8b8299] transition-colors hover:bg-[#f3effe] hover:text-[#5b5470] dark:hover:bg-[#281b35]"
                  >
                     <X className="h-4 w-4" aria-hidden="true" />
                  </button>
               ) : null}
            </div>

            {/* Message the team — primary human path. Hidden when live chat is off. */}
            {isSupportChatEnabled && !results ? (
               <div className="mt-5 rounded-3xl border border-[#efe9fb] bg-white p-5 shadow-[0_12px_44px_rgba(27,10,54,0.10)] dark:border-[#2a2235] dark:bg-[#17121F]">
                  <h2 className="text-[17px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">{t('chatTitle')}</h2>
                  <p className="mt-1.5 text-[14px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">{t('chatBody')}</p>
                  <button
                     type="button"
                     onClick={() => openSupportChat()}
                     className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6c3fe0] px-4 py-3 text-[15px] font-semibold text-white transition-transform hover:bg-[#5c33c8] active:scale-[0.99]"
                  >
                     <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
                     {t('chatCta')}
                  </button>
                  <p className="mt-2.5 text-center text-[12.5px] text-[#8b8299] dark:text-[#8f869c]">{t('replyTime')}</p>
               </div>
            ) : null}

            {/* Results (when searching) */}
            {results ? (
               <div className="mt-6">
                  <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#5b5470] dark:text-[#B5ACBE]">
                     {t('resultsLabel')} · {results.length}
                  </p>
                  {results.length > 0 ? (
                     <div className="flex flex-col gap-2.5">
                        {results.map((topic) => (
                           <HelpTopicCard key={topic.id} topic={topic} locale={locale} />
                        ))}
                     </div>
                  ) : (
                     <p className="rounded-2xl border border-[#efe9fb] bg-white px-4 py-6 text-center text-[14px] text-[#5b5470] dark:border-[#2a2235] dark:bg-[#171320] dark:text-[#B5ACBE]">
                        {t('noResults')}
                     </p>
                  )}
               </div>
            ) : (
               /* Category sections (default) */
               <div className="mt-8 flex flex-col gap-8">
                  {HELP_CATEGORIES.map((category) => {
                     const topics = HELP_TOPICS.filter((topic) => topic.category === category.id);
                     if (topics.length === 0) return null;
                     return (
                        <section key={category.id}>
                           <div className="mb-3 flex items-center gap-2.5">
                              <span className="text-xl" aria-hidden="true">
                                 {category.emoji}
                              </span>
                              <div className="min-w-0">
                                 <h2 className="text-[15px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">
                                    {pickText(category.label, locale)}
                                 </h2>
                                 <p className="truncate text-[12.5px] leading-snug text-[#8b8299] dark:text-[#8f869c]">
                                    {pickText(category.blurb, locale)}
                                 </p>
                              </div>
                           </div>
                           <div className="flex flex-col gap-2.5">
                              {topics.map((topic) => (
                                 <HelpTopicCard key={topic.id} topic={topic} locale={locale} />
                              ))}
                           </div>
                        </section>
                     );
                  })}
               </div>
            )}

            {/* Still need help — always present, reachable channels */}
            <div className="mt-10 rounded-3xl border border-[#efe9fb] bg-white p-5 dark:border-[#2a2235] dark:bg-[#17121F]">
               <h2 className="text-[16px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">{t('stillLabel')}</h2>
               <p className="mt-1 text-[13.5px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">{t('stillBody')}</p>
               <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {[
                     { icon: Send, label: t('telegram'), href: TELEGRAM_SUPPORT_URL },
                     { icon: Facebook, label: t('facebook'), href: SUPPORT_FACEBOOK_URL },
                     { icon: Mail, label: t('email'), href: `mailto:${SUPPORT_EMAIL}` }
                  ].map(({ icon: Icon, label, href }) => (
                     <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#efe9fb] bg-[#faf8ff] px-3 py-3.5 text-[13px] font-medium text-[#5b5470] transition-colors hover:bg-[#f3effe] dark:border-[#2a2235] dark:bg-[#171320] dark:text-[#B5ACBE] dark:hover:bg-[#1e1730]"
                     >
                        <Icon className="h-[18px] w-[18px] text-[#6c3fe0] dark:text-[#d8c2ff]" aria-hidden="true" />
                        {label}
                     </a>
                  ))}
               </div>
               <button
                  type="button"
                  onClick={() => navigate('/support/faq')}
                  className="mt-3 w-full rounded-2xl border border-[#efe9fb] bg-[#faf8ff] px-4 py-3 text-center text-[14px] font-medium text-[#6c3fe0] transition-colors hover:bg-[#f3effe] dark:border-[#2a2235] dark:bg-[#171320] dark:text-[#d8c2ff] dark:hover:bg-[#1e1730]"
               >
                  {t('browseAll')}
               </button>
            </div>
         </div>
      </div>
   );
}
