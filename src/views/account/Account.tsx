import { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import UserAvatar from '@/components/UserAvatar';
import { ACCOUNT_FAQS } from '@/views/account/data/accountFaqs';
import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

const ICON_MASK_BASE: React.CSSProperties = {
   WebkitMaskSize: 'contain',
   maskSize: 'contain',
   WebkitMaskRepeat: 'no-repeat',
   maskRepeat: 'no-repeat',
   WebkitMaskPosition: 'center',
   maskPosition: 'center',
};

const ACCOUNT_ITEMS = [
   { label: 'Account Settings', path: '/account/settings' },
   { label: 'View Loan Transaction History', path: '/history' },
] as const;

const TELEGRAM_SUPPORT_URL =
   'https://t.me/jimmymoodengcredit?text=Hello%2C%20I%27m%20Jimmy%2C%20co-founder%20of%20Moodeng%20Credit.%20Happy%20to%20help%20you.%20If%20English%20isn%27t%20your%20first%20language%2C%20just%20tell%20me%20and%20we%20can%20use%20Google%20Translate.%20Anything%20you%20need%20to%20know%20about%20the%20platform%20or%20how%20to%20use%20it%2C%20I%20can%20support%20you';

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/profile.php?id=61589106561061';
const FACEBOOK_GROUP_URL = 'https://www.facebook.com/groups/1593629908540434';

const CONTACT_ITEMS = [
   { label: 'Join Our Community', url: FACEBOOK_GROUP_URL },
   { label: 'Get Help', url: FACEBOOK_PAGE_URL },
   { label: 'Contact Us', url: TELEGRAM_SUPPORT_URL },
] as const;

function ChevronRight() {
   return (
      <div
         className="w-6 h-6 shrink-0 bg-md-primary-900"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/chevron-right.svg')",
            maskImage: "url('/icons/chevron-right.svg')",
         }}
      />
   );
}

function PlayIcon() {
   return (
      <div
         className="w-6 h-6 shrink-0 bg-md-primary-900"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/play.svg')",
            maskImage: "url('/icons/play.svg')",
         }}
      />
   );
}

function ExternalLinkIcon() {
   return (
      <div
         className="w-6 h-6 shrink-0 bg-md-primary-900"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/view_link.svg')",
            maskImage: "url('/icons/view_link.svg')",
         }}
      />
   );
}

export default function Account() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const [showSignOutModal, setShowSignOutModal] = useState(false);
   const [isSigningOut, setIsSigningOut] = useState(false);
   const [openFaqId, setOpenFaqId] = useState<string | null>(null);

   const displayName = user?.displayName || user?.username || 'User';
   const iouPoints = user?.cs?.toLocaleString() ?? '0';
   const hasWallet = Boolean(user?.walletAddress);

   const handleSignOut = async () => {
      setIsSigningOut(true);
      await dispatch(logoutUser());
      navigate('/sign-in');
   };

   const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            {/* User header */}
            <div className="flex items-center justify-between px-md-5 py-md-3">
               <div className="flex gap-4 items-center">
                  <UserAvatar size={48} />
                  <div className="flex flex-col gap-1">
                     <p className="text-md-h6 font-semibold text-md-heading">{displayName}</p>
                     <div className="bg-md-primary-900 rounded-md-sm px-2 py-1 self-start">
                        <p className="text-md-b3 font-semibold text-md-neutral-100 capitalize">
                           IOU {iouPoints}
                        </p>
                     </div>
                  </div>
               </div>

               {!hasWallet ? (
                  <button
                     type="button"
                     onClick={() => navigate('/onboarding/wallet')}
                     className="flex items-center gap-2.5 border border-md-blue-400 rounded-md-pill px-4 py-3 bg-white shrink-0"
                  >
                     <div
                        className="w-5 h-5 shrink-0 bg-md-blue-400"
                        style={{
                           ...ICON_MASK_BASE,
                           WebkitMaskImage: "url('/icons/wallet.png')",
                           maskImage: "url('/icons/wallet.png')",
                        }}
                     />
                     <span className="text-md-b2 font-semibold text-md-blue-400">Connect Wallet</span>
                  </button>
               ) : null}
            </div>

            {/* Content */}
            <div className="flex flex-col gap-5 px-md-4">
               {/* Account Information */}
               <div className="flex flex-col gap-3">
                  <p className="text-md-b2 font-medium text-md-neutral-700">Account Information</p>
                  {ACCOUNT_ITEMS.map((item) => (
                     <button
                        key={item.label}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="flex items-center justify-between px-md-5 py-md-3 border border-md-neutral-400 rounded-md-md w-full text-left"
                     >
                        <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em]">
                           {item.label}
                        </span>
                        <ChevronRight />
                     </button>
                  ))}
               </div>

               {/* Common questions */}
               <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                     <p className="text-md-b2 font-medium text-md-neutral-700">Common questions</p>
                     <button
                        type="button"
                        onClick={() => navigate('/support')}
                        className="text-md-b2 font-medium text-md-primary-900"
                     >
                        View More
                     </button>
                  </div>

                  {/* Video guide link */}
                  <button
                     type="button"
                     onClick={() => navigate('/support/guides')}
                     className="flex items-center justify-between px-md-5 py-md-3 border border-md-neutral-400 rounded-md-md w-full text-left"
                  >
                     <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em]">
                        Watch our Credit Levelling Guide
                     </span>
                     <PlayIcon />
                  </button>

                  {/* FAQ accordion */}
                  {ACCOUNT_FAQS.map((item) => {
                     const isOpen = openFaqId === item.id;
                     return (
                        <div
                           key={item.id}
                           className="border border-md-neutral-400 rounded-md-md w-full overflow-hidden"
                        >
                           <button
                              type="button"
                              onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                              aria-expanded={isOpen}
                              className="flex items-center justify-between gap-md-2 px-md-5 py-md-3 w-full text-left"
                           >
                              <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em] flex-1">
                                 {item.question}
                              </span>
                              <div
                                 className={`w-6 h-6 shrink-0 bg-md-primary-900 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                 style={{
                                    ...ICON_MASK_BASE,
                                    WebkitMaskImage: "url('/icons/chevron-down.svg')",
                                    maskImage: "url('/icons/chevron-down.svg')",
                                 }}
                              />
                           </button>
                           {isOpen ? (
                              <div className="px-md-5 pb-md-3 text-md-b2 text-md-neutral-1200 whitespace-pre-line">
                                 {item.answer}
                              </div>
                           ) : null}
                        </div>
                     );
                  })}
               </div>

               {/* Get in touch */}
               <div className="flex flex-col gap-3">
                  <p className="text-md-b2 font-medium text-md-neutral-700">Get in touch</p>
                  {CONTACT_ITEMS.map((item) => (
                     <button
                        key={item.label}
                        type="button"
                        onClick={() => openExternal(item.url)}
                        className="flex items-center justify-between px-md-5 py-md-3 border border-md-neutral-400 rounded-md-md w-full text-left"
                     >
                        <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em]">
                           {item.label}
                        </span>
                        <ExternalLinkIcon />
                     </button>
                  ))}
               </div>

               {/* Sign Out */}
               <button
                  type="button"
                  onClick={() => setShowSignOutModal(true)}
                  className="flex items-center justify-center gap-2.5 px-md-5 py-md-3 border border-md-red-300 rounded-md-md w-full"
               >
                  <span className="text-md-h5 font-semibold text-md-red-300">Sign Out</span>
                  <div
                     className="w-6 h-6 shrink-0 bg-md-red-300"
                     style={{
                        ...ICON_MASK_BASE,
                        WebkitMaskImage: "url('/icons/sign-out.svg')",
                        maskImage: "url('/icons/sign-out.svg')",
                     }}
                  />
               </button>
            </div>
         </div>

         {/* Sign Out Modal */}
         {showSignOutModal ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5" onClick={() => setShowSignOutModal(false)}>
               <div
                  className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3 items-center"
                  onClick={(e) => e.stopPropagation()}
               >
                  <div className="flex flex-col gap-md-1 items-center text-center">
                     <h2 className="text-md-h4 font-semibold text-md-heading">Sign out?</h2>
                     <p className="text-md-b1 text-md-neutral-1200">
                        You can sign back in anytime. Your Trust Score stays with your wallet.
                     </p>
                  </div>
                  <button
                     type="button"
                     disabled={isSigningOut}
                     onClick={handleSignOut}
                     className="w-full py-md-3 px-md-4 bg-md-red-500 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-50"
                  >
                     {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                  </button>
                  <button
                     type="button"
                     onClick={() => setShowSignOutModal(false)}
                     className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200"
                  >
                     Cancel
                  </button>
               </div>
            </div>
         ) : null}
      </div>
   );
}
