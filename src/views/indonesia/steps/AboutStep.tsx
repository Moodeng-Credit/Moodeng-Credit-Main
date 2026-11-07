import { useState } from 'react';

import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { idStepPath, pick } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { DoneRow, GoldButton, SoftButton, StepHead } from '@/views/indonesia/ui';
import OnboardingBio from '@/views/onboarding/OnboardingBio';

// Step 4: about you — the same two-page bio as the normal onboarding (OnboardingBio: work, payday,
// income and expenses), saved to the profile. users.income_type set = done.

const COPY = {
   id: {
      title: 'Tentang kamu',
      subtitle: 'Pekerjaan dan gajian.',
      done: 'Sudah diisi',
      edit: 'Ubah',
      next: 'Lanjut'
   },
   en: {
      title: 'About you',
      subtitle: 'Your work and payday.',
      done: 'Filled in',
      edit: 'Edit',
      next: 'Continue'
   }
};

export default function AboutStep({ data, user, lang, refresh, onDone }: IdStepProps) {
   const t = pick(lang, COPY);
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const [editing, setEditing] = useState(false);
   const done = data.steps.about;

   if (done && !editing) {
      return (
         <div data-i18n-skip className="flex flex-col gap-4">
            <StepHead image={CONNECT_HIPPOS.cashout} title={t.title} />
            <DoneRow>{t.done}</DoneRow>
            <GoldButton onClick={onDone}>{t.next}</GoldButton>
            <SoftButton onClick={() => setEditing(true)}>{t.edit}</SoftButton>
         </div>
      );
   }

   return (
      <>
         <div data-i18n-skip>
            <StepHead image={CONNECT_HIPPOS.cashout} title={t.title} subtitle={t.subtitle} />
         </div>
         {/* The bio itself is the app's shared component (translated by the app like the rest of it). */}
         <div className="-mx-4">
            <OnboardingBio
               onBack={() => (editing ? setEditing(false) : navigate(idStepPath('facebook')))}
               onDone={() => {
                  void (async () => {
                     await dispatch(fetchUser())
                        .unwrap()
                        .catch(() => undefined);
                     await refresh();
                     setEditing(false);
                     onDone();
                  })();
               }}
               user={user}
            />
         </div>
      </>
   );
}
