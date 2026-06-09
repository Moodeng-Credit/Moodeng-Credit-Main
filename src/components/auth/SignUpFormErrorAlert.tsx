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

const amberAlert = 'rounded-[10px] border border-[#FFEDA1] px-4 py-4';
const redAlert = 'rounded-[10px] border border-[#FDAFB6] px-4 py-4';
const bodyText = 'text-sm font-medium leading-5 tracking-[-0.01em] text-[#F0EAFF]';
const linkText = 'font-bold text-[#C084FC] underline';

export function SignUpFormErrorAlert({ type }: SignUpFormErrorAlertProps) {
   if (type === 'password_too_weak') {
      return (
         <div className={`w-full ${amberAlert}`} style={{ background: 'rgba(255, 219, 67, 0.12)' }}>
            <p className={bodyText}>
               Password must be longer than 8 characters. Choose a stronger password to continue.
            </p>
         </div>
      );
   }

   if (type === 'password_mismatch') {
      return (
         <div className={`w-full ${amberAlert}`} style={{ background: 'rgba(255, 219, 67, 0.12)' }}>
            <p className={bodyText}>
               Passwords do not match. Please re-enter your password.
            </p>
         </div>
      );
   }

   if (type === 'email_taken') {
      return (
         <div className={`w-full ${redAlert}`} style={{ background: 'rgba(251, 55, 72, 0.12)' }}>
            <p className={bodyText}>
               This email address has been permanently locked. Please try a different email or contact
               support if you believe this is a mistake.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
               <a
                  href={`${DOCS_URL}/faq`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs leading-[18px] ${linkText}`}
               >
                  Why am I seeing this?
               </a>
               <a
                  href={`${DOCS_URL}/contact`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs leading-[18px] ${linkText}`}
               >
                  Contact Support
               </a>
            </div>
         </div>
      );
   }

   if (type === 'account_linked') {
      return (
         <div className={`w-full ${amberAlert}`} style={{ background: 'rgba(255, 219, 67, 0.12)' }}>
            <p className={bodyText}>
               This email is already linked to a Google account. Use a different email address or{' '}
               <Link to="/sign-in" className={linkText}>
                  Sign In
               </Link>{' '}
               instead.
            </p>
         </div>
      );
   }

   if (type === 'account_exist') {
      return (
         <div className={`w-full ${amberAlert}`} style={{ background: 'rgba(255, 219, 67, 0.12)' }}>
            <p className={bodyText}>
               An account already exists with this email.{' '}
               <Link to="/sign-in" className={linkText}>
                  Sign In
               </Link>{' '}
               instead, or{' '}
               <Link to="/forgot-password" className={linkText}>
                  reset your password
               </Link>{' '}
               if you need to regain access.
            </p>
         </div>
      );
   }

   return null;
}
