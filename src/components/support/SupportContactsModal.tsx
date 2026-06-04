import { useCallback, useEffect, useState } from 'react';

import { X } from 'lucide-react';

import {
   LOAN_REQUEST_EXPIRED_SUPPORT_URL,
   SUPPORT_FACEBOOK_URL,
   TELEGRAM_SUPPORT_URL,
   WORLD_ID_VERIFICATION_SUPPORT_URL
} from '@/views/support/constants';

import { SUPPORT_CONTACTS_EVENT, type SupportContactIssue, type SupportContactsEventDetail } from '@/components/support/supportContacts';

type SupportContactConfig = {
   title: string;
   description: string;
   telegramUrl: string;
};

const SUPPORT_CONTACT_COPY: Record<SupportContactIssue, SupportContactConfig> = {
   general: {
      title: 'Support contacts',
      description: 'Here are support contacts. Choose a channel and we will help you with your Moodeng account.',
      telegramUrl: TELEGRAM_SUPPORT_URL
   },
   loan_request_expired: {
      title: 'Support contacts',
      description:
         'Here are support contacts for your expired loan request. We can help you connect with a lender or decide whether to post again.',
      telegramUrl: LOAN_REQUEST_EXPIRED_SUPPORT_URL
   },
   world_id_verification: {
      title: 'Support contacts',
      description: 'Here are support contacts for World ID verification if your status did not update after completing World ID.',
      telegramUrl: WORLD_ID_VERIFICATION_SUPPORT_URL
   }
};

function SupportContactsModal({ issue, onClose }: { issue: SupportContactIssue; onClose: () => void }) {
   const config = SUPPORT_CONTACT_COPY[issue] ?? SUPPORT_CONTACT_COPY.general;

   const openTelegram = () => {
      window.open(config.telegramUrl, '_blank', 'noopener,noreferrer');
   };

   const openFacebook = () => {
      window.open(SUPPORT_FACEBOOK_URL, '_blank', 'noopener,noreferrer');
   };

   return (
      <div
         className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-md-primary-2000/65 px-md-4 font-sans backdrop-blur-[6px]"
         role="alertdialog"
         aria-modal="true"
         aria-labelledby="support-contacts-title"
         aria-describedby="support-contacts-description"
         onClick={onClose}
      >
         <div
            className="w-full max-w-[398px] overflow-hidden rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 text-left shadow-md-card"
            onClick={(event) => event.stopPropagation()}
         >
            <div className="flex min-h-[56px] items-center justify-between border-b border-md-neutral-400 px-md-3 py-md-3">
               <h2 id="support-contacts-title" className="min-w-0 text-[20px] font-[590] leading-[1.2] tracking-normal text-md-heading">
                  {config.title}
               </h2>
               <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close support contacts"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md-md text-md-neutral-1500 transition-colors hover:text-md-heading active:scale-95"
               >
                  <X className="h-5 w-5" aria-hidden="true" />
               </button>
            </div>

            <div className="flex flex-col gap-md-3 p-md-3">
               <p id="support-contacts-description" className="text-md-b2 font-normal tracking-normal text-md-neutral-1200">
                  {config.description}
               </p>

               <div className="flex flex-col gap-md-1">
                  <p className="text-md-b2 font-semibold tracking-normal text-md-heading">Contact us via</p>
                  <div className="grid w-full grid-cols-2 gap-md-2">
                     <button
                        type="button"
                        onClick={openTelegram}
                        className="inline-flex min-h-[56px] items-center justify-center gap-md-1 rounded-md-lg px-md-3 py-md-3 text-md-b1 font-semibold tracking-normal text-md-neutral-100 shadow-md-card transition-all duration-150 hover:brightness-105 active:scale-[0.97] active:brightness-95"
                        style={{ backgroundColor: '#0088CC' }}
                     >
                        <img src="/icons/telegram-classic-filled.png" alt="" className="h-5 w-5 shrink-0" />
                        Telegram
                     </button>
                     <button
                        type="button"
                        onClick={openFacebook}
                        className="inline-flex min-h-[56px] items-center justify-center gap-md-1 rounded-md-lg px-md-3 py-md-3 text-md-b1 font-semibold tracking-normal text-md-neutral-100 shadow-md-card transition-all duration-150 hover:brightness-105 active:scale-[0.97] active:brightness-95"
                        style={{ backgroundColor: '#1877F2' }}
                     >
                        <span
                           className="h-5 w-5 shrink-0 bg-md-neutral-100"
                           aria-hidden="true"
                           style={{
                              WebkitMaskImage: "url('/icons/facebook.svg')",
                              maskImage: "url('/icons/facebook.svg')",
                              WebkitMaskSize: 'contain',
                              maskSize: 'contain',
                              WebkitMaskRepeat: 'no-repeat',
                              maskRepeat: 'no-repeat',
                              WebkitMaskPosition: 'center',
                              maskPosition: 'center'
                           }}
                        />
                        Facebook
                     </button>
                  </div>
               </div>

               <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-md-lg border border-md-primary-100 bg-md-primary-100 px-md-3 py-md-2 text-md-b2 font-semibold tracking-normal text-md-primary-1600 transition-all duration-150 hover:brightness-105 active:scale-[0.99] active:brightness-95"
               >
                  Done
               </button>
            </div>
         </div>
      </div>
   );
}

export function SupportContactsModalHost() {
   const [issue, setIssue] = useState<SupportContactIssue | null>(null);

   const close = useCallback(() => setIssue(null), []);

   useEffect(() => {
      const handleOpenSupportContacts = (event: Event) => {
         const detail = (event as CustomEvent<SupportContactsEventDetail>).detail;
         setIssue(detail?.issue ?? 'general');
      };

      window.addEventListener(SUPPORT_CONTACTS_EVENT, handleOpenSupportContacts);

      return () => {
         window.removeEventListener(SUPPORT_CONTACTS_EVENT, handleOpenSupportContacts);
      };
   }, []);

   return issue ? <SupportContactsModal issue={issue} onClose={close} /> : null;
}
