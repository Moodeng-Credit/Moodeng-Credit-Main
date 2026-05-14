import { useLocation, useNavigate } from 'react-router-dom';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';

export default function WorldIdVerification() {
   const navigate = useNavigate();
   const location = useLocation();
   const isPreview = import.meta.env.DEV && location.pathname.includes('preview');

   const handleVerified = () => {
      navigate(isPreview ? '/onboarding/congratulations-preview' : '/onboarding/congratulations', { replace: true });
   };

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <img src="/world-id.png" alt="" aria-hidden="true" className="w-40" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">Verify You&rsquo;re Human</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  Prove you&rsquo;re a real person with World ID. This is a one-time step.
               </p>
            </div>

            <WorldIDVerification onSuccess={handleVerified} className="w-full">
               {({ open }) => (
                  <button
                     type="button"
                     onClick={isPreview ? handleVerified : open}
                     className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
                  >
                     Verify with World ID
                  </button>
               )}
            </WorldIDVerification>
         </div>
      </div>
   );
}
