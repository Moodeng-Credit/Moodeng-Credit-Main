import { useEffect, useMemo, useRef, useState } from 'react';

import { Check } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { saveChosenUsername, UsernameField, useUsernameStatus } from '@/components/onboarding/UsernameField';
import type { BorrowerContextState } from '@/lib/borrowerContextFit';
import { hasGeneratedUsername, suggestUsername } from '@/lib/phoneAuth';
import { uploadAvatarForCurrentUser } from '@/lib/supabase/avatarStorage';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { updateBorrowerContext, updateUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import type { User } from '@/types/authTypes';
import AvatarUploadModal from '@/views/account/AvatarUploadModal';
import { BorrowerContextLoanStep, emptyBorrowerContext, mapBorrowerContextForSave } from '@/views/dashboard/components/LoanRequestModal';

// The two-page bio ("How lenders see you": photo, name, work, payday, income, expenses) inside the
// pre-KYC gate (/onboarding/connect), so the team sees it on the Telegram card before the intro call.
// Saved straight to the profile; the loan application then skips it (it asks only while
// user.incomeType is empty).
//
// Answers are kept as a draft on the device until saved, and page 2 lives in the URL (&bio=2): an
// Android back swipe on page 2 used to drop them on the Messenger step with every answer wiped, and
// one borrower refilled the bio three times before giving up (Oct 2026 replay).

type BioDraft = { context: BorrowerContextState; profileName: string; username?: string };

const draftKey = (userId: string) => `md_onboarding_bio:${userId}`;

const readDraft = (userId: string): BioDraft | null => {
   try {
      const raw = window.localStorage.getItem(draftKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<BioDraft>;
      if (!parsed.context) return null;
      return {
         context: { ...emptyBorrowerContext, ...parsed.context, cashGaps: parsed.context.cashGaps ?? [] },
         profileName: parsed.profileName ?? '',
         username: parsed.username
      };
   } catch {
      return null;
   }
};

const recordProfileMilestone = async (userId: string, milestoneId: 'profile-name-added' | 'profile-image-added') => {
   try {
      await getSupabaseBrowserClient().rpc('record_milestone_completion', {
         user_id_input: userId,
         milestone_id_input: milestoneId,
         metadata_input: { source: 'onboarding_connect_bio' }
      });
   } catch (error) {
      console.error(`Failed to record ${milestoneId} milestone:`, error);
   }
};

export default function OnboardingBio({ user, onBack, onDone }: { user: User; onBack: () => void; onDone: () => void }) {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const location = useLocation();
   const [searchParams, setSearchParams] = useSearchParams();
   const draft = useMemo(() => readDraft(user.id), [user.id]);
   const [context, setContext] = useState<BorrowerContextState>(draft?.context ?? emptyBorrowerContext);
   // Their Facebook name (from the Messenger step just before) beats the username, which for phone
   // and email sign-ups is a made-up handle like moodeng-ab12cd or the start of their email.
   const [profileName, setProfileName] = useState(
      draft?.profileName || user.displayName || user.facebookName || (user.username?.startsWith('moodeng-') ? '' : user.username) || ''
   );
   // Phone sign-ups still on their made-up moodeng-ab12cd handle also pick a username here, on page 1.
   // It follows their name until they type in it, and is saved before page 2.
   const needsUsername = hasGeneratedUsername(user.username);
   const [usernameInput, setUsernameInput] = useState<string | null>(draft?.username ?? null);
   const username = usernameInput ?? suggestUsername(profileName);
   const { status: usernameStatus, problem: usernameProblemText } = useUsernameStatus(needsUsername ? username : '', user.id);
   const [usernameError, setUsernameError] = useState('');
   const [isSavingUsername, setIsSavingUsername] = useState(false);
   // Page 2 needs page 1's answer — a reload or shared link on &bio=2 without it starts at page 1.
   const page: 1 | 2 = searchParams.get('bio') === '2' && context.incomeSetup ? 2 : 1;
   const goToPage2 = () => {
      const next = new URLSearchParams(searchParams);
      next.set('bio', '2');
      setSearchParams(next, { state: { bioPage2: true } });
   };
   const backToPage1 = () => {
      // Pop our own history entry so the phone's back button doesn't land on page 2 again.
      if ((location.state as { bioPage2?: boolean } | null)?.bioPage2) {
         navigate(-1);
         return;
      }
      const next = new URLSearchParams(searchParams);
      next.delete('bio');
      setSearchParams(next, { replace: true });
   };

   useEffect(() => {
      try {
         window.localStorage.setItem(draftKey(user.id), JSON.stringify({ context, profileName, username: usernameInput ?? undefined } satisfies BioDraft));
      } catch {
         // Storage blocked — the answers just won't survive leaving the page.
      }
   }, [context, profileName, usernameInput, user.id]);
   const [error, setError] = useState('');
   const [isSaving, setIsSaving] = useState(false);
   const [showAvatarModal, setShowAvatarModal] = useState(false);
   const [isSavingAvatar, setIsSavingAvatar] = useState(false);
   // Synchronous double-tap guard, before isSaving re-renders the button disabled.
   const savingRef = useRef(false);

   const canFinish = Boolean(
      context.incomeSetup && context.paydayWindow && context.monthlyIncome && context.monthlyExpenses && context.cashGaps.length > 0
   );

   // Page 1 → 2. An empty username box keeps the made-up handle (they can change it later).
   const handleNextPage = async () => {
      if (!context.incomeSetup || isSavingUsername) return;
      if (needsUsername && username) {
         if (usernameStatus === 'invalid' || usernameStatus === 'taken' || usernameStatus === 'checking') {
            setUsernameError(usernameStatus === 'checking' ? 'One moment — still checking that username.' : 'Pick a different username first.');
            return;
         }
         setIsSavingUsername(true);
         const saveError = await saveChosenUsername(dispatch, username);
         setIsSavingUsername(false);
         if (saveError) {
            setUsernameError(saveError);
            return;
         }
      }
      goToPage2();
   };

   const handleFinish = async () => {
      if (!canFinish || savingRef.current) return;
      savingRef.current = true;
      setIsSaving(true);
      setError('');
      try {
         const name = profileName.trim();
         if (name && name !== (user.displayName ?? '')) {
            const result = await dispatch(updateUser({ displayName: name }));
            if (!updateUser.fulfilled.match(result)) throw new Error(result.error?.message || 'Failed to save your name.');
            await recordProfileMilestone(user.id, 'profile-name-added');
         }
         const mapped = mapBorrowerContextForSave(context);
         await dispatch(updateBorrowerContext(mapped)).unwrap();
         try {
            window.localStorage.removeItem(draftKey(user.id));
         } catch {
            // ignore
         }
         onDone();
      } catch (err) {
         console.error('Failed to save onboarding bio:', err);
         setError("Couldn't save — please try again.");
      } finally {
         savingRef.current = false;
         setIsSaving(false);
      }
   };

   const handleAvatarSave = async (file: File, avatarBackground: string) => {
      setIsSavingAvatar(true);
      setError('');
      try {
         const avatarUrl = await uploadAvatarForCurrentUser(file);
         const result = await dispatch(updateUser({ avatarUrl, avatarBackground }));
         if (!updateUser.fulfilled.match(result)) throw new Error(result.error?.message || 'Failed to update profile image.');
         await recordProfileMilestone(user.id, 'profile-image-added');
         setShowAvatarModal(false);
      } finally {
         setIsSavingAvatar(false);
      }
   };

   return (
      // No inner scroll box: the page itself scrolls, so the bio's sticky Continue pins to the screen.
      <div className="flex flex-col gap-5 px-5 py-5 text-md-b2 text-md-heading">
         <p className="-mb-2 flex items-center gap-1.5 text-[12px] font-[590] leading-[18px] text-[#1f7a3d]">
            <Check aria-hidden="true" className="size-3.5" strokeWidth={2.6} />
            Saved on this phone as you go — you can leave and finish later.
         </p>
         <BorrowerContextLoanStep
            context={context}
            currentAvatarBackground={user.avatarBackground}
            currentAvatarUrl={user.avatarUrl}
            isSavingProfile={isSaving || isSavingUsername}
            isSubmitting={false}
            monthlyExpenses={context.monthlyExpenses ?? ''}
            monthlyIncome={context.monthlyIncome ?? ''}
            onBack={() => (page === 2 ? backToPage1() : onBack())}
            onCashGapToggle={(value) =>
               setContext((current) => ({
                  ...current,
                  cashGaps: current.cashGaps.includes(value) ? current.cashGaps.filter((gap) => gap !== value) : [...current.cashGaps, value]
               }))
            }
            onContinue={() => void handleFinish()}
            onIncomeDescriptionChange={(v) => setContext((prev) => ({ ...prev, incomeDescription: v }))}
            onIncomeSelect={(value) =>
               setContext((current) => ({
                  ...current,
                  incomeSetup: value,
                  // Drop the free-text explanation if they move off "Something else".
                  incomeDescription: value === 'contract' ? current.incomeDescription : ''
               }))
            }
            onMonthlyExpensesSelect={(v) => setContext((prev) => ({ ...prev, monthlyExpenses: v }))}
            onMonthlyIncomeSelect={(v) => setContext((prev) => ({ ...prev, monthlyIncome: v }))}
            onNextPage={() => void handleNextPage()}
            onOtherIncomeChange={(v) => setContext((prev) => ({ ...prev, otherIncome: v }))}
            onPaydaySelect={(value) => setContext((current) => ({ ...current, paydayWindow: value }))}
            onProfessionChange={(v) => setContext((prev) => ({ ...prev, profession: v }))}
            onProfileImageClick={() => setShowAvatarModal(true)}
            onProfileNameChange={(value) => {
               setProfileName(value);
               setError('');
            }}
            page={page}
            profileName={profileName}
            profileSaveError={error}
            submitLabel="Continue"
            usernameSlot={
               needsUsername ? (
                  <UsernameField
                     onChange={(value) => {
                        setUsernameInput(value);
                        setUsernameError('');
                     }}
                     problem={usernameProblemText}
                     saveError={usernameError}
                     status={usernameStatus}
                     value={username}
                  />
               ) : null
            }
         />
         <AvatarUploadModal
            currentAvatar={user.avatarUrl}
            currentAvatarBackground={user.avatarBackground}
            isOpen={showAvatarModal}
            isSaving={isSavingAvatar}
            onClose={() => setShowAvatarModal(false)}
            onSave={handleAvatarSave}
         />
      </div>
   );
}
