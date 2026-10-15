import { type FormEvent, useState } from 'react';

import { Mail, X } from 'lucide-react';
import { useDispatch } from 'react-redux';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { useAccountEmail } from '@/hooks/useAccountEmail';

import {
   describeEmailChangeError,
   dismissConfirmEmailReminder,
   isConfirmEmailReminderDismissed,
   isValidEmail,
   notifyAccountEmailChanged,
   requestEmailChange,
   resendEmailChange
} from '@/lib/accountEmail';
import { confirmEmailChange } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

const CODE_MAX = 8;
const CODE_MIN = 6;

/**
 * "Confirm your email: we sent a code to x@y.com · Resend · Change". For an email added later
 * (e.g. in the Instant Wallet card) that is still pending. The code is typed here, so nobody has to
 * leave the app (or Facebook's browser) to confirm. Dismissible on the dashboard for a few days.
 */
export function ConfirmEmailReminder({ placement }: { placement: 'dashboard' | 'settings' }) {
   const dispatch = useDispatch<AppDispatch>();
   const { showToast } = useToast();
   const { pendingEmail, refresh } = useAccountEmail();
   const [code, setCode] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [notice, setNotice] = useState<string | null>(null);
   const [busy, setBusy] = useState<'confirm' | 'resend' | 'change' | null>(null);
   const [changing, setChanging] = useState(false);
   const [newEmail, setNewEmail] = useState('');
   const [dismissed, setDismissed] = useState(false);

   if (!pendingEmail) return null;
   if (placement === 'dashboard' && (dismissed || isConfirmEmailReminderDismissed(pendingEmail))) return null;

   const handleConfirm = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setNotice(null);
      if (code.length < CODE_MIN) {
         setError('Enter the code from the email.');
         return;
      }
      setBusy('confirm');
      try {
         await dispatch(confirmEmailChange({ email: pendingEmail, token: code })).unwrap();
         showToast(TOAST_TYPES.SUCCESS, 'Email confirmed', `${pendingEmail} is now on your account.`);
         setCode('');
         notifyAccountEmailChanged();
         refresh();
      } catch {
         setError('That code did not work. Check the latest email from Moodeng, or resend it.');
      } finally {
         setBusy(null);
      }
   };

   const handleResend = async () => {
      setError(null);
      setNotice(null);
      setBusy('resend');
      try {
         await resendEmailChange(pendingEmail);
         setNotice(`New code sent to ${pendingEmail}.`);
      } catch (err) {
         setError(describeEmailChangeError(err).message);
      } finally {
         setBusy(null);
      }
   };

   const handleChange = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setNotice(null);
      if (!isValidEmail(newEmail)) {
         setError('Check your email address and try again.');
         return;
      }
      setBusy('change');
      try {
         const { pendingEmail: saved } = await requestEmailChange(newEmail);
         setChanging(false);
         setNewEmail('');
         setNotice(`Code sent to ${saved}.`);
         refresh();
      } catch (err) {
         setError(describeEmailChangeError(err).message);
      } finally {
         setBusy(null);
      }
   };

   const linkClass = 'font-semibold text-[#6010D2] underline underline-offset-2 disabled:opacity-60 dark:text-[#C084FC]';

   return (
      <section
         aria-label="Confirm your email"
         className={`${placement === 'dashboard' ? 'mx-5' : ''} relative rounded-[12px] border border-[#E7D8FF] bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(28,5,61,0.06)] dark:border-[#2D1F4A] dark:bg-[#1E1530]`}
      >
         {placement === 'dashboard' ? (
            <button
               type="button"
               aria-label="Hide for now"
               onClick={() => {
                  dismissConfirmEmailReminder(pendingEmail);
                  setDismissed(true);
               }}
               className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-[#70617F] hover:bg-[#F2EEF7]"
            >
               <X className="h-4 w-4" />
            </button>
         ) : null}
         <div className="flex items-start gap-3 pr-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#efeaff] dark:bg-[#2A1D40]">
               <Mail className="h-5 w-5 text-[#6b55f7] dark:text-[#b3a6ff]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
               <p className="text-[16px] font-semibold leading-6 text-[#0f172b] dark:text-white">Confirm your email</p>
               <p className="text-[14px] leading-5 text-[#45556c] dark:text-[#c8b8e8]">
                  We sent a code to <span className="break-all font-semibold">{pendingEmail}</span> ·{' '}
                  <button type="button" onClick={handleResend} disabled={busy !== null} className={linkClass}>
                     {busy === 'resend' ? 'Sending…' : 'Resend'}
                  </button>{' '}
                  ·{' '}
                  <button type="button" onClick={() => setChanging((v) => !v)} disabled={busy !== null} className={linkClass}>
                     Change
                  </button>
               </p>
            </div>
         </div>

         {changing ? (
            <form onSubmit={handleChange} className="mt-3 flex gap-2" noValidate>
               <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  aria-label="New email address"
                  placeholder="you@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-[10px] border border-[#B5ACBE] bg-[#FBFAFD] px-3 text-[15px] text-[#040033] outline-none focus:border-[#8336F0] dark:border-[#3D2D5A] dark:bg-transparent dark:text-white"
               />
               <button
                  type="submit"
                  disabled={busy !== null}
                  className="h-11 shrink-0 rounded-[10px] bg-[#6010D2] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
               >
                  {busy === 'change' ? 'Sending…' : 'Send code'}
               </button>
            </form>
         ) : (
            <form onSubmit={handleConfirm} className="mt-3 flex gap-2" noValidate>
               <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Code from the email"
                  placeholder="Code from the email"
                  value={code}
                  onChange={(e) => {
                     setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_MAX));
                     setError(null);
                  }}
                  className="h-11 min-w-0 flex-1 rounded-[10px] border border-[#B5ACBE] bg-[#FBFAFD] px-3 text-[15px] tracking-[0.12em] text-[#040033] outline-none focus:border-[#8336F0] dark:border-[#3D2D5A] dark:bg-transparent dark:text-white"
               />
               <button
                  type="submit"
                  disabled={busy !== null}
                  className="h-11 shrink-0 rounded-[10px] bg-[#6010D2] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
               >
                  {busy === 'confirm' ? 'Checking…' : 'Confirm'}
               </button>
            </form>
         )}

         {error ? (
            <p role="alert" className="mt-2 text-[13px] font-semibold text-[#B60413] dark:text-[#FF8090]">
               {error}
            </p>
         ) : null}
         {notice ? (
            <p role="status" className="mt-2 text-[13px] font-semibold text-[#0D7A3C] dark:text-[#5DFFA0]">
               {notice}
            </p>
         ) : null}
      </section>
   );
}
