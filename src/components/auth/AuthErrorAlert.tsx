import { Link } from 'react-router-dom';

type AuthErrorAlertType = 'incorrect_credentials' | 'email_not_found' | 'new_user' | 'too_many_attempts' | 'provider_failed';

interface AuthErrorAlertProps {
   type: AuthErrorAlertType;
   onRetry?: () => void;
   signupHref?: string;
   resetPasswordHref?: string;
   /** Which sign-in provider failed (e.g. "Google") — only used by `provider_failed`. */
   provider?: string;
}

const DOCS_URL = 'https://moodeng-credit.gitbook.io/moodeng-credit';

export function AuthErrorAlert({
   type,
   onRetry,
   signupHref = '/sign-up',
   resetPasswordHref = '/forgot-password',
   provider
}: AuthErrorAlertProps) {
   if (type === 'provider_failed') {
      // A provider sign-in has no password, so never blame "credentials" here — the failure is
      // on the provider handshake (popup closed, network, provider outage) and usually passes.
      return (
         <div className="w-full rounded-[10px] border border-red-200 bg-red-50/80 px-4 py-4">
            <p className="text-sm font-medium text-[#4D4359] tracking-[-0.02em]">
               We couldn&apos;t sign you in with {provider ?? 'that provider'}. This is usually temporary — please try again.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
               {onRetry && (
                  <button type="button" onClick={onRetry} className="text-sm font-semibold text-[#8336F0] hover:underline">
                     Try again
                  </button>
               )}
               <a
                  href={`${DOCS_URL}/contact`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[#8336F0] hover:underline"
               >
                  Contact Support
               </a>
            </div>
         </div>
      );
   }

   if (type === 'too_many_attempts') {
      return (
         <div className="w-full rounded-[10px] border border-red-200 bg-red-50/80 px-4 py-4">
            <p className="text-sm font-medium text-[#4D4359] tracking-[-0.02em]">
               That password didn&apos;t work. If you&apos;re not sure it&apos;s right, resetting it only takes a
               minute.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
               <Link to={resetPasswordHref} className="text-sm font-semibold text-[#8336F0] hover:underline">
                  Reset password
               </Link>
               <a
                  href={`${DOCS_URL}/contact`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[#8336F0] hover:underline"
               >
                  Contact Support
               </a>
            </div>
         </div>
      );
   }

   if (type === 'email_not_found') {
      return (
         <div className="w-full rounded-[10px] border-[0.8px] border-[#FDAFB6] px-4 py-4" style={{ background: 'rgba(251, 55, 72, 0.1)' }}>
            <p className="text-sm font-medium text-[#4D4359] tracking-[-0.02em]">
               No account found with this email address.
            </p>
            {onRetry && (
               <p className="mt-2 text-sm text-[#4D4359] tracking-[-0.02em]">
                  <button type="button" onClick={onRetry} className="font-semibold text-[#8336F0] hover:underline">
                     Try a different email
                  </button>
                  {' or '}
                  <Link to="/sign-up" className="font-semibold text-[#8336F0] hover:underline">
                     Sign up
                  </Link>
                  .
               </p>
            )}
         </div>
      );
   }

   if (type === 'new_user') {
      return (
         <div className="w-full rounded-[10px] border border-[#D8C7FF] bg-[#F5EFFF] px-4 py-4">
            <p className="text-sm font-semibold text-[#250650] tracking-[-0.02em]">
               Looks like you are new to Moodeng.
            </p>
            <p className="mt-2 text-sm text-[#4D4359] tracking-[-0.02em]">
               Create an account first, then verify the email code Moodeng sends you.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
               <Link to={signupHref} className="text-sm font-semibold text-[#8336F0] hover:underline">
                  Create account
               </Link>
               {onRetry && (
                  <button type="button" onClick={onRetry} className="text-sm font-semibold text-[#8336F0] hover:underline">
                     Use a different email
                  </button>
               )}
            </div>
         </div>
      );
   }

   return (
      <div className="w-full rounded-[10px] border border-red-200 bg-red-50/80 px-4 py-4">
         <p className="text-sm font-medium text-[#4D4359] tracking-[-0.02em]">
            The email or password you entered is incorrect.
         </p>
         <p className="mt-2 text-sm text-[#4D4359] tracking-[-0.02em]">
            {onRetry ? (
               <button type="button" onClick={onRetry} className="font-semibold text-[#8336F0] hover:underline">
                  Try again
               </button>
            ) : (
               <span className="font-semibold text-[#8336F0]">Try again</span>
            )}
            {' or '}
            <Link to={resetPasswordHref} className="font-semibold text-[#8336F0] hover:underline">
               reset your password
            </Link>
            {" if you've forgotten it."}
         </p>
      </div>
   );
}
