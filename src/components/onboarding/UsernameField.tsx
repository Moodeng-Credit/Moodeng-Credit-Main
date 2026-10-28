import { useEffect, useState } from 'react';

import { Check, Loader2, X } from 'lucide-react';

import { cleanUsernameInput, USERNAME_MAX_LENGTH, usernameProblem } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

// Phone sign-ups get a made-up handle (moodeng-ab12cd) instead of choosing a username. This box lets
// them pick their own — in the onboarding bio, or the one-time ChooseUsernameNotifier for people who
// were past the bio already. Shown only while they still have the made-up handle.

export type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

/** Debounced "is it free?" check. A name that resolves to this same account counts as available. */
export function useUsernameStatus(username: string, userId: string): { status: UsernameStatus; problem: string | null } {
   const problem = username ? usernameProblem(username) : null;
   const [checked, setChecked] = useState<{ username: string; status: UsernameStatus } | null>(null);

   useEffect(() => {
      if (!username || problem) return undefined;
      let cancelled = false;
      const timer = window.setTimeout(async () => {
         const { data, error } = await getSupabaseBrowserClient().rpc('get_user_id_by_username', { p_username: username });
         if (cancelled) return;
         setChecked({ username, status: error ? 'error' : !data || data === userId ? 'available' : 'taken' });
      }, 400);
      return () => {
         cancelled = true;
         window.clearTimeout(timer);
      };
   }, [username, problem, userId]);

   if (!username) return { status: 'idle', problem: null };
   if (problem) return { status: 'invalid', problem };
   if (checked?.username !== username) return { status: 'checking', problem: null };
   return { status: checked.status, problem: null };
}

/** Saves the chosen username. Returns an error message, or null when saved. */
export async function saveChosenUsername(dispatch: AppDispatch, username: string): Promise<string | null> {
   const result = await dispatch(updateUser({ username }));
   if (updateUser.fulfilled.match(result)) return null;
   // users.username is UNIQUE: someone grabbed it between the check and the save.
   const taken = result.error?.code === '23505' || /duplicate|unique/i.test(result.error?.message ?? '');
   return taken ? 'That username was just taken — try another.' : "Couldn't save your username — please try again.";
}

const STATUS_TEXT: Partial<Record<UsernameStatus, string>> = {
   checking: 'Checking…',
   available: 'Available',
   taken: 'Taken — try adding a number',
   error: "Couldn't check right now"
};

export function UsernameField({
   value,
   onChange,
   status,
   problem,
   saveError
}: {
   value: string;
   onChange: (value: string) => void;
   status: UsernameStatus;
   problem: string | null;
   saveError?: string;
}) {
   const hint = problem ?? STATUS_TEXT[status] ?? 'Your profile link. Letters, numbers, - and _ only.';
   const hintColor =
      status === 'available' ? 'text-[#1f7a3d]' : status === 'taken' || status === 'invalid' ? 'text-md-red-500' : 'text-[#695b7b]';

   return (
      <label className="flex flex-col gap-2">
         <span className="text-[15px] font-[590] leading-5 text-[#26143f]">Choose a username</span>
         <span className="flex min-h-[48px] items-center rounded-[14px] border border-[#d8d0e2] bg-white px-3 focus-within:border-md-primary-900 focus-within:ring-2 focus-within:ring-md-primary-100">
            <span aria-hidden="true" className="text-md-b1 text-[#8a7c9c]">
               @
            </span>
            <input
               autoCapitalize="none"
               autoComplete="username"
               autoCorrect="off"
               className="min-w-0 flex-1 bg-transparent py-2 pl-0.5 text-md-b1 font-normal text-[#26143f] placeholder:text-[#8a7c9c] focus:outline-none"
               maxLength={USERNAME_MAX_LENGTH}
               onChange={(event) => onChange(cleanUsernameInput(event.target.value))}
               placeholder="e.g. maya23"
               spellCheck={false}
               type="text"
               value={value}
            />
            {status === 'checking' ? <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-[#8a7c9c]" /> : null}
            {status === 'available' ? <Check aria-hidden="true" className="size-4 shrink-0 text-[#1f7a3d]" strokeWidth={2.6} /> : null}
            {status === 'taken' || status === 'invalid' ? (
               <X aria-hidden="true" className="size-4 shrink-0 text-md-red-500" strokeWidth={2.6} />
            ) : null}
         </span>
         <span className={`text-[12px] font-normal leading-[18px] ${hintColor}`}>{hint}</span>
         {saveError ? <span className="text-md-b3 font-medium leading-[18px] text-md-red-500">{saveError}</span> : null}
      </label>
   );
}
