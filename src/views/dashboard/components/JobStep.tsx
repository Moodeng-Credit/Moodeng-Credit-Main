import { useState } from 'react';

import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

/**
 * Loan request, for borrowers whose profile has no job saved (George, 2026-11-15): one question,
 * saved to their profile, so it's asked once. Lenders and the call sheet read it.
 */
export default function JobStep({
   initialValue = '',
   onBack,
   onSave
}: {
   initialValue?: string;
   onBack: () => void;
   // Saves the job; rejects with a message to show when it didn't save.
   onSave: (job: string) => Promise<void>;
}) {
   const [job, setJob] = useState(initialValue);
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState('');
   const ready = job.trim().length >= 3;

   const save = async () => {
      if (!ready || saving) return;
      setSaving(true);
      setError('');
      try {
         await onSave(job.trim());
      } catch {
         setError('That didn’t save. Please try again.');
         setSaving(false);
      }
   };

   return (
      <div className="connect-ui flex min-h-0 flex-col gap-5">
         <ConnectHero
            image={CONNECT_HIPPOS.call}
            subtitle="Moo-lenders like to know who they’re helping."
            title="What do you do for work?"
         />
         <div className="flex flex-col gap-2">
            <input
               autoFocus
               className="min-h-[48px] w-full rounded-[14px] border border-[#d8d0e2] bg-white px-3 py-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100"
               maxLength={60}
               onChange={(e) => setJob(e.target.value)}
               onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                     e.preventDefault();
                     void save();
                  }
               }}
               placeholder="e.g. teacher, call center agent"
               type="text"
               value={job}
            />
            <p className="text-[12px] leading-[18px] text-md-neutral-1200">Be specific, and add where you work if you can.</p>
            {error ? <p className="text-md-b3 text-md-red-500">{error}</p> : null}
         </div>
         <div className="flex flex-col gap-2">
            <PrimaryButton disabled={!ready || saving} onClick={() => void save()}>
               {saving ? 'Saving…' : 'Continue'}
            </PrimaryButton>
            <GhostButton onClick={onBack}>Back</GhostButton>
         </div>
      </div>
   );
}
