import { useNavigate } from 'react-router-dom';

export default function WorldIdVerification() {
   const navigate = useNavigate();

   // TODO(MOO-27): replace with the real World ID verification flow.
   // For now this stub lets testers advance to the post-verification
   // congratulations screen end-to-end during onboarding.
   const handleContinue = () => {
      navigate('/onboarding/congratulations', { replace: true });
   };

   return (
      <div className="min-h-screen bg-md-neutral-200 flex items-center justify-center pb-24">
         <div className="text-center max-w-[440px] w-full px-md-4">
            <h1 className="text-md-h3 font-semibold text-md-heading">World ID Verification</h1>
            <p className="text-md-b2 text-md-neutral-1200 mt-2">
               Verification is coming soon. Continue to see your post-verification screen.
            </p>
            <button
               type="button"
               onClick={handleContinue}
               className="mt-6 flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
            >
               Continue
            </button>
         </div>
      </div>
   );
}
