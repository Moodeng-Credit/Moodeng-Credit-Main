import { Mail } from 'lucide-react';

import { WalletEmailField } from '@/components/account/WalletEmailField';

import { useAccountEmail } from '@/hooks/useAccountEmail';

/**
 * Dashboard card for accounts with no real email (phone sign-ups). George's rule (2026-10-15): never
 * ask during sign-up or onboarding, so people inside Facebook's browser go straight through to their
 * loan request; ask only after the first loan request. Once an email is saved it is pending, and
 * ConfirmEmailReminder takes over with the code. Same look as that card, so the two read as one step.
 */
export function AddEmailCard() {
   const { isLoading, needsEmail, pendingEmail } = useAccountEmail();
   if (isLoading || !needsEmail || pendingEmail) return null;

   return (
      <section
         aria-label="Add your email"
         className="mx-5 rounded-[12px] border border-[#E7D8FF] bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(28,5,61,0.06)] dark:border-[#2D1F4A] dark:bg-[#1E1530]"
      >
         <div className="mb-3 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#efeaff] dark:bg-[#2A1D40]">
               <Mail className="h-5 w-5 text-[#6b55f7] dark:text-[#b3a6ff]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
               <p className="text-[16px] font-semibold leading-6 text-[#0f172b] dark:text-white">Add your email</p>
               <p className="text-[14px] leading-5 text-[#45556c] dark:text-[#c8b8e8]">For loan receipts and payment reminders.</p>
            </div>
         </div>
         <WalletEmailField label="Email address" helper="We'll send a code to confirm it." hideWhenPending />
      </section>
   );
}
