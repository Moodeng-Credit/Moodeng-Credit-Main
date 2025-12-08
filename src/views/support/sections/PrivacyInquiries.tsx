import Link from 'next/link';

import Section from '@/views/support/components/Section';

export default function PrivacyInquiries() {
   return (
      <Section
         header={
            <span>
               Privacy <br className="hidden lg:block" />
               Inquiries
            </span>
         }
         content={
            <p>
               If you have questions about our{' '}
               <Link className="text-blue-600" href="#TODO">
                  Privacy Notice
               </Link>{' '}
               or an enquiry about how we protect your personal information, you can contact us at{' '}
               <a className="text-blue-600" href="#TODO">
                  admin@moodengcredit.com
               </a>
            </p>
         }
         bg
      />
   );
}
