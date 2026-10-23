// Full Terms of Service and Privacy Policy text, rendered by LegalPage.
// TikTok rejected the earlier short versions (Oct 2026), so keep these complete when editing.

export type LegalSection = {
   title: string;
   paragraphs?: string[];
   bullets?: string[];
   // Optional text after the bullet list.
   after?: string[];
};

export const SUPPORT_EMAIL = 'support@moodeng.app';
export const LEGAL_LAST_UPDATED = 'October 21, 2026';

export const termsSections: LegalSection[] = [
   {
      title: 'About these Terms',
      paragraphs: [
         'These Terms of Service ("Terms") are an agreement between you and Building Credit Asia LLC, a Colorado limited liability company that operates Moodeng Credit ("Moodeng", "we", "our", or "us"). They apply to the website at moodeng.app, our web and mobile apps, our lessons, quizzes and rewards, our Messenger, Telegram and WhatsApp channels, and the lending marketplace (together, the "Service").',
         'By creating an account, signing in, or using the Service, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Service.'
      ]
   },
   {
      title: 'Who can use Moodeng',
      bullets: [
         'You must be at least 18 years old and able to enter into a binding contract.',
         'You must not be located in, or a resident of, a country or region subject to comprehensive sanctions, and you must not be on any government sanctions or restricted-party list.',
         'You must follow the laws that apply to you where you live. Some features, including borrowing and lending, are only available in certain countries. We may limit or refuse access based on location.',
         'You may hold only one account, unless we agree otherwise in writing.'
      ]
   },
   {
      title: 'Your account and signing in',
      paragraphs: [
         'You can create an account with an email address, a phone number, or a third-party sign-in such as Google, Facebook, LINE, Telegram, or TikTok. When you use a third-party sign-in, that provider\'s own terms also apply, and we receive only the information described in our Privacy Policy. We never receive your password for those services.',
         'You agree to give accurate and current information and to keep it up to date. You are responsible for keeping your sign-in methods, devices, and wallet secure, and for all activity on your account. Tell us right away at support@moodeng.app if you think someone else has accessed your account.'
      ]
   },
   {
      title: 'Identity verification and screening',
      paragraphs: [
         'Before you can borrow or lend, we may ask you to verify your identity. This can include a government ID, a selfie and liveness check through our verification provider, a short screening call or video call, and confirming your phone number or messaging account. We may also run fraud, sanctions, and anti-money-laundering checks.',
         'We decide in our discretion whether to approve an account, a credit limit, or a loan request, and we may ask for more information at any time. Approval is never guaranteed.'
      ]
   },
   {
      title: 'What Moodeng is, and what it is not',
      bullets: [
         'Moodeng is a platform for small, short-term USDC loans and for learning about money. Loans may be funded by other users, by Moodeng, or by Moodeng\'s funding partners.',
         'Moodeng is not a bank, and USDC held in your wallet is not a bank deposit and is not insured by any government.',
         'Our lessons, quizzes, articles, and videos are general education only. They are not financial, investment, tax, or legal advice. Think carefully and, if needed, get professional advice before making financial decisions.',
         'We do not guarantee that any loan request will be funded or that any loan will be repaid.'
      ]
   },
   {
      title: 'Borrowing',
      paragraphs: [
         'Before you accept a loan, the Service shows you the amount, the fees, the total to repay, and the due date. Read them carefully. By accepting a loan you agree to repay the full amount shown by the due date, in the way the Service describes.'
      ],
      bullets: [
         'If an extension is offered, its fee and new due date are shown before you accept it.',
         'If you repay late or do not repay, we may lower or remove your credit limit, pause your access, record the late payment in your Moodeng repayment history, and send you reminders through the contact channels you gave us.',
         'Your credit limit may go up after on-time repayment and may go down after late repayment. Limits are set by us and can change.',
         'We will never contact the people in your phone contacts, post about your debt publicly, or use threats or abusive language to collect a payment.'
      ]
   },
   {
      title: 'Lending',
      paragraphs: [
         'If you lend through Moodeng, you choose which requests to fund. You understand that borrowers may repay late or not at all, that you may lose some or all of the amount you lend, and that information shown about a borrower is provided to help you decide but is not a promise about their behavior. Any returns shown are estimates, not guarantees.'
      ]
   },
   {
      title: 'Wallets, USDC, and blockchain transactions',
      bullets: [
         'Loans and repayments are made in USDC on public blockchain networks. Your Moodeng wallet is created and secured with our wallet provider, or you may connect your own wallet.',
         'Blockchain transactions are final. We cannot reverse a transaction, recover funds sent to the wrong address, or recover a wallet you lose access to.',
         'Stablecoins and blockchain networks carry risks, including network outages, smart-contract bugs, changes in law, and the risk that a stablecoin loses its peg.',
         'Buying, selling, or converting USDC through exchanges, on-ramps, or payment partners is provided by those third parties under their own terms and fees.'
      ]
   },
   {
      title: 'Lessons, quizzes, prizes, and referrals',
      bullets: [
         'Prizes, vouchers, and referral rewards are promotional, limited to one per person unless stated otherwise, and have no cash value unless we say so.',
         'We may change, pause, or end any promotion at any time, and we may set extra rules for a specific promotion.',
         'We may cancel rewards earned through fake accounts, automation, self-referrals, or any other abuse.'
      ]
   },
   {
      title: 'Acceptable use',
      paragraphs: ['You agree not to:'],
      bullets: [
         'give false information, pretend to be someone else, or use another person\'s identity documents',
         'create more than one account or help others get around a ban or limit',
         'use the Service for fraud, money laundering, terrorist financing, or any other illegal purpose',
         'harass, threaten, or abuse other users or our team',
         'scrape, copy, or collect data from the Service using bots or automated tools',
         'interfere with, probe, or try to break the security of the Service, or upload malware',
         'reverse engineer the Service except where the law allows it'
      ]
   },
   {
      title: 'Your content',
      paragraphs: [
         'You keep ownership of the information and content you submit, such as your profile, borrower context, and messages. You give us a worldwide, non-exclusive, royalty-free licence to use, store, and display that content only as needed to run, secure, and improve the Service and as described in our Privacy Policy. If you send us ideas or feedback, we may use them without any obligation to you.'
      ]
   },
   {
      title: 'Our intellectual property',
      paragraphs: [
         'The Service, including the Moodeng name, logo, mascot, designs, lessons, and software, belongs to us or our licensors and is protected by law. We give you a limited, personal, non-transferable licence to use the Service as these Terms allow. You may share links to our public pages and videos, but you may not copy, sell, or republish our content without our permission.'
      ]
   },
   {
      title: 'Third-party services',
      paragraphs: [
         'The Service uses or links to services run by others, such as sign-in providers, identity verification, wallets, payment and exchange partners, messaging apps, and video calling. We do not control those services and are not responsible for them. Your use of them is governed by their own terms and privacy policies.'
      ]
   },
   {
      title: 'Fees',
      paragraphs: [
         'Creating an account and using our lessons is free. Loan fees, extension fees, and any platform fees are shown before you agree to them. Blockchain network fees and third-party fees may also apply. We will not charge you a fee that was not shown to you first.'
      ]
   },
   {
      title: 'Suspension and closing your account',
      paragraphs: [
         'You can stop using the Service and ask us to close your account at any time by contacting support@moodeng.app. Closing your account does not cancel any amount you still owe on a loan.',
         'We may suspend, limit, or close your account, or refuse a request, if we reasonably believe you broke these Terms, created risk or harm for other users or for us, or if the law requires it. Where we can, we will tell you why.'
      ]
   },
   {
      title: 'Disclaimers',
      paragraphs: [
         'To the fullest extent the law allows, the Service is provided "as is" and "as available". We do not promise that the Service will always be available, error-free, or secure, or that any information on it is complete or accurate. Some places do not allow these disclaimers, so they may not all apply to you.'
      ]
   },
   {
      title: 'Limitation of liability',
      paragraphs: [
         'To the fullest extent the law allows, Moodeng and its owners, team members, and partners will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or funds caused by blockchain networks, third-party services, or your own wallet security. Our total liability for any claim about the Service is limited to the greater of the fees you paid us in the 12 months before the claim or US$100.',
         'Nothing in these Terms limits liability that cannot be limited by law, such as liability for fraud or for rights you have under consumer protection laws where you live.'
      ]
   },
   {
      title: 'Indemnity',
      paragraphs: [
         'To the extent the law allows, you agree to cover our reasonable losses and costs, including legal fees, arising from your breach of these Terms, your misuse of the Service, or your violation of anyone else\'s rights.'
      ]
   },
   {
      title: 'Governing law and disputes',
      paragraphs: [
         'These Terms are governed by the laws of the State of Colorado, United States, without regard to its conflict-of-law rules. If you have a problem, please contact support@moodeng.app first; we will try to resolve it within 30 days. If we cannot, the dispute will be decided by the state or federal courts located in Colorado, and you and we agree to their jurisdiction.',
         'If you live outside the United States, you keep the protection of any mandatory consumer laws of your country and may also be able to bring a claim in your local courts.'
      ]
   },
   {
      title: 'Changes to these Terms',
      paragraphs: [
         'We may update these Terms as the Service changes. We will change the "Last updated" date above, and for important changes we will tell you in the app or by message before they take effect. If you keep using the Service after the changes take effect, you accept the new Terms. If you do not agree, stop using the Service and close your account.'
      ]
   },
   {
      title: 'General',
      bullets: [
         'These Terms and our Privacy Policy are the whole agreement between you and us about the Service.',
         'If any part of these Terms cannot be enforced, the rest stays in effect.',
         'If we do not enforce a right right away, we have not given it up.',
         'You may not transfer these Terms to anyone else. We may transfer them as part of a merger, sale, or reorganisation.',
         'If these Terms are translated, the English version controls.'
      ]
   },
   {
      title: 'Contact us',
      paragraphs: [
         'Building Credit Asia LLC (Moodeng Credit). Email: support@moodeng.app. You can also reach us through the chat on moodeng.app.'
      ]
   }
];

export const privacySections: LegalSection[] = [
   {
      title: 'Who we are',
      paragraphs: [
         'Moodeng Credit is operated by Building Credit Asia LLC, a Colorado limited liability company ("Moodeng", "we", "our", or "us"). We are responsible for the personal information described in this Privacy Policy.',
         'This policy covers moodeng.app, our web and mobile apps, our lessons and quizzes, our Messenger, Telegram, and WhatsApp channels, and the lending marketplace (the "Service"). It explains what we collect, why, who we share it with, how long we keep it, and the choices you have.'
      ]
   },
   {
      title: 'Information you give us',
      bullets: [
         'Account details: name, email address, phone number, date of birth, country, and profile photo.',
         'Profile and borrower information: your bio, work or income details you choose to share, the reason for a loan, and loan requests.',
         'Screening answers: your answers to our screening questions, and notes, recordings, or transcripts of screening calls when you agree to them.',
         'Messages: what you send to our support chat, email, Messenger, Telegram, or WhatsApp.',
         'Survey, quiz, and prize information, such as quiz answers and the rewards you claim.'
      ]
   },
   {
      title: 'Information from sign-in providers',
      paragraphs: [
         'If you sign up or log in with another service, that service sends us a small amount of information, only after you approve it on their screen. We never receive your password for that service.'
      ],
      bullets: [
         'Google: your name, email address, and profile photo.',
         'Facebook: your name, email address, profile photo, and an app-specific user ID.',
         'LINE: your LINE user ID, display name, profile photo, and email address if you share it.',
         'Telegram: your Telegram user ID, username, name, and profile photo.',
         'TikTok: see the next section.',
         'World ID: a proof that you are a unique person. We do not receive any biometric data from World ID.'
      ]
   },
   {
      title: 'Signing in with TikTok',
      paragraphs: [
         'If you choose "Continue with TikTok", we use TikTok Login Kit with the user.info.basic permission. With your approval, TikTok shares only:'
      ],
      bullets: [
         'your open_id (an ID that TikTok creates for your account in our app),',
         'your TikTok display name, and',
         'your TikTok profile photo (avatar).'
      ],
      after: [
         'We use the open_id only to recognise you, so you always sign in to the same Moodeng account and your quiz prizes are saved once. We show your display name and avatar on your Moodeng profile. We do not post to TikTok, we do not read your videos, likes, followers, or messages, and we do not use TikTok data for advertising or sell it.',
         'We keep this TikTok information while your Moodeng account is active. You can remove Moodeng\'s access at any time in the TikTok app (Settings and privacy > Security and permissions > Apps and services permissions). To delete the TikTok information we hold, delete your Moodeng account or email support@moodeng.app; we delete it within 30 days.'
      ]
   },
   {
      title: 'Identity verification',
      paragraphs: [
         'Before you can borrow or lend, we verify your identity through our identity verification provider. They collect your government ID, a selfie and liveness video, and may check your face against your ID and against fraud and sanctions lists. We receive the verification result, your name, date of birth, ID details, and ID and selfie images. We use biometric checks only to confirm that you are who you say you are and to prevent duplicate or fraudulent accounts.'
      ]
   },
   {
      title: 'Wallet and transaction information',
      paragraphs: [
         'We create or connect a wallet for your account and record your wallet address, loan amounts, due dates, repayments, extensions, deposits, and withdrawals. We use this to run your loans and to build your Moodeng repayment history.'
      ]
   },
   {
      title: 'Information collected automatically',
      bullets: [
         'Device and log information: IP address, browser and device type, operating system, app version, and pages or screens you visit.',
         'Approximate location: the country and city we infer from your IP address, used to check where the Service is available and to prevent fraud. We do not collect precise GPS location.',
         'How you found us: referral codes and the link, post, or ad that brought you to Moodeng.',
         'Cookies and similar technology: used to keep you signed in, remember your settings, and measure how the Service is used through our analytics provider. You can block cookies in your browser, but some parts of the Service may stop working.'
      ]
   },
   {
      title: 'How we use information',
      bullets: [
         'to create and secure your account and let you sign in',
         'to verify your identity and prevent fraud, duplicate accounts, and money laundering',
         'to review loan requests, set credit limits, and show moo-lenders relevant borrower information',
         'to send loans, process repayments, and send due-date reminders and account notices through email, SMS, push notifications, Messenger, Telegram, or WhatsApp',
         'to run lessons, quizzes, prizes, and referral programs',
         'to answer support requests',
         'to understand how the Service is used and improve it',
         'to meet legal, tax, and regulatory obligations and to enforce our Terms of Service'
      ],
      after: [
         'Where the law requires a legal basis, we rely on: performing our contract with you, our legitimate interests in running a safe service, your consent (for example, for optional messaging channels or call recordings), and complying with the law. You can withdraw consent at any time; this does not affect what we did before.'
      ]
   },
   {
      title: 'Credit decisions and automated tools',
      paragraphs: [
         'We use your application details, verification results, and repayment history, together with automated risk scores and AI tools, to help review loan requests and set credit limits. A member of our team reviews account approvals. If you disagree with a decision about you, contact support@moodeng.app and ask for a person to review it.'
      ]
   },
   {
      title: 'How we share information',
      paragraphs: ['We do not sell your personal information, and we do not share it for third-party advertising. We share it only as follows:'],
      bullets: [
         'Moo-lenders: when you request a loan, moo-lenders can see your display name, profile, loan request, and Moodeng repayment history. They do not see your ID documents or contact details.',
         'Service providers who work for us under contract, including cloud hosting and database providers, our wallet provider, identity verification and anti-fraud providers, payment, on-ramp, and exchange partners, analytics, email and SMS providers, messaging platforms (such as Meta Messenger, WhatsApp, and Telegram), video call and scheduling tools, and AI service providers. They may use the information only to provide their service to us.',
         'Sign-in providers, only to complete a sign-in you start.',
         'Authorities, when the law requires it or to protect the safety and rights of our users, the public, or Moodeng.',
         'A buyer or successor, if Moodeng is involved in a merger, sale, or reorganisation, under this policy.'
      ],
      after: [
         'We never contact the people in your phone contacts and we never post about your debts publicly.'
      ]
   },
   {
      title: 'Blockchain records',
      paragraphs: [
         'Loans and repayments happen on public blockchain networks. Wallet addresses and transactions are public by nature, can be seen by anyone, and generally cannot be changed or deleted, even if you delete your Moodeng account. We do not publish your name or contact details on the blockchain.'
      ]
   },
   {
      title: 'How long we keep information',
      bullets: [
         'Account and profile information: while your account is open.',
         'Loan, payment, and identity verification records: up to 5 years after your account closes, or longer if the law requires, for legal, tax, anti-money-laundering, and dispute purposes.',
         'Sign-in provider information (including TikTok): deleted within 30 days after you delete your account.',
         'Analytics and logs: usually up to 2 years.'
      ]
   },
   {
      title: 'How we protect information',
      paragraphs: [
         'We use encryption in transit and at rest, access controls so only team members who need information can see it, multi-factor authentication for admin access, and security monitoring. No system is perfectly secure, so please keep your sign-in methods and wallet safe, and tell us at once if you notice anything unusual.'
      ]
   },
   {
      title: 'Your rights and choices',
      paragraphs: ['Depending on where you live, you may have the right to:'],
      bullets: [
         'access the personal information we hold about you and get a copy',
         'correct information that is wrong or incomplete',
         'delete your information, subject to the records we must keep by law',
         'object to or restrict some uses of your information',
         'receive your information in a portable format',
         'withdraw consent and turn off optional messages',
         'ask for a person to review an automated decision'
      ],
      after: [
         'To use these rights, email support@moodeng.app from the email on your account, or message us in the app. We will reply within 30 days and may need to verify your identity first. If you live in the Philippines, you have rights under the Data Privacy Act of 2012 and may complain to the National Privacy Commission. If you live elsewhere, you may complain to your local data protection authority. We would appreciate the chance to fix the problem first.'
      ]
   },
   {
      title: 'Deleting your account',
      paragraphs: [
         'You can ask us to delete your account at any time by emailing support@moodeng.app or messaging us in the chat on moodeng.app. We will delete or anonymise your personal information within 30 days, except records we must keep by law and information already recorded on a public blockchain. If you still owe money on a loan, we keep the information needed to collect it.'
      ]
   },
   {
      title: 'International transfers',
      paragraphs: [
         'We are based in the United States and our service providers operate in several countries. Your information may be stored and processed outside your country, including in the United States. When we transfer information, we use contracts and safeguards to protect it as required by law.'
      ]
   },
   {
      title: 'Children',
      paragraphs: [
         'Moodeng accounts are only for people aged 18 or older. We do not knowingly collect personal information from anyone under 18. If you believe a child has given us information, contact support@moodeng.app and we will delete it.'
      ]
   },
   {
      title: 'Changes to this policy',
      paragraphs: [
         'We may update this Privacy Policy. We will change the "Last updated" date above, and for important changes we will tell you in the app or by message before they take effect.'
      ]
   },
   {
      title: 'Contact us',
      paragraphs: [
         'Building Credit Asia LLC (Moodeng Credit). Email: support@moodeng.app. You can also reach us through the chat on moodeng.app.'
      ]
   }
];
