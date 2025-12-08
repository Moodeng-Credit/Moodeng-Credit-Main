import { Link } from 'lucide-react';

import Section from '@/views/support/components/Section';

export default function MoodengSupport() {
   const articles = [
      {
         title: 'Check and update your email communication preferences',
         href: '#TODO'
      },
      {
         title: 'Verify your ID',
         href: '#TODO'
      },
      {
         title: 'How to solve problems with Loan Repayment',
         href: '#TODO'
      },
      {
         title: 'Cancel a loan',
         href: '#TODO'
      },
      {
         title: 'Company policies',
         href: '#TODO'
      },
      {
         title: 'Troubleshooting login and account issues',
         href: '#TODO'
      }
   ];

   return (
      <Section
         header={
            <span>
               Moodeng <br className="hidden lg:block" /> Support
            </span>
         }
         content={
            <>
               <p>
                  If you are a learner and need help, please visit our{' '}
                  <Link className="text-blue-600" href="#TODO">
                     Documentation / Guide
                  </Link>{' '}
                  to find troubleshooting and FAQs or contact our Learner Support team. You can search for your issue or check out our most
                  popular articles:
               </p>
               <ul className="flex flex-col gap-4">
                  {articles.map((article) => (
                     <li key={article.title + article.href} className="text-gray-700">
                        <Link className="text-blue-600" href={article.href}>
                           {article.title}
                        </Link>
                     </li>
                  ))}
               </ul>
            </>
         }
      />
   );
}
