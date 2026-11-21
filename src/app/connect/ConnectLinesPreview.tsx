import { useSearchParams } from 'react-router-dom';

import { ContactLinesCardView } from '@/components/ContactLinesCard';
import { CONNECT_HIPPOS, ConnectHero, PrimaryButton } from '@/views/dashboard/components/connectKit';
import ContactsStep from '@/views/dashboard/components/ContactsStep';

// Dev-only (/connect-preview?view=card|step|done): the "2 things before your next loan" card and the
// /connect page without an account, for screenshots.
export default function ConnectLinesPreview() {
   const [params] = useSearchParams();
   const view = params.get('view') ?? 'card';
   if (view === 'card') {
      return (
         <main className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col gap-4 bg-md-neutral-200 px-4 py-5">
            <ContactLinesCardView missing={{ messenger: true, whatsapp: true }} onConnect={() => undefined} />
            <ContactLinesCardView missing={{ messenger: false, whatsapp: true }} onConnect={() => undefined} />
         </main>
      );
   }
   if (view === 'done') {
      return (
         <main className="mx-auto flex min-h-screen w-full max-w-modal flex-col justify-center gap-6 bg-gradient-to-b from-[#fbfafd] to-white px-5 py-8">
            <ConnectHero image={CONNECT_HIPPOS.hello} title="You're all set ✅" subtitle="Messenger and WhatsApp are connected. That's everything we need." />
            <PrimaryButton>Go to dashboard</PrimaryButton>
         </main>
      );
   }
   return (
      <main className="mx-auto flex min-h-screen w-full max-w-modal flex-col bg-gradient-to-b from-[#fbfafd] to-white">
         <ContactsStep
            requireAllLines
            userId="00000000-0000-0000-0000-000000000000"
            source="connect_link"
            backLabel="Later"
            onBack={() => undefined}
            onContinue={() => undefined}
            intro={<ConnectHero image={CONNECT_HIPPOS.hello} title="Connect Messenger + WhatsApp" subtitle="So we can reach you about your loan. Takes 1 minute." />}
         />
      </main>
   );
}
