import ContactUs from '@/views/support/sections/ContactUs';
import MoodengSupport from '@/views/support/sections/MoodengSupport';
import PrivacyInquiries from '@/views/support/sections/PrivacyInquiries';
import SendMessage from '@/views/support/sections/SendMessage';
import SpecialConcerns from '@/views/support/sections/SpecialConcerns';

export default function SupportPage() {
   return (
      <>
         <ContactUs />
         <MoodengSupport />
         <PrivacyInquiries />
         <SpecialConcerns />
         <SendMessage />
      </>
   );
}
