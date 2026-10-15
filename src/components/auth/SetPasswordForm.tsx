import { type FormEvent, useState } from 'react';

import { Eye, EyeOff } from 'lucide-react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const MIN_PASSWORD_LENGTH = 8;

function describeSetPasswordError(message: string): string {
   const lower = message.toLowerCase();
   if (lower.includes('reauthenticat') || lower.includes('recent')) {
      return 'For your safety, log out and back in with a code, then set your password.';
   }
   if (lower.includes('weak') || lower.includes('at least'))
      return `Use at least ${MIN_PASSWORD_LENGTH} characters, mixing letters and numbers.`;
   if (lower.includes('same') || lower.includes('different')) return 'That is already your password.';
   return message || 'Could not save your password. Try again in a moment.';
}

/**
 * Adds a password to a passwordless (code) account. No current password is asked for: these
 * accounts never had one, and they are signed in with a fresh code.
 */
export function SetPasswordForm({ onSaved, submitLabel = 'Save password' }: { onSaved: () => void; submitLabel?: string }) {
   const [password, setPassword] = useState('');
   const [visible, setVisible] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isSaving, setIsSaving] = useState(false);

   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      if (password.length < MIN_PASSWORD_LENGTH) {
         setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
         return;
      }
      setIsSaving(true);
      try {
         const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password, data: { has_password: true } });
         if (updateError) {
            setError(describeSetPasswordError(updateError.message));
            return;
         }
         setPassword('');
         onSaved();
      } finally {
         setIsSaving(false);
      }
   };

   return (
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
         <label htmlFor="set-password" className="text-left text-sm font-semibold text-[#040033] dark:text-[#F0EAFF]">
            New password
         </label>
         <div className="flex h-12 items-center gap-2 rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-4 focus-within:border-[#8336F0] dark:border-[#3D2D5A] dark:bg-[#1E1530]">
            <input
               id="set-password"
               type={visible ? 'text' : 'password'}
               autoComplete="new-password"
               value={password}
               onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
               }}
               placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
               className="min-w-0 flex-1 bg-transparent text-base text-[#040033] outline-none placeholder:text-[#70617F] dark:text-[#F0EAFF]"
            />
            <button
               type="button"
               onClick={() => setVisible((v) => !v)}
               aria-label={visible ? 'Hide password' : 'Show password'}
               className="text-[#70617F]"
            >
               {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
         </div>
         {error ? <p className="text-left text-sm font-semibold text-[#B60413] dark:text-[#FF8090]">{error}</p> : null}
         <button
            type="submit"
            disabled={isSaving}
            className="h-12 w-full rounded-2xl bg-[#6010D2] text-base font-semibold text-[#FDFCFD] transition-opacity hover:opacity-95 disabled:opacity-60"
         >
            {isSaving ? 'Saving…' : submitLabel}
         </button>
      </form>
   );
}
