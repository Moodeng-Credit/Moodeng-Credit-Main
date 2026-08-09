import { type JSX } from 'react';

import { Facebook, Mail, MessageCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { type LocalizedText, pickText } from '@/components/mecha/stepContext';

import { useLocalization } from '@/i18n';
import { isSupportChatEnabled, openSupportChat } from '@/lib/support/liveChat';
import HelpTopicCard from '@/views/help/HelpTopicCard';
import { HELP_TOPICS } from '@/views/help/helpTopics';
import { SUPPORT_EMAIL, SUPPORT_FACEBOOK_URL, TELEGRAM_SUPPORT_URL } from '@/views/support/constants';

// The Help destination. Public + shareable — this is the link to paste into the
// Facebook group.
//
// It used to open an AI chat panel (Mecha) inline. That is what borrowers were
// hitting when something had genuinely gone wrong with their money, and it went
// nowhere: Mecha answers from the help docs, and the Facebook/Telegram links
// that reach a person live in the quick-start guide where nobody was finding
// them. So the page now leads with a real conversation — live chat, straight
// into the team's inbox — and keeps Telegram, Facebook and email underneath as
// alternatives for people who already prefer them.
//
// When live chat is unconfigured the chat card is dropped and Telegram /
// Facebook / email are promoted to the top, so the page is never a dead end.

const COPY = {
   title: { en: 'How can we help?', fil: 'Paano ka namin matutulungan?' },
   subtitle: {
      en: 'Send us a message and a real person will reply.',
      fil: 'Mag-message sa amin at sasagutin ka ng totoong tao.'
   },
   chatTitle: { en: 'Message the Moodeng team', fil: 'Mag-message sa Moodeng team' },
   chatBody: {
      en: 'Tell us what went wrong — payouts, verification, wallets, repayments, anything. We answer here and by email, so you will not miss the reply.',
      fil: 'Sabihin mo kung ano ang nangyari — payout, verification, wallet, bayad, kahit ano. Sasagot kami dito at sa email, kaya hindi mo mami-miss ang sagot.'
   },
   chatCta: { en: 'Start a conversation', fil: 'Magsimula ng usapan' },
   replyTime: { en: 'We usually reply within a few hours.', fil: 'Karaniwan kaming sumasagot sa loob ng ilang oras.' },
   popularLabel: { en: 'Common questions', fil: 'Mga karaniwang tanong' },
   popularHint: {
      en: "Tap one for the answer. If it doesn't fit your situation, every answer has a way to reach a person.",
      fil: 'I-tap ang isa para sa sagot. Kung hindi ito bagay sa sitwasyon mo, may paraan sa bawat sagot para makausap ang tao.'
   },
   otherLabel: { en: 'Other ways to reach us', fil: 'Iba pang paraan para makausap kami' },
   // Used when live chat is off and these are the only channels — "other ways"
   // would be pointing at nothing.
   onlyLabel: { en: 'Reach us here', fil: 'Makipag-ugnayan dito' },
   telegram: { en: 'Telegram', fil: 'Telegram' },
   facebook: { en: 'Facebook', fil: 'Facebook' },
   email: { en: 'Email', fil: 'Email' },
   browseAll: { en: 'Browse all FAQs & guides →', fil: 'Tingnan lahat ng FAQ at gabay →' }
} satisfies Record<string, LocalizedText>;

export default function HelpHub(): JSX.Element {
   const { locale } = useLocalization();
   const navigate = useNavigate();
   const t = (key: keyof typeof COPY) => pickText(COPY[key], locale);

   return (
      <div className="min-h-screen bg-[#faf8ff] px-4 pb-16 pt-8 dark:bg-[#100d17]">
         <div className="mx-auto w-full max-w-xl">
            {/* Header */}
            <div className="flex items-center gap-3">
               {/* Moodeng, not Mecha. This page hands you to a person now, so the face
                   on it is the brand's, not the retired AI assistant's. */}
               <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#f3effe] dark:bg-[#281b35]">
                  <img src="/brand/moodeng-logo.png" alt="" className="h-11 w-11 object-contain" />
               </span>
               <div>
                  <h1 className="text-[22px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">{t('title')}</h1>
                  <p className="text-[14px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">{t('subtitle')}</p>
               </div>
            </div>

            {/* Primary: talk to a human */}
            {isSupportChatEnabled ? (
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

            {/* Answers first. Not gated on live chat: the answer is useful even when
                the widget is unconfigured, and each card still offers Telegram and
                Facebook as ways to reach a person. */}
            <p className="mb-1 mt-8 text-[13px] font-semibold uppercase tracking-wide text-[#5b5470] dark:text-[#B5ACBE]">
               {t('popularLabel')}
            </p>
            <p className="mb-3 text-[13px] leading-snug text-[#8b8299] dark:text-[#8f869c]">{t('popularHint')}</p>
            <div className="flex flex-col gap-2.5">
               {HELP_TOPICS.map((topic) => (
                  <HelpTopicCard key={topic.id} topic={topic} locale={locale} />
               ))}
            </div>

            {/* Fallback channels for people who already live in Telegram or Facebook.
                When live chat is off these are the only channels, so they lead. */}
            <p
               className={`mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#5b5470] dark:text-[#B5ACBE] ${isSupportChatEnabled ? 'mt-8' : 'mt-6'}`}
            >
               {t(isSupportChatEnabled ? 'otherLabel' : 'onlyLabel')}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
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
                     className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#efe9fb] bg-white px-3 py-3.5 text-[13px] font-medium text-[#5b5470] transition-colors hover:bg-[#faf7ff] dark:border-[#2a2235] dark:bg-[#171320] dark:text-[#B5ACBE] dark:hover:bg-[#1e1730]"
                  >
                     <Icon className="h-[18px] w-[18px] text-[#6c3fe0] dark:text-[#d8c2ff]" aria-hidden="true" />
                     {label}
                  </a>
               ))}
            </div>

            {/* Browse everything */}
            <button
               type="button"
               onClick={() => navigate('/support/faq')}
               className="mt-5 w-full rounded-2xl border border-[#efe9fb] bg-white px-4 py-3 text-center text-[14px] font-medium text-[#6c3fe0] transition-colors hover:bg-[#f3effe] dark:border-[#2a2235] dark:bg-[#171320] dark:text-[#d8c2ff] dark:hover:bg-[#1e1730]"
            >
               {t('browseAll')}
            </button>
         </div>
      </div>
   );
}
