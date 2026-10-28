import { useCallback, useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { saveChosenUsername, UsernameField, useUsernameStatus } from '@/components/onboarding/UsernameField';

import { hasGeneratedUsername, suggestUsername } from '@/lib/phoneAuth';
import type { AppDispatch, RootState } from '@/store/store';

// Once per browser session — the notifier remounts on every route change (App keys the tree by path).
const seenKey = (userId: string) => `moodeng-choose-username-prompt:${userId}`;

const wasSeen = (userId: string): boolean => {
   try {
      return window.sessionStorage.getItem(seenKey(userId)) === '1';
   } catch {
      return false;
   }
};

const markSeen = (userId: string) => {
   try {
      window.sessionStorage.setItem(seenKey(userId), '1');
   } catch {
      // Storage unavailable — worst case the prompt shows again on the next page.
   }
};

// Sign-in/up and onboarding have their own screens (the onboarding bio asks for a username itself).
const SKIP_PATHS = ['/onboarding', '/verify', '/sign-in', '/sign-up', '/signin', '/signup', '/login', '/auth', '/mfa-challenge'];

/**
 * People who signed up with a phone number before the onboarding bio asked for a username still
 * have the made-up moodeng-ab12cd handle. Ask them once per session to pick their own; it stops
 * for good once they have.
 */
export function ChooseUsernameNotifier() {
   const user = useSelector((state: RootState) => state.auth.user);
   const dispatch = useDispatch<AppDispatch>();
   const location = useLocation();
   const [isOpen, setIsOpen] = useState(false);
   const [usernameInput, setUsernameInput] = useState<string | null>(null);
   const [saveError, setSaveError] = useState('');
   const [isSaving, setIsSaving] = useState(false);

   const needsUsername = hasGeneratedUsername(user?.username);
   const onSkippedPage = SKIP_PATHS.some((path) => location.pathname.startsWith(path));
   const username = usernameInput ?? suggestUsername(user?.displayName || user?.facebookName || '');
   const { status, problem } = useUsernameStatus(isOpen ? username : '', user?.id ?? '');

   useEffect(() => {
      if (!user?.id || !needsUsername || onSkippedPage || wasSeen(user.id)) return;
      markSeen(user.id);
      setIsOpen(true);
   }, [user?.id, needsUsername, onSkippedPage]);

   const close = useCallback(() => setIsOpen(false), []);

   const save = async () => {
      if (isSaving || status !== 'available') return;
      setIsSaving(true);
      const error = await saveChosenUsername(dispatch, username);
      setIsSaving(false);
      if (error) setSaveError(error);
      else setIsOpen(false);
   };

   if (!isOpen || onSkippedPage || !needsUsername) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5 backdrop-blur-[2px]" onClick={close}>
         <div
            aria-modal="true"
            className="flex w-full max-w-modal flex-col gap-md-4 rounded-md-lg bg-md-neutral-100 p-md-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
         >
            <div className="flex flex-col gap-2 text-center">
               <p className="text-md-h4 font-bold text-md-heading">Pick your username</p>
               <p className="text-md-b3 text-md-neutral-700">
                  Right now you&apos;re <span className="font-semibold">@{user?.username}</span>. Choose a name of your own — it&apos;s your
                  profile link on Moodeng.
               </p>
            </div>
            <UsernameField
               onChange={(value) => {
                  setUsernameInput(value);
                  setSaveError('');
               }}
               problem={problem}
               saveError={saveError}
               status={status}
               value={username}
            />
            <div className="flex w-full flex-col gap-2">
               <button
                  className="w-full rounded-md-md bg-md-primary-900 px-4 py-3 text-md-b3 font-semibold text-white disabled:opacity-50"
                  disabled={isSaving || status !== 'available'}
                  onClick={() => void save()}
                  type="button"
               >
                  {isSaving ? 'Saving…' : 'Save username'}
               </button>
               <button
                  className="w-full rounded-md-md bg-md-neutral-200 px-4 py-3 text-md-b3 font-semibold text-md-heading"
                  onClick={close}
                  type="button"
               >
                  Later
               </button>
            </div>
         </div>
      </div>
   );
}
