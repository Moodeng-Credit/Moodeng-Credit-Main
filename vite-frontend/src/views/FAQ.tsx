import { useState } from 'react';

export default function FAQsComponent() {
   const [openIndex, setOpenIndex] = useState(0);

   const faqs = [
      {
         number: '01',
         question: 'How does the Credit Growth System work?',
         answer: (
            <>
               <p className="mb-4">
                  <span>Everyone starts with a </span>
                  <span className="font-bold">$15 borrowing limit, and can make one request at a time.</span>
                  <span> To move up, you must </span>
                  <span className="font-bold">borrow and fully repay your entire limit</span>
                  <span>, not just part of it.</span>
               </p>
               <p className="mb-4">
                  <span>
                     For example: if your limit is $15 but you only borrow $12 and repay $15, that doesn't unlock the next level. You need
                     to borrow and repay the full $15 — including any small interest or repayment amount above what you borrowed, depending
                     on what you offered and what a lender accepted and funded you for.
                  </span>
               </p>
               <p className="mb-4">
                  <span>Each successful full repayment increases your limit step by step — </span>
                  <span className="font-bold">$15 → $20 → $40 → $60</span>
                  <span>, and beyond — while also building your trust record with lenders.</span>
               </p>
               <p className="mb-4">
                  <span>There are two loan types:</span>
               </p>
               <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>
                     <span className="font-bold">Credit Growth Loans</span>
                     <span>– full-limit loans that raise your limit once repaid.</span>
                  </li>
                  <li>
                     <span className="font-bold">Trust Loans</span>
                     <span>– smaller loans that build your repayment history but don't increase your limit.</span>
                  </li>
               </ul>
            </>
         )
      },
      {
         number: '02',
         question: 'How do I apply for a loan using the Request Board?',
         answer: (
            <>
               <p className="mb-4">
                  <span>Go to the </span>
                  <span className="font-bold">Request Board</span>
                  <span> and click </span>
                  <span className="font-bold">"Apply for Loan."</span>
                  <span> Make sure you're verified first.</span>
               </p>
               <p className="mb-4">
                  <span>You'll fill in:</span>
               </p>
               <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>
                     <span>The amount (up to your current credit limit)</span>
                  </li>
                  <li>
                     <span>The repayment date</span>
                  </li>
                  <li>
                     <span>The interest rate you offer</span>
                  </li>
                  <li>
                     <span>The reason for your loan</span>
                  </li>
               </ul>
               <p className="mb-4">
                  <span>Then lenders review your request and decide whether to fund it.</span>
               </p>
            </>
         )
      },
      {
         number: '03',
         question: 'How do I repay a loan?',
         answer: (
            <>
               <p className="mb-4">
                  <span>Go to </span>
                  <span className="font-bold">Dashboard → Loan Summary</span>
                  <span> and make sure you're viewing the </span>
                  <span className="font-bold">Borrower tab</span>
                  <span>. From there, find your active loan and click </span>
                  <span className="font-bold">"Repay."</span>
               </p>
               <p className="mb-4">
                  <span>You can repay using any wallet that holds </span>
                  <span className="font-bold">USDC</span>
                  <span>
                     — it doesn't have to be the same one you received funds in. Once the repayment is confirmed on-chain, your loan will
                     automatically be marked as repaid.
                  </span>
               </p>
               <p className="mb-4">
                  <span>We recommend using </span>
                  <span className="font-bold">Coinbase Wallet on Base</span>
                  <span>, because USDC transactions there are </span>
                  <span className="font-bold">gasless (feeless)</span>
                  <span> — meaning 100% of what you send goes toward your repayment, with no network fees.</span>
               </p>
               <p className="mb-4">
                  <span>💡 </span>
                  <span className="font-bold">Tip:</span>
                  <span>
                     You can also move funds from your exchange to your wallet first, then repay from there. In the future, direct exchange
                     repayments will be supported too.
                  </span>
               </p>
            </>
         )
      },
      {
         number: '04',
         question: 'What is a wallet and why do I need one?',
         answer: (
            <>
               <p className="mb-4">
                  <span>A wallet is your </span>
                  <span className="font-bold">digital account</span>
                  <span> that holds your money (USDC) and connects you to the Moodeng platform. It's how you </span>
                  <span className="font-bold">receive loan funds and make repayments.</span>
               </p>
               <p className="mb-4">
                  <span>Your wallet also acts as your </span>
                  <span className="font-bold">verified financial identity on-chain.</span>
                  <span> If you're a borrower, it links to your </span>
                  <span className="font-bold">World ID</span>
                  <span> to confirm you're a real person — no paperwork needed.</span>
               </p>
               <p className="mb-4">
                  <span>You'll need to </span>
                  <span className="font-bold">create or connect a wallet</span>
                  <span>
                     before borrowing or lending. It's important to keep access secure, because losing your wallet means losing access to
                     your funds.
                  </span>
               </p>
               <p className="mb-4">
                  <span>We recommend using a </span>
                  <span className="font-bold">Coinbase Smart Wallet</span>
                  <span> on Base — it's gasless, simple to set up, and works perfectly with Moodeng.</span>
               </p>
            </>
         )
      },
      {
         number: '05',
         question: 'What happens if I default?',
         answer: (
            <>
               <p className="mb-4">
                  <span>
                     If you miss a repayment, your credit level doesn't decrease, but your record shows a default. This affects how much
                     trust lenders place in you for future loans.
                  </span>
               </p>
               <p className="mb-4">
                  <span>
                     The system is designed to encourage good behavior — timely repayments protect your reputation and make it easier to get
                     funded again.
                  </span>
               </p>
            </>
         )
      },
      {
         number: '06',
         question: 'Why is Base the recommended network (and why Coinbase Wallet)?',
         answer: (
            <>
               <p className="mb-4">
                  <span>Base is built by Coinbase and supports </span>
                  <span className="font-bold">gasless USDC transactions</span>
                  <span>, meaning there are no network fees when sending or repaying loans.</span>
               </p>
               <p className="mb-4">
                  <span>Using </span>
                  <span className="font-bold">Coinbase Wallet on Base</span>
                  <span> keeps everything </span>
                  <span className="font-bold">feeless, fast, and simple.</span>
                  <span> Your repayments go entirely to your lender — not to network fees.</span>
               </p>
               <p className="mb-4">
                  <span>This helps keep Moodeng affordable, beginner-friendly, and accessible for everyone building credit.</span>
               </p>
            </>
         )
      },
      {
         number: '07',
         question: 'Does Moodeng Credit hold any of your money?',
         answer: (
            <>
               <p className="mb-4">
                  <span>No. The platform only connects borrowers and lenders — it doesn't hold or move funds.</span>
               </p>
               <p className="mb-4">
                  <span>If you're a borrower, lenders fund you directly to your wallet. You repay them directly to theirs.</span>
               </p>
               <p className="mb-4">
                  <span>Moodeng Credit takes no fees and no cut from either side.</span>
               </p>
               <p className="mb-4">
                  <span>💡 </span>
                  <span className="font-bold">
                     How do we make money?
                     <br />
                  </span>
                  <span> We'll launch a token in the future called </span>
                  <span className="font-bold">IOU</span>
                  <span>, and build additional products and services around it.</span>
               </p>
            </>
         )
      },
      {
         number: '08',
         question: 'Does Moodeng Credit charge fees?',
         answer: (
            <p className="mb-4">
               <span>
                  No, we don't charge fees for borrowing or lending.
                  <br /> However, there's a small{' '}
               </span>
               <span className="font-bold">$1 verification fee</span>
               <span> (for borrowers and lenders). This helps prevent bots and keeps the platform safe.</span>
            </p>
         )
      },
      {
         number: '09',
         question: 'Is Moodeng Credit safe?',
         answer: (
            <>
               <p className="mb-4">
                  <span>Yes. We're built on </span>
                  <span className="font-bold">blockchain technology</span>
                  <span>, which means your transactions are </span>
                  <span className="font-bold">encrypted, verifiable, and transparent.</span>
               </p>
               <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>
                     <span>No personal data is shared or stored.</span>
                  </li>
                  <li>
                     <span>No central system holds your money.</span>
                  </li>
                  <li>
                     <span>Nothing can be hacked or stolen from us, because we never touch your funds.</span>
                  </li>
               </ul>
               <p className="mb-4">
                  <span>We're safer than traditional institutions that rely on outdated, hackable databases.</span>
               </p>
            </>
         )
      },
      {
         number: '10',
         question: 'What is USDC (and why do we use it)?',
         answer: (
            <>
               <p className="mb-4">
                  <span className="font-bold">USDC</span>
                  <span> is a </span>
                  <span className="font-bold">stablecoin</span>
                  <span> — a digital dollar that's always worth </span>
                  <span className="font-bold">
                     $1 USD.
                     <br />
                  </span>
                  <span> It's issued by </span>
                  <span className="font-bold">Circle</span>
                  <span> in partnership with </span>
                  <span className="font-bold">Coinbase</span>
                  <span>, two regulated U.S. financial companies.</span>
               </p>
               <p className="mb-4">
                  <span>We use USDC because:</span>
               </p>
               <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>
                     <span>It's </span>
                     <span className="font-bold">stable</span>
                     <span>, not volatile like other cryptocurrencies.</span>
                  </li>
                  <li>
                     <span>It's </span>
                     <span className="font-bold">widely trusted</span>
                     <span>and globally used.</span>
                  </li>
                  <li>
                     <span>It keeps your loan values consistent — not rising or falling with crypto markets.</span>
                  </li>
               </ul>
            </>
         )
      },
      {
         number: '11',
         question: 'Who decides the loan’s interest rate?',
         answer: (
            <>
               <p className="mb-4">
                  <span>The </span>
                  <span className="font-bold">borrower</span>
                  <span>does. You choose the interest rate, repayment date, and reason for the loan when posting your request.</span>
               </p>
               <p className="mb-4">
                  <span>Lenders review your offer and decide whether to fund it — keeping the system transparent and borrower-led.</span>
               </p>
            </>
         )
      }
   ];

   return (
      <div className="bg-[#c9d5f9] flex flex-col px-6 md:px-20 py-12">
         {/* Header */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
            <h2 className="text-4xl font-bold text-blue-600">FAQs</h2>
            <div className="text-gray-700 max-w-2xl mt-6 md:mt-0">
               <p className="font-medium">
                  The Comprehensive FAQ Guide to Credit Growth, Secure Loans, and Transparent Financial Management
               </p>
               <p className="text-sm text-gray-500 mt-2">Note: You might want to read all of it so you don’t FAQ up.</p>
            </div>
         </div>

         {/* FAQ Items */}
         <div className="space-y-4 w-full self-center">
            {faqs.map((faq, idx) => (
               <div key={faq.number} className="bg-white rounded-xl shadow-sm">
                  <button
                     onClick={() => setOpenIndex(openIndex === idx ? -1 : idx)}
                     className="w-full flex justify-between items-center text-left px-6 py-6 rounded-xl transition"
                  >
                     <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-blue-600">{faq.number}</span>
                        <span className="text-lg font-semibold text-gray-900">{faq.question}</span>
                     </div>
                     <span className="text-2xl font-bold text-blue-600">{openIndex === idx ? '×' : '+'}</span>
                  </button>

                  {openIndex === idx ? <div className="px-20 pb-6">{faq.answer}</div> : null}
               </div>
            ))}
         </div>
      </div>
   );
}
