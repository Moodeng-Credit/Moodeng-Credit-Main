import Link from 'next/link';

import Section from '@/views/support/components/Section';

export default function SpecialConcerns() {
   return (
      <Section
         header={
            <span>
               Special <br className="hidden lg:block" /> Concerns
            </span>
         }
         content={
            <p>
               Security vulnerabilities on the this site may be reported via the{' '}
               <Link className="text-blue-600 underline" href="#TODO">
                  HackerOne platform
               </Link>
               . We take our site security and user privacy very seriously, and we appreciate your help in keeping Moodeng safe!
            </p>
         }
      />
   );
}
