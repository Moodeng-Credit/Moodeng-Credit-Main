import { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import UserAvatar from '@/components/UserAvatar';
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
   { label: 'Repay Loans', path: '/repay' },
   { label: 'View Loan Transaction History', path: '/history' },
] as const;

const FAQ_ITEMS = [
   { label: 'Watch our credit levelling guide', icon: 'play' as const },
   { label: 'Why does Moodeng use USDC', icon: 'chevron' as const },
   { label: 'How to Increase Credit Limit?', icon: 'chevron' as const },
   { label: 'What are IOU Points', icon: 'chevron' as const },
   { label: 'How do I get verified?', icon: 'chevron' as const },
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

export default function Account() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const [showSignOutModal, setShowSignOutModal] = useState(false);
   const [isSigningOut, setIsSigningOut] = useState(false);

   const displayName = user?.displayName || user?.username || 'User';
   const iouPoints = user?.cs?.toLocaleString() ?? '0';
   const hasWallet = Boolean(user?.walletAddress);

   const handleSignOut = async () => {
      setIsSigningOut(true);
      await dispatch(logoutUser());
      navigate('/sign-in');
   };

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

               {/* FAQ */}
               <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                     <p className="text-md-b2 font-medium text-md-neutral-700">Frequently Asked Questions</p>
                     <button type="button" className="text-md-b2 font-medium text-md-primary-900">
                        View More
                     </button>
                  </div>
                  {FAQ_ITEMS.map((item) => (
                     <button
                        key={item.label}
                        type="button"
                        className="flex items-center justify-between px-md-5 py-md-3 border border-md-neutral-400 rounded-md-md w-full text-left"
                     >
                        <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em]">
                           {item.label}
                        </span>
                        {item.icon === 'play' ? <PlayIcon /> : <ChevronRight />}
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
