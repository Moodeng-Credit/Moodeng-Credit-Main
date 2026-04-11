import { Link } from 'react-router-dom';

type AuthErrorAlertType = 'incorrect_credentials' | 'email_not_found' | 'too_many_attempts';

interface AuthErrorAlertProps {
   type: AuthErrorAlertType;
   attemptsRemaining?: number;
   onRetry?: () => void;
}

const DOCS_URL = 'https://moodeng-credit.gitbook.io/moodeng-credit';

export function AuthErrorAlert({ type, attemptsRemaining = 3, onRetry }: AuthErrorAlertProps) {
   if (type === 'too_many_attempts') {
      return (
         <div className="w-full rounded-[10px] border border-red-200 bg-red-50/80 px-4 py-4">
            <p className="text-sm font-medium text-[#4D4359] tracking-[-0.02em]">
               We&apos;ve detected multiple failed login attempts from your IP across several accounts. Access has
               been temporarily restricted.
            </p>
            <p className="mt-2 text-sm text-[#4D4359] tracking-[-0.02em]">
               Please wait 15 minutes before retrying, or contact support if this seems like an error.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
               <a
                  href={`${DOCS_URL}/faq`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[#8336F0] hover:underline"
               >
                  Why am I seeing this?
               </a>
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

   return (
      <div className="w-full rounded-[10px] border border-red-200 bg-red-50/80 px-4 py-4">
         <p className="text-sm font-medium text-[#4D4359] tracking-[-0.02em]">
            The email or password you entered is incorrect.
         </p>
         <p className="mt-2 text-sm text-[#4D4359] tracking-[-0.02em]">
            <span className="font-semibold text-red-500">{attemptsRemaining} attempts</span> remaining before
            you are locked out.{' '}
            {onRetry ? (
               <button
                  type="button"
                  onClick={onRetry}
                  className="font-semibold text-[#8336F0] hover:underline"
               >
                  Try again
               </button>
            ) : (
               <span className="font-semibold text-red-500">Try again</span>
            )}
         </p>
      </div>
   );
}
