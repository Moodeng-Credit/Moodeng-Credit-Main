import { useRef, useState } from 'react';

import { useDispatch } from 'react-redux';

import type { BorrowerContextState } from '@/lib/borrowerContextFit';
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
   const [page, setPage] = useState<1 | 2>(1);
   const [context, setContext] = useState<BorrowerContextState>(emptyBorrowerContext);
   const [profileName, setProfileName] = useState(user.displayName ?? user.username ?? '');
   const [error, setError] = useState('');
   const [isSaving, setIsSaving] = useState(false);
   const [showAvatarModal, setShowAvatarModal] = useState(false);
   const [isSavingAvatar, setIsSavingAvatar] = useState(false);
   // Synchronous double-tap guard, before isSaving re-renders the button disabled.
   const savingRef = useRef(false);

   const canFinish = Boolean(
      context.incomeSetup && context.paydayWindow && context.monthlyIncome && context.monthlyExpenses && context.cashGaps.length > 0
   );

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
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         <BorrowerContextLoanStep
            context={context}
            currentAvatarBackground={user.avatarBackground}
            currentAvatarUrl={user.avatarUrl}
            isSavingProfile={isSaving}
            isSubmitting={false}
            monthlyExpenses={context.monthlyExpenses ?? ''}
            monthlyIncome={context.monthlyIncome ?? ''}
            onBack={() => (page === 2 ? setPage(1) : onBack())}
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
            onNextPage={() => {
               if (context.incomeSetup) setPage(2);
            }}
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
