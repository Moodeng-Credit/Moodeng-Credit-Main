import { Facebook } from 'lucide-react';

import { CONNECT_HIPPOS, ConnectHero, OptionCard, PrimaryButton } from '@/views/dashboard/components/connectKit';
import WhatsAppRemindersCard, { WhatsAppCodePanel } from '@/views/dashboard/components/WhatsAppRemindersCard';

// DEV-only screenshot harness for the WhatsApp reminders card on the "How can we reach you?" step, as a
// borrower inside Facebook's browser sees it (Messenger already connected, notifications can't work).
// ?state=offer (default) | code | on. Never registered in production; nothing here talks to the server.
export default function WhatsAppRemindersPreview() {
   const state = new URLSearchParams(window.location.search).get('state') ?? 'offer';

   return (
      <div className="min-h-screen bg-md-neutral-300">
         <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col gap-4 bg-white px-5 py-5 text-md-b2 text-md-heading">
            <ConnectHero image={CONNECT_HIPPOS.hello} subtitle="Only Moodeng sees this — never lenders." title="How can we reach you?" />
            <OptionCard
               done
               doneLabel="Verified"
               icon={<Facebook aria-hidden="true" className="size-9 text-[#0866FF]" strokeWidth={2} />}
               title="Messenger"
            />
            {state === 'code' ? (
               <WhatsAppCodePanel code="MDNG-4F2A9C" copied={false} onCopy={() => {}} />
            ) : (
               <WhatsAppRemindersCard onVerified={() => {}} source="preview" userId="preview" verified={state === 'on'} />
            )}
            <div className="mt-auto flex flex-col gap-1 pt-2">
               <PrimaryButton onClick={() => {}}>Continue</PrimaryButton>
            </div>
         </div>
      </div>
   );
}
