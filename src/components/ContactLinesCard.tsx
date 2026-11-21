import { useEffect, useState } from 'react';

import { Check, Circle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { CONTACT_STEP_EXEMPT_USER_IDS } from '@/config/contactVerification';
import { useIsBorrower } from '@/hooks/useIsBorrower';
import { isUserVerified } from '@/lib/isUserVerified';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { GoldButton } from '@/views/indonesia/ui';

// Which of the two lines a loan request needs is still missing on this account. WhatsApp only counts
// while WhatsApp reminders are switched on (the same switch the database check reads).
export const useMissingContactLines = (): { messenger: boolean; whatsapp: boolean; any: boolean } => {
   const user = useSelector((state: RootState) => state.auth.user);
   const [whatsappOn, setWhatsappOn] = useState(false);
   useEffect(() => {
      if (!user?.id || user.whatsappVerified) return undefined;
      let cancelled = false;
      (async () => {
         try {
            const { data } = await getSupabaseBrowserClient().rpc('get_whatsapp_reminders_enabled');
            if (!cancelled) setWhatsappOn(data === true);
         } catch {
            // Can't tell: don't ask for WhatsApp here; the loan form still checks.
         }
      })();
      return () => {
         cancelled = true;
      };
   }, [user?.id, user?.whatsappVerified]);
   const messenger = Boolean(user) && !user?.hasMessengerLink;
   const whatsapp = Boolean(user) && !user?.whatsappVerified && whatsappOn;
   return { messenger, whatsapp, any: messenger || whatsapp };
};

const Row = ({ done, label }: { done: boolean; label: string }) => (
   <span className="flex items-center gap-2 text-[15px] font-medium text-[#0f172b] dark:text-[#f8f4ff]">
      {done ? <Check className="h-5 w-5 text-[#16a34a]" aria-hidden="true" /> : <Circle className="h-5 w-5 text-[#cbd5e1]" aria-hidden="true" />}
      <span className={done ? 'text-[#62748e] line-through' : ''}>{label}</span>
   </span>
);

/** The card itself, no account lookups (also used by the dev preview). */
export function ContactLinesCardView({
   missing,
   onConnect,
   className = ''
}: {
   missing: { messenger: boolean; whatsapp: boolean };
   onConnect: () => void;
   className?: string;
}) {
   const count = Number(missing.messenger) + Number(missing.whatsapp);
   return (
      <section
         aria-label="Connect Messenger and WhatsApp"
         className={`flex flex-col gap-3 rounded-[16px] border border-[#f3d98b] bg-[#fffaeb] p-4 dark:border-[#5c4a16] dark:bg-[#241c0a] ${className}`}
      >
         <div className="flex items-center gap-3">
            <img src={CONNECT_HIPPOS.hello} alt="" className="h-14 w-14 shrink-0 object-contain" />
            <div className="min-w-0">
               <h2 className="text-[17px] font-bold leading-6 text-[#0f172b] dark:text-white">
                  {count === 1 ? '1 thing before your next loan' : '2 things before your next loan'}
               </h2>
               <p className="text-[14px] leading-5 text-[#45556c] dark:text-[#c9c2d6]">Takes 1 minute.</p>
            </div>
         </div>
         <div className="flex flex-col gap-1.5 pl-1">
            <Row done={!missing.messenger} label="Connect Messenger" />
            <Row done={!missing.whatsapp} label="Confirm WhatsApp" />
         </div>
         <GoldButton onClick={onConnect}>Connect now</GoldButton>
      </section>
   );
}

/**
 * "You still need these to borrow": shown up front (dashboard, request board) to a verified borrower
 * who is missing Messenger or WhatsApp, so they connect before filling in a loan request instead of
 * finding out at the end of it (2026-11-15). One button, to /connect. Hidden once both are saved.
 */
export default function ContactLinesCard({ className = '', next }: { className?: string; next?: 'loan' }) {
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const isBorrower = useIsBorrower();
   const missing = useMissingContactLines();
   if (!user || !isBorrower || !isUserVerified(user) || CONTACT_STEP_EXEMPT_USER_IDS.has(user.id) || !missing.any) return null;
   return <ContactLinesCardView className={className} missing={missing} onConnect={() => navigate(next === 'loan' ? '/connect?next=loan' : '/connect')} />;
}
