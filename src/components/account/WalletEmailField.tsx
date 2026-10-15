import { type FormEvent, useMemo, useRef, useState } from 'react';

import { CheckCircle2, Mail } from 'lucide-react';

import { useAccountEmail } from '@/hooks/useAccountEmail';

import { describeEmailChangeError, isValidEmail, requestEmailChange } from '@/lib/accountEmail';
import { detectInAppBrowser } from '@/lib/inAppBrowser';

/**
 * Inside the Instant Wallet card: accounts with no real email (phone sign-ups) give one here. It is
 * saved as a pending change and confirmed LATER with a code (ConfirmEmailReminder), because leaving
 * Facebook's browser to open an email may not bring them back. Never blocks creating the wallet.
 */
export function WalletEmailField() {
   const { needsEmail, pendingEmail, refresh } = useAccountEmail();
   const [email, setEmail] = useState('');
   const [editing, setEditing] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isSaving, setIsSaving] = useState(false);
   const [savedEmail, setSavedEmail] = useState<string | null>(null);
   const lastSubmitted = useRef<string | null>(null);
   const inApp = useMemo(() => detectInAppBrowser(), []);

   if (!needsEmail) return null;

   const shownPending = savedEmail ?? pendingEmail;

   const save = async () => {
      const next = email.trim().toLowerCase();
      if (!next || next === lastSubmitted.current || next === shownPending) return;
      if (!isValidEmail(next)) {
         setError('Check your email address and try again.');
         return;
      }
      lastSubmitted.current = next;
      setIsSaving(true);
      setError(null);
      try {
         const { pendingEmail: saved } = await requestEmailChange(next);
         setSavedEmail(saved);
         setEditing(false);
         refresh();
      } catch (err) {
         lastSubmitted.current = null;
         setError(describeEmailChangeError(err).message);
      } finally {
         setIsSaving(false);
      }
   };

   const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void save();
   };

   if (shownPending && !editing) {
      return (
         <p className="mb-md-4 flex max-w-[340px] items-start gap-2 text-left text-md-b3 font-medium text-md-neutral-700" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-md-green-700" aria-hidden />
            <span>
               We&apos;ll ask you to confirm <span className="font-semibold text-md-heading dark:text-md-neutral-100">{shownPending}</span>{' '}
               later.{' '}
               <button
                  type="button"
                  onClick={() => {
                     setEmail(shownPending);
                     setEditing(true);
                  }}
                  className="font-semibold text-md-primary-1200 underline underline-offset-2 dark:text-md-primary-500"
               >
                  Change
               </button>
            </span>
         </p>
      );
   }

   return (
      <form onSubmit={handleSubmit} className="mb-md-4 flex w-full max-w-[340px] flex-col gap-1.5 text-left" noValidate>
         <label htmlFor="wallet-email" className="text-md-b2 font-semibold text-md-heading dark:text-md-neutral-100">
            Your email (for your wallet and receipts)
         </label>
         <div className="flex h-12 items-center gap-2 rounded-md-input border border-md-neutral-600 bg-md-neutral-100 px-3 focus-within:border-md-primary-900 dark:bg-transparent">
            <Mail className="h-4 w-4 shrink-0 text-md-neutral-700" aria-hidden />
            <input
               id="wallet-email"
               type="email"
               inputMode="email"
               autoComplete="email"
               placeholder="you@example.com"
               value={email}
               onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
               }}
               // Typing an email and tapping "Create Instant Wallet" saves it on the way (blur).
               onBlur={() => void save()}
               className="min-w-0 flex-1 bg-transparent text-md-b1 text-md-heading outline-none placeholder:text-md-neutral-700 dark:text-md-neutral-100"
            />
            <button
               type="submit"
               disabled={isSaving}
               className="shrink-0 text-md-b2 font-semibold text-md-primary-1200 disabled:opacity-60 dark:text-md-primary-500"
            >
               {isSaving ? 'Saving…' : 'Save'}
            </button>
         </div>
         {error ? (
            <p role="alert" className="text-md-b3 font-medium text-md-red-500">
               {error}
            </p>
         ) : (
            <p className="text-md-b3 font-medium text-md-neutral-700">
               We&apos;ll ask you to confirm it later.{' '}
               {inApp.isInApp ? `You don't need to leave ${inApp.appName ?? 'this app'} now.` : "You don't need to open your inbox now."}
            </p>
         )}
      </form>
   );
}
