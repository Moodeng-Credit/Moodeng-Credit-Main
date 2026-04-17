import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import UserAvatar from '@/components/UserAvatar';
import { WorldId } from '@/types/authTypes';
import { ICON_MASK_BASE, TELEGRAM_URL, X_URL } from '@/views/support/constants';
import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import type { RootState } from '@/store/store';

interface SupportCard {
   label: string;
   description: string;
   icon: string;
   path: string;
   badge?: string;
}

const SUPPORT_CARDS: SupportCard[] = [
   {
      label: 'Getting started',
      description: 'New to Moodeng Credit? Learn the basics and request your first loan.',
      icon: 'play-outline.svg',
      path: '/support/getting-started'
   },
   {
      label: 'Guides',
      description: 'Step-by-step guides for Trust Score, Credit Level, and repayments.',
      icon: 'guide.png',
      path: '/support/guides'
   },
   {
      label: 'FAQs',
      description: 'Get clear answers on loans, trust, verification, and repayments.',
      icon: 'question_light.svg',
      path: '/support/faq'
   },
   {
      label: 'Updates',
      description: 'Product updates, changes, and important announcements.',
      icon: 'updates.png',
      path: '/support/updates',
      badge: 'NEW'
   }
];

function CategoryIcon({ icon }: { icon: string }) {
   return (
      <div
         className="w-9 h-9 bg-md-primary-900"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: `url('/icons/${icon}')`,
            maskImage: `url('/icons/${icon}')`
         }}
      />
   );
}

function VerifiedBadge() {
   return (
      <div className="flex items-center gap-1 bg-md-green-100 rounded-md-sm px-md-1 py-md-0">
         <div
            className="w-3 h-3 bg-md-green-900"
            style={{
               ...ICON_MASK_BASE,
               WebkitMaskImage: "url('/icons/check-fill.svg')",
               maskImage: "url('/icons/check-fill.svg')"
            }}
         />
         <span className="text-md-b3 font-semibold text-md-green-900 capitalize">Verified borrower</span>
      </div>
   );
}

export default function Support() {
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const firstName = (user?.displayName || user?.username || 'there').split(' ')[0];
   const isVerified = user?.isWorldId === WorldId.ACTIVE;

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            {/* User header */}
            <div className="flex items-center justify-between px-md-5 py-md-3">
               <div className="flex items-center gap-md-2">
                  <UserAvatar size={48} />
                  <div className="flex flex-col gap-1">
                     <p className="text-md-h5 font-semibold text-md-primary-2000">Hello, {firstName}</p>
                     {isVerified ? <VerifiedBadge /> : null}
                  </div>
               </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-md-4 p-md-4">
               <div className="flex flex-col gap-md-3">
                  <h1 className="text-md-h3 font-semibold text-md-heading tracking-[-0.56px]">Help & Support Center</h1>
                  <p className="text-md-b1 text-md-neutral-1200">
                     Need help getting started? Browse help articles or reach out if you need support.
                  </p>
               </div>

               {/* 4 category cards, 2x2 grid */}
               <div className="grid grid-cols-2 gap-md-4">
                  {SUPPORT_CARDS.map((card) => (
                     <button
                        key={card.label}
                        type="button"
                        onClick={() => navigate(card.path)}
                        className="flex flex-col items-start gap-md-3 border border-md-neutral-600 rounded-md-input p-md-3 text-left bg-transparent"
                     >
                        <CategoryIcon icon={card.icon} />
                        <div className="flex flex-col gap-md-0 w-full">
                           <div className="flex items-start gap-1">
                              <span className="text-md-h5 font-semibold text-md-heading">{card.label}</span>
                              {card.badge ? (
                                 <span className="bg-md-primary-300 rounded-md-sm px-md-1 py-md-0 text-md-b3 font-semibold text-md-primary-1200">
                                    {card.badge}
                                 </span>
                              ) : null}
                           </div>
                           <p className="text-md-b2 text-md-neutral-1200">{card.description}</p>
                        </div>
                     </button>
                  ))}
               </div>

               <NeedMoreHelp />

               {/* Join community */}
               <div className="bg-md-neutral-300 border border-md-primary-900 rounded-md-input flex flex-col items-center gap-md-1 p-md-3">
                  <img
                     src="/hippos/community.png"
                     alt=""
                     className="h-[185px] w-full max-w-[326px] object-contain"
                  />
                  <p className="text-md-h5 font-semibold text-md-heading text-center">Join the community</p>
                  <p className="text-md-b2 text-md-neutral-1200 text-center">
                     Connect with other borrowers, share feedback, and stay up to date with Moodeng Credit.
                  </p>
                  <div className="flex gap-md-1 pt-md-1">
                     <a
                        href={TELEGRAM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-md-blue-500 rounded-md-input flex items-center justify-center gap-md-1 px-md-4 py-md-2 shadow-md-card"
                     >
                        <div
                           className="w-5 h-5 bg-md-neutral-100"
                           style={{
                              ...ICON_MASK_BASE,
                              WebkitMaskImage: "url('/icons/telegram.svg')",
                              maskImage: "url('/icons/telegram.svg')"
                           }}
                        />
                        <span className="text-md-b1 font-medium text-md-neutral-100">Join Telegram</span>
                     </a>
                     <a
                        href={X_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-md-neutral-1700 rounded-md-input flex items-center justify-center gap-md-1 px-md-4 py-md-2 shadow-md-card"
                     >
                        <div
                           className="w-[22px] h-5 bg-md-neutral-100"
                           style={{
                              ...ICON_MASK_BASE,
                              WebkitMaskImage: "url('/icons/x-logo.svg')",
                              maskImage: "url('/icons/x-logo.svg')"
                           }}
                        />
                        <span className="text-md-b1 font-medium text-md-neutral-100">Follow on X</span>
                     </a>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
