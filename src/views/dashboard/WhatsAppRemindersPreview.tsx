import { Facebook, MessageCircle } from 'lucide-react';

import { CONNECT_HIPPOS, ConnectHero, LockedStepCard, OptionCard, PrimaryButton, StepLabel } from '@/views/dashboard/components/connectKit';
import WhatsAppRemindersCard, { WhatsAppCodePanel } from '@/views/dashboard/components/WhatsAppRemindersCard';

// DEV-only screenshot harness for the WhatsApp reminders card on the "How can we reach you?" step, as a
// borrower inside Facebook's browser sees it (notifications can't work there).
// ?state=locked (Facebook not connected yet) | offer (default) | code | on. Never registered in
// production; nothing here talks to the server.
export default function WhatsAppRemindersPreview() {
   const state = new URLSearchParams(window.location.search).get('state') ?? 'offer';
   const facebookDone = state !== 'locked';

   return (
      <div className="min-h-screen bg-md-neutral-300">
         <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col gap-4 bg-white px-5 py-5 text-md-b2 text-md-heading">
            <ConnectHero image={CONNECT_HIPPOS.hello} subtitle="Only Moodeng sees this — never lenders." title="How can we reach you?" />
            <StepLabel done={facebookDone} n={1} text="Connect Facebook" />
            <OptionCard
               badge="1 min"
               done={facebookDone}
               doneLabel="Verified"
               icon={<Facebook aria-hidden="true" className="size-9 text-[#0866FF]" strokeWidth={2} />}
               onClick={() => {}}
               subtitle="Opens our chat. Say hi and you’re connected."
               title="Messenger"
            />
            <StepLabel done={state === 'on'} n={2} text="Payment reminders" />
            {state === 'locked' ? (
               <LockedStepCard
                  hint="Unlocks after step 1"
                  icon={<MessageCircle aria-hidden="true" className="size-9 text-[#25D366]" strokeWidth={2} />}
                  title="Get reminders on WhatsApp"
               />
            ) : state === 'code' ? (
               <WhatsAppCodePanel code="MDNG-4F2A9C" copied={false} onCopy={() => {}} />
            ) : (
               <WhatsAppRemindersCard onVerified={() => {}} source="preview" userId="preview" verified={state === 'on'} />
            )}
            <div className="mt-auto flex flex-col gap-1 pt-2">
               <PrimaryButton disabled={!facebookDone} onClick={() => {}}>
                  Continue
               </PrimaryButton>
               {!facebookDone ? <p className="text-center text-md-b3 text-[#877897]">Connect Facebook to continue.</p> : null}
            </div>
         </div>
      </div>
   );
}
