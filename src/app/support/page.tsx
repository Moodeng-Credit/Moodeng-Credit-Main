'use client';

import { type ReactNode, useId } from 'react';

import Link from 'next/link';

export default function SupportPage() {
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
      <>
         <div className="bg-[#c9d5f9] flex flex-col px-6 md:px-20 py-16">
            <div className="flex flex-col lg:flex-row justify-between items-start md:items-center gap-4">
               <h2 className="text-4xl font-bold text-blue-600">Contact Us</h2>
               <div className="text-gray-700 max-w-xl">
                  <p className="font-medium">
                     Have questions? The quickest way to get in touch with us is using the contact information below.
                  </p>
               </div>
            </div>
         </div>

         <Section
            header="Moodeng Support"
            content={
               <>
                  <p className="font-medium">
                     If you are a learner and need help, please visit our{' '}
                     <Link className="text-blue-600" href="#TODO">
                        Documentation / Guide
                     </Link>{' '}
                     to find troubleshooting and FAQs or contact our Learner Support team. You can search for your issue or check out our
                     most popular articles:
                  </p>
                  <ul className="flex flex-col gap-2">
                     {articles.map((article) => (
                        <li key={article.title + article.href} className="text-gray-700 font-medium text-sm">
                           <Link className="text-blue-600" href={article.href}>
                              {article.title}
                           </Link>
                        </li>
                     ))}
                  </ul>
               </>
            }
         />

         <Section
            header="Privacy Inquiries"
            content={
               <p className="font-medium">
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

         <Section
            header="Special Concerns"
            content={
               <p className="font-medium">
                  Security vulnerabilities on the this site may be reported via the{' '}
                  <Link className="text-blue-600 underline" href="#TODO">
                     HackerOne platform
                  </Link>
                  . We take our site security and user privacy very seriously, and we appreciate your help in keeping Moodeng safe!
               </p>
            }
         />

         <Section
            header="Send us a Message!"
            content={
               <>
                  <div className="grid grid-cols-2 gap-4">
                     <InputField label="First Name" placeholder="John" />
                     <InputField label="Last Name" placeholder="Doe" />
                     <InputField label="Email" placeholder="john.doe@example.com" />
                     <InputField label="Phone Number" placeholder="(+63) 000 000 0000" />
                  </div>
                  <div className="text-blue-600 font-medium">Select Subject?</div>
                  <div className="flex flex-wrap gap-8">
                     <RadioField label="General Inquiry" name="subject" />
                     <RadioField label="Account" name="subject" />
                     <RadioField label="Transaction" name="subject" />
                     <RadioField label="Others" name="subject" />
                  </div>

                  <InputField label="Message" placeholder="Write your message.." />
                  <div className="flex justify-end pt-4">
                     <button className="bg-blue-600 text-white px-6 py-2 rounded-md">Send Message</button>
                  </div>
               </>
            }
            bg
         />
      </>
   );
}

function Section(props: { header: string; content: ReactNode; bg?: boolean }) {
   return (
      <div
         className={clsx('flex flex-col px-6 md:px-20 py-16 min-h-[80svh] justify-center', {
            'bg-[#c9d5f9]': props.bg
         })}
      >
         <div className="flex flex-col lg:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-bold text-blue-600">{props.header}</h2>
            <div className="text-gray-700 max-w-xl flex flex-col gap-4 w-full">{props.content}</div>
         </div>
      </div>
   );
}

function InputField(props: { label: string; placeholder: string }) {
   return (
      <div className="flex flex-col gap-1">
         <label className="text-sm text-blue-600">{props.label}</label>
         <input
            type="text"
            className="bg-transparent border-b border-blue-600 py-2 px-1 focus:outline-none"
            placeholder={props.placeholder}
         ></input>
      </div>
   );
}

function RadioField(props: { label: string; name: string }) {
   const id = useId();
   // const [checked, setChecked] = useState(false);
   const checked = false;

   return (
      <div className="flex gap-2 items-center">
         <input
            id={id}
            type="radio"
            name={props.name}
            className={clsx('appearance-none w-3 h-3 border rounded-full cursor-pointer', {
               'bg-blue-600 border-blue-600': checked,
               'bg-gray-400 border-gray-400': !checked
            })}
         ></input>
         <label htmlFor={id} className="cursor-pointer">
            {props.label}
         </label>
      </div>
   );
}

type ClassValue = string | number | false | null | undefined | ClassValue[] | { [key: string]: boolean | undefined | null };

//TODO: use https://www.npmjs.com/package/clsx instead
function clsx(...inputs: ClassValue[]): string {
   const classes: string[] = [];

   const toClass = (value: ClassValue): void => {
      if (!value) return;

      if (typeof value === 'string' || typeof value === 'number') {
         classes.push(String(value));
         return;
      }

      if (Array.isArray(value)) {
         value.forEach(toClass);
         return;
      }

      if (typeof value === 'object') {
         for (const key in value) {
            if (value[key]) classes.push(key);
         }
      }
   };

   inputs.forEach(toClass);

   return classes.join(' ');
}
