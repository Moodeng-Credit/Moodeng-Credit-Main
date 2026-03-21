import { Link } from 'react-router-dom';

type SignUpErrorType =
   | 'password_too_weak'
   | 'password_mismatch'
   | 'email_taken'
   | 'account_linked'
   | 'account_exist';

interface SignUpFormErrorAlertProps {
   type: SignUpErrorType;
}

const DOCS_URL = 'https://moodeng-credit.gitbook.io/moodeng-credit';

const amberAlert = 'rounded-[10px] border-[0.8px] border-[#FFEDA1] px-4 py-4';
const redAlert = 'rounded-[10px] border-[0.8px] border-[#FDAFB6] px-4 py-4';

export function SignUpFormErrorAlert({ type }: SignUpFormErrorAlertProps) {
   if (type === 'password_too_weak') {
      return (
         <div className={`w-full ${amberAlert}`} style={{ background: 'rgba(255, 219, 67, 0.1)' }}>
            <p className="text-xs leading-[18px] tracking-[-0.02em] text-[#594D65]">
               Password must be longer than 8 characters. Choose a stronger password to continue.
            </p>
         </div>
      );
   }

   if (type === 'password_mismatch') {
      return (
         <div className={`w-full ${amberAlert}`} style={{ background: 'rgba(255, 219, 67, 0.1)' }}>
            <p className="text-xs leading-[18px] tracking-[-0.02em] text-[#594D65]">
               Passwords do not match. Please re-enter your password.
            </p>
         </div>
      );
   }

   if (type === 'email_taken') {
      return (
         <div className={`w-full ${redAlert}`} style={{ background: 'rgba(251, 55, 72, 0.1)' }}>
            <p className="text-xs leading-[18px] tracking-[-0.02em] text-[#594D65]">
               This email address has been permanently locked. Please try a different email or contact
               support if you believe this is a mistake.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
               <a
                  href={`${DOCS_URL}/faq`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold leading-[18px] text-[#8336F0] underline"
               >
                  Why am I seeing this?
               </a>
               <a
                  href={`${DOCS_URL}/contact`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold leading-[18px] text-[#8336F0]"
               >
                  Contact Support
               </a>
            </div>
         </div>
      );
   }

   if (type === 'account_linked' || type === 'account_exist') {
      return (
         <div className={`w-full ${amberAlert}`} style={{ background: 'rgba(255, 219, 67, 0.1)' }}>
            <p className="text-xs leading-[18px] tracking-[-0.02em] text-[#594D65]">
               This email is already linked to a Google account. Use a different email address or{' '}
               <Link to="/login" className="font-semibold text-[#8336F0] underline">
                  Sign In
               </Link>{' '}
               instead.
            </p>
         </div>
      );
   }

   return null;
}
