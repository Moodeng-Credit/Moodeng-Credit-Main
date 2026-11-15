import { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useMissingContactLines } from '@/components/ContactLinesCard';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { CONNECT_HIPPOS, ConnectHero, PrimaryButton } from '@/views/dashboard/components/connectKit';
import ContactsStep from '@/views/dashboard/components/ContactsStep';

// moodeng.app/connect — one link to add the two lines a loan request needs (Messenger with its ID +
// WhatsApp), outside the loan form. For borrowers who are missing one: sent by the team ("tap this to
// connect"), and opened from the "2 things before your next loan" card. Uses the same step as the
// loan form, so what they see and how it's checked are identical. ?next=loan → back to their request.
export default function ConnectLinesPage() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const [params] = useSearchParams();
   const user = useSelector((state: RootState) => state.auth.user);
   const missing = useMissingContactLines();
   const [done, setDone] = useState(false);
   const backToLoan = params.get('next') === 'loan';
   const leave = () => navigate(backToLoan ? '/request-board?applyLoan=1' : '/dashboard');

   if (!user) return null;

   if (done || (!missing.messenger && user.whatsappVerified)) {
      return (
         <main className="mx-auto flex min-h-screen w-full max-w-modal flex-col justify-center gap-6 bg-gradient-to-b from-[#fbfafd] to-white px-5 py-8 dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f]">
            <ConnectHero image={CONNECT_HIPPOS.hello} title="You're all set ✅" subtitle="Messenger and WhatsApp are connected. That's everything we need." />
            <PrimaryButton onClick={leave}>{backToLoan ? 'Back to my loan request' : 'Go to dashboard'}</PrimaryButton>
         </main>
      );
   }

   return (
      <main className="mx-auto flex min-h-screen w-full max-w-modal flex-col bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f]">
         <ContactsStep
            requireAllLines
            userId={user.id}
            source="connect_link"
            backLabel="Later"
            onBack={leave}
            onContinue={() => {
               setDone(true);
               void dispatch(fetchUser());
            }}
            intro={<ConnectHero image={CONNECT_HIPPOS.hello} title="Connect Messenger + WhatsApp" subtitle="So we can reach you about your loan. Takes 1 minute." />}
         />
      </main>
   );
}
