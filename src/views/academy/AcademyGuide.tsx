import { type CSSProperties, type JSX, type MouseEvent, useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { usePageSeo } from '@/hooks/usePageSeo';
import { ACADEMY_QUIZ_POINTS_PER_CORRECT_ANSWER, computeAcademyQuizPoints } from '@/shared/points';
import '@/views/academy/AcademyGuide.css';

type AcademyStep = {
   eyebrow: string;
   title: string;
   body: string;
   action: string;
   screen: 'signup' | 'wallet' | 'verify' | 'choose' | 'request' | 'board' | 'repay' | 'grow';
   id: string;
};

type QuizRole = 'borrower' | 'lender';
type QuizStatus = 'start' | 'playing' | 'score';

type QuizQuestion = {
   id: string;
   question: string;
   options: string[];
   answer: string;
};

type MechaMessage = {
   title: string;
   body: string;
};

const quizSecondsPerQuestion = 12;
const tutorialVideoEmbedUrl = 'https://www.youtube.com/embed/fKpBC9zD6Hk';
const quizPassingScore = 4;
const baseWalletOnboardingPath = '/onboarding/wallet?returnTo=academy';
const worldIdOrbUrl = 'https://world.org/find-orb';

const steps: AcademyStep[] = [
   {
      id: 'signup',
      eyebrow: 'Step 1',
      title: 'Create your account',
      body: 'Sign up with email so Moodeng can save your borrower profile, loans, repayments, and credit progress.',
      action: 'Create account',
      screen: 'signup'
   },
   {
      id: 'verify',
      eyebrow: 'Step 2',
      title: 'Verify with World ID',
      body: 'Verify once to prove you are unique. After that, lenders can trust that your request is tied to one real borrower.',
      action: 'Verify',
      screen: 'verify'
   },
   {
      id: 'wallet',
      eyebrow: 'Step 3',
      title: 'Add your Base Account',
      body: 'Create or connect your Base Account once so lenders can fund loans directly there and Moodeng can track repayment history.',
      action: 'Create or connect',
      screen: 'wallet'
   },
   {
      id: 'choose',
      eyebrow: 'Step 4',
      title: 'Your amount sets the loan type',
      body: 'If your request is below your credit limit, it is trust-building. If it is above your credit limit, it is credit-building.',
      action: 'Amount decides',
      screen: 'choose'
   },
   {
      id: 'request',
      eyebrow: 'Step 5',
      title: 'Submit a loan request',
      body: 'Pick your amount, choose when you will repay, and explain why you need support before posting to lenders.',
      action: 'Request',
      screen: 'request'
   },
   {
      id: 'board',
      eyebrow: 'Step 6',
      title: 'Get matched on the request board',
      body: 'Your request appears on the board where lenders can review the terms and decide whether to fund it.',
      action: 'Browse',
      screen: 'board'
   },
   {
      id: 'repay',
      eyebrow: 'Step 7',
      title: 'Repay clearly',
      body: 'Pay back the agreed amount on time. Moodeng tracks repayment progress clearly in your account.',
      action: 'Repay',
      screen: 'repay'
   },
   {
      id: 'grow',
      eyebrow: 'Step 8',
      title: 'Grow your next limit',
      body: 'Full-limit loans repaid on time can unlock the next level, helping you build a visible credit record.',
      action: 'Grow',
      screen: 'grow'
   }
];

const pathLinks = [
   { label: 'Sign up', stepId: 'signup' },
   { label: 'Verify', stepId: 'verify' },
   { label: 'Wallet', stepId: 'wallet' },
   { label: 'Loan amount', stepId: 'choose' },
   { label: 'Request', stepId: 'request' },
   { label: 'Repay', stepId: 'repay' },
   { label: 'Level up', stepId: 'grow' },
   { label: 'Quiz', stepId: 'quiz' }
];

const quizQuestions: QuizQuestion[] = [
   {
      id: 'verify',
      question: 'Why do borrowers verify with World ID?',
      options: ['To prove they are unique', 'To skip repayment', 'To hide from lenders'],
      answer: 'To prove they are unique'
   },
   {
      id: 'wallet',
      question: 'Why do borrowers connect a Base wallet?',
      options: ['To receive USDC loans and build onchain reputation', 'To hide repayment history', 'To skip World ID'],
      answer: 'To receive USDC loans and build onchain reputation'
   },
   {
      id: 'loan-type',
      question: 'Your credit limit is $15. What is a $10 request?',
      options: ['Trust-building', 'Credit-building', 'A lender loan'],
      answer: 'Trust-building'
   },
   {
      id: 'credit-loan',
      question: 'Your credit limit is $15. What is a $20 request?',
      options: ['Trust-building', 'Credit-building', 'Already repaid'],
      answer: 'Credit-building'
   },
   {
      id: 'repay',
      question: 'What helps a borrower build a stronger record?',
      options: ['Repaying clearly and on time', 'Changing names often', 'Ignoring the request board'],
      answer: 'Repaying clearly and on time'
   }
];

const ProgressDots = ({ active }: { active: number }): JSX.Element => {
   return (
      <div className="academy-screen__dots" aria-hidden="true">
         {[0, 1, 2].map((dot) => (
            <span key={dot} className={dot === active ? 'is-active' : undefined} />
         ))}
      </div>
   );
};

const SignupScreen = (): JSX.Element => (
   <div className="academy-screen academy-screen--signup">
      <ProgressDots active={0} />
      <div className="academy-auth-card">
         <div className="academy-screen__brand">
            <img src="/brand/moodeng-logo.png" alt="" />
            <span>Moodeng Credit</span>
         </div>
         <h3>Create your Moodeng Account</h3>
         <p>Enter the same email you will use for your borrower account.</p>
         <div className="academy-field">Email address</div>
         <div className="academy-field">Create your password</div>
         <Link className="academy-primary academy-primary--dark" to="/sign-up">
            Create An Account
         </Link>
      </div>
   </div>
);

const WalletScreen = (): JSX.Element => (
   <div className="academy-screen academy-screen--wallet">
      <ProgressDots active={2} />
      <div className="academy-wallet-card">
         <div className="academy-wallet-card__icon">
            <img src="/icons/base-account.svg" alt="" />
         </div>
         <h3>Add Your Base Account</h3>
         <p>Create one or connect the Base Account you already use. Moodeng keeps the flow inside the app.</p>
         <div className="academy-wallet-network">
            <span>Network</span>
            <strong>Base</strong>
         </div>
         <div className="academy-wallet-actions">
            <Link className="academy-primary academy-primary--dark" to={baseWalletOnboardingPath}>
               Create or Connect Base Account
            </Link>
         </div>
         <small>Gasless transactions are supported on Base.</small>
      </div>
   </div>
);

const VerifyScreen = (): JSX.Element => (
   <div className="academy-screen academy-screen--verify">
      <ProgressDots active={1} />
      <div className="academy-modal-card">
         <div className="academy-world-lockup">
            <img src="/brand/world-full-logo.svg" alt="" />
         </div>
         <h3>Verify World ID</h3>
         <p>Prove you are a real person. This is a one-time step before larger borrowing limits.</p>
         <a className="academy-primary academy-primary--dark" href={worldIdOrbUrl} target="_blank" rel="noreferrer">
            Verify with World ID
         </a>
      </div>
   </div>
);

const LoanChoiceScreen = (): JSX.Element => (
   <div className="academy-screen academy-screen--choose">
      <div className="academy-choice-header">
         <span>Available credit limit</span>
         <strong>$15</strong>
      </div>
      <div className="academy-choice-rule">
         <span>Below $15 = Trust-Building</span>
         <span>Above $15 = Credit-Building</span>
      </div>
      <div className="academy-choice-grid">
         <div className="academy-choice-card academy-choice-card--trust">
            <div className="academy-choice-card__amount">$10 request</div>
            <h3>Trust-Building Loan</h3>
            <p>Any request below your $15 credit limit becomes a trust-building loan.</p>
            <ul>
               <li>$10 is below your $15 limit</li>
               <li>Builds repayment history</li>
               <li>Does not raise Credit Level</li>
            </ul>
         </div>
         <div className="academy-choice-card academy-choice-card--credit">
            <div className="academy-choice-card__amount">$20 request</div>
            <h3>Credit-Building Loan</h3>
            <p>Any request above your $15 credit limit becomes a credit-building loan.</p>
            <ul>
               <li>$20 is above your $15 limit</li>
               <li>Can increase your next limit</li>
               <li>Best when repayment is clear</li>
            </ul>
         </div>
      </div>
   </div>
);

const RequestScreen = ({ onMechaAction }: { onMechaAction: (message: MechaMessage) => void }): JSX.Element => {
   const [amount, setAmount] = useState('15');
   const [timeline, setTimeline] = useState('2 days');
   const [payback, setPayback] = useState('17');
   const [reason, setReason] = useState('groceries before payday');

   return (
      <div className="academy-screen academy-screen--request">
         <div className="academy-request-modal">
            <div className="academy-request-header">Set Your Own Terms</div>
            <div className="academy-request-body">
               <div className="academy-limit">Your available credit limit: $15</div>
               <label className="academy-input-label">
                  <span>Borrow amount</span>
                  <input
                     value={amount}
                     onChange={(event) => setAmount(event.target.value)}
                     inputMode="decimal"
                     aria-label="Borrow amount"
                  />
               </label>
               <div className="academy-chips">
                  {['10', '15', '20', '40'].map((value) => (
                     <button
                        className={amount === value ? 'is-active' : undefined}
                        key={value}
                        type="button"
                        onClick={() => setAmount(value)}
                     >
                        ${value}
                     </button>
                  ))}
               </div>
               <label className="academy-input-label">
                  <span>Repayment timeline</span>
                  <input value={timeline} onChange={(event) => setTimeline(event.target.value)} aria-label="Repayment timeline" />
               </label>
               <label className="academy-input-label">
                  <span>Payback amount</span>
                  <input
                     value={payback}
                     onChange={(event) => setPayback(event.target.value)}
                     inputMode="decimal"
                     aria-label="Payback amount"
                  />
               </label>
               <label className="academy-input-label">
                  <span>Reason</span>
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason" rows={2} />
               </label>
               <button
                  className="academy-primary"
                  type="button"
                  onClick={() =>
                     onMechaAction({
                        title: 'Nice practice request.',
                        body: `Nice! Although you will need to verify and submit the real loan application in the app, it is great to see you try the flow. Mecha likes the practice: $${amount || '0'} for ${timeline || 'your timeline'}, with $${payback || '0'} paid back.`
                     })
                  }
               >
                  Submit Request
               </button>
            </div>
         </div>
      </div>
   );
};

const BoardScreen = (): JSX.Element => (
   <div className="academy-screen academy-screen--board">
      <div className="academy-board-top">
         <span>Verified</span>
         <strong>Microloan Request Board</strong>
      </div>
      <div className="academy-request-row">
         <img src="/hippos/welcome.png" alt="" />
         <div>
            <strong>Moodeng Cute</strong>
            <span>Needs $15 • 2 days</span>
         </div>
         <b>$18</b>
      </div>
      <div className="academy-request-row">
         <img src="/hippos/thinking.png" alt="" />
         <div>
            <strong>Moodeng's Sister</strong>
            <span>Needs money before Friday</span>
         </div>
         <b>$25</b>
      </div>
      <div className="academy-filter-row">
         <span>Verified</span>
         <span>Short term</span>
         <span>USDC</span>
      </div>
   </div>
);

const RepayScreen = ({ onMechaAction }: { onMechaAction: (message: MechaMessage) => void }): JSX.Element => (
   <div className="academy-screen academy-screen--repay">
      <h3>Loan Repayment</h3>
      <div className="academy-repay-total">$18.00</div>
      <p>$13 repaid / $18 total</p>
      <div className="academy-progress">
         <span style={{ width: '72%' }} />
      </div>
      <div className="academy-field">Repayment amount</div>
      <button
         className="academy-primary"
         type="button"
         onClick={() =>
            onMechaAction({
               title: 'Strong repayment move.',
               body: 'Nice! Repaying is super important on Moodeng. On-time repayment helps your trust record, keeps lenders confident, and can unlock better borrowing limits over time.'
            })
         }
      >
         Repay Now
      </button>
   </div>
);

const GrowScreen = ({ onMechaAction }: { onMechaAction: (message: MechaMessage) => void }): JSX.Element => (
   <div className="academy-screen academy-screen--grow">
      <h3>Borrower Insights</h3>
      <div className="academy-insight-row">
         <span>Usual loan size</span>
         <strong>$33</strong>
      </div>
      <div className="academy-insight-row">
         <span>Typical payment time</span>
         <strong>0 days</strong>
      </div>
      <div className="academy-level">
         <span>Credit Level</span>
         <b>Level 2</b>
      </div>
      <button
         className="academy-primary academy-grow-action"
         type="button"
         onClick={() =>
            onMechaAction({
               title: 'This is how you grow.',
               body: 'Mecha says: full-limit loans repaid on time are how borrowers build a stronger credit record. Keep repayment clean, and your next limit can grow.'
            })
         }
      >
         See How Growth Works
      </button>
   </div>
);

const StepScreen = ({
   screen,
   onMechaAction
}: {
   screen: AcademyStep['screen'];
   onMechaAction: (message: MechaMessage) => void;
}): JSX.Element => {
   switch (screen) {
      case 'signup':
         return <SignupScreen />;
      case 'wallet':
         return <WalletScreen />;
      case 'verify':
         return <VerifyScreen />;
      case 'choose':
         return <LoanChoiceScreen />;
      case 'request':
         return <RequestScreen onMechaAction={onMechaAction} />;
      case 'board':
         return <BoardScreen />;
      case 'repay':
         return <RepayScreen onMechaAction={onMechaAction} />;
      case 'grow':
         return <GrowScreen onMechaAction={onMechaAction} />;
      default:
         return <SignupScreen />;
   }
};

export default function AcademyGuide(): JSX.Element {
   const [readingProgress, setReadingProgress] = useState(0);
   const [quizRole, setQuizRole] = useState<QuizRole>('borrower');
   const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
   const [quizIndex, setQuizIndex] = useState(0);
   const [quizStatus, setQuizStatus] = useState<QuizStatus>('start');
   const [quizSubmitted, setQuizSubmitted] = useState(false);
   const [quizTimer, setQuizTimer] = useState(quizSecondsPerQuestion);
   const [lockedMessage, setLockedMessage] = useState('');
   const [mechaMessage, setMechaMessage] = useState<MechaMessage | null>(null);
   const [showTutorialVideo, setShowTutorialVideo] = useState(false);

   usePageSeo({
      title: 'Moodeng Academy | Moodeng Credit',
      description:
         'A step-by-step walkthrough of the Moodeng borrower flow — sign up, verify, connect a Base wallet, request a loan, repay, and grow your credit limit.',
      canonicalPath: '/academy'
   });

   const quizScore = useMemo(() => {
      return quizQuestions.reduce((score, question) => {
         return quizAnswers[question.id] === question.answer ? score + 1 : score;
      }, 0);
   }, [quizAnswers]);

   const quizPoints = computeAcademyQuizPoints(quizScore);
   const activeQuestion = quizQuestions[quizIndex];
   const activeAnswer = activeQuestion ? quizAnswers[activeQuestion.id] : '';
   const quizPassed = quizStatus === 'score' && quizScore >= quizPassingScore;
   const quizReward = 'Academy score';
   const quizClaimPath = quizRole === 'borrower' ? '/verify-world-id' : '/sign-up';
   const quizClaimLabel = quizRole === 'borrower' ? 'Verify World ID' : 'Register';

   const resetQuiz = () => {
      setQuizAnswers({});
      setQuizIndex(0);
      setQuizSubmitted(false);
      setQuizTimer(quizSecondsPerQuestion);
      setQuizStatus('playing');
   };

   const hasQuizProgress = quizStatus !== 'start' || Object.keys(quizAnswers).length > 0 || quizIndex > 0 || quizSubmitted;

   const handleQuizRoleChange = (nextRole: QuizRole) => {
      if (nextRole === quizRole) {
         return;
      }

      if (!hasQuizProgress) {
         setQuizRole(nextRole);
         return;
      }

      const shouldRestart = window.confirm('Switching reward type will restart the quiz from question 1. Continue?');

      if (!shouldRestart) {
         return;
      }

      setQuizRole(nextRole);
      resetQuiz();
   };

   const handleQuizPrimary = () => {
      if (!activeQuestion) {
         return;
      }

      if (!quizSubmitted) {
         if (!activeAnswer) {
            return;
         }

         setQuizSubmitted(true);
         return;
      }

      if (quizIndex === quizQuestions.length - 1) {
         setQuizStatus('score');
         return;
      }

      setQuizIndex((currentIndex) => Math.min(currentIndex + 1, quizQuestions.length - 1));
      setQuizSubmitted(false);
      setQuizTimer(quizSecondsPerQuestion);
   };

   useEffect(() => {
      const updateReadingProgress = () => {
         const guide = document.getElementById('academy-steps');

         if (!guide) {
            setReadingProgress(0);
            return;
         }

         const start = guide.offsetTop - window.innerHeight * 0.35;
         const end = guide.offsetTop + guide.offsetHeight - window.innerHeight * 0.7;
         const distance = Math.max(end - start, 1);
         const progress = ((window.scrollY - start) / distance) * 100;

         setReadingProgress(Math.min(100, Math.max(0, Math.round(progress))));
      };

      updateReadingProgress();
      window.addEventListener('scroll', updateReadingProgress, { passive: true });
      window.addEventListener('resize', updateReadingProgress);

      return () => {
         window.removeEventListener('scroll', updateReadingProgress);
         window.removeEventListener('resize', updateReadingProgress);
      };
   }, []);

   useEffect(() => {
      if (quizStatus !== 'playing' || quizSubmitted) {
         return undefined;
      }

      if (quizTimer <= 0) {
         setQuizSubmitted(true);
         return undefined;
      }

      const timer = window.setTimeout(() => {
         setQuizTimer((currentTimer) => Math.max(0, currentTimer - 1));
      }, 1000);

      return () => window.clearTimeout(timer);
   }, [quizStatus, quizSubmitted, quizTimer]);

   useEffect(() => {
      if (!showTutorialVideo) {
         return undefined;
      }

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') {
            setShowTutorialVideo(false);
         }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
         document.body.style.overflow = originalOverflow;
         window.removeEventListener('keydown', handleKeyDown);
      };
   }, [showTutorialVideo]);

   const progressStyle = useMemo(() => ({ '--academy-reading-progress': `${readingProgress}%` }) as CSSProperties, [readingProgress]);

   const handlePathClick = (event: MouseEvent<HTMLAnchorElement>, stepId: string) => {
      const step = document.getElementById(`academy-step-${stepId}`);

      if (!step) {
         return;
      }

      event.preventDefault();
      const targetTop = step.getBoundingClientRect().top + window.scrollY - 116;
      window.history.pushState(null, '', `#academy-step-${stepId}`);
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
   };

   const showLockedMessage = (message: string) => {
      setLockedMessage(message);
   };

   const showMechaMessage = (message: MechaMessage) => {
      setMechaMessage(message);
   };

   const scrollToAcademyStep = (stepId: string) => {
      const step = document.getElementById(`academy-step-${stepId}`);

      if (!step) {
         return;
      }

      const targetTop = step.getBoundingClientRect().top + window.scrollY - 116;
      window.history.pushState(null, '', `#academy-step-${stepId}`);
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
   };

   const renderStepAction = (step: AcademyStep) => {
      if (step.id === 'signup') {
         return (
            <Link className="academy-step__action" to="/sign-up">
               {step.action}
            </Link>
         );
      }

      if (step.id === 'verify') {
         return (
            <a className="academy-step__action" href={worldIdOrbUrl} target="_blank" rel="noreferrer">
               {step.action}
            </a>
         );
      }

      if (step.id === 'wallet') {
         return (
            <Link className="academy-step__action" to={baseWalletOnboardingPath}>
               {step.action}
            </Link>
         );
      }

      if (step.id === 'request') {
         return (
            <button className="academy-step__action" type="button" onClick={() => scrollToAcademyStep('request')}>
               {step.action}
            </button>
         );
      }

      if (step.id === 'board') {
         return (
            <button className="academy-step__action" type="button" onClick={() => scrollToAcademyStep('board')}>
               {step.action}
            </button>
         );
      }

      if (step.id === 'repay') {
         return (
            <button
               className="academy-step__action"
               type="button"
               onClick={() =>
                  showMechaMessage({
                     title: 'Strong repayment move.',
                     body: 'Nice! Repaying is super important on Moodeng. On-time repayment helps your trust record, keeps lenders confident, and can unlock better borrowing limits over time.'
                  })
               }
            >
               {step.action}
            </button>
         );
      }

      if (step.id === 'grow') {
         return (
            <button
               className="academy-step__action"
               type="button"
               onClick={() =>
                  showMechaMessage({
                     title: 'This is how you grow.',
                     body: 'Mecha says: full-limit loans repaid on time are how borrowers build a stronger credit record. Keep repayment clean, and your next limit can grow.'
                  })
               }
            >
               {step.action}
            </button>
         );
      }

      return <span>{step.action}</span>;
   };

   return (
      <main className="academy-guide">
         {lockedMessage ? (
            <div className="academy-toast" role="status" aria-live="polite">
               <span>{lockedMessage}</span>
               <button type="button" onClick={() => setLockedMessage('')} aria-label="Close message">
                  ×
               </button>
            </div>
         ) : null}
         {mechaMessage ? (
            <div className="academy-mecha-overlay" role="dialog" aria-modal="true" aria-labelledby="academy-mecha-title">
               <div className="academy-mecha-modal">
                  <img src="https://c.animaapp.com/wawSHnKX/img/screenshot-2024-09-19-at-15-51-16-removebg-preview-3.png" alt="" />
                  <div>
                     <p className="academy-mecha-modal__eyebrow">Mecha says</p>
                     <h3 id="academy-mecha-title">{mechaMessage.title}</h3>
                     <p>{mechaMessage.body}</p>
                  </div>
                  <button type="button" onClick={() => setMechaMessage(null)}>
                     Got it
                  </button>
               </div>
            </div>
         ) : null}
         <div className="academy-reading-progress" style={progressStyle} aria-label={`Guide progress ${readingProgress}%`}>
            <span>{readingProgress}%</span>
         </div>
         <section className="academy-hero">
            <div className="academy-hero__copy">
               <div className="academy-kicker">Moodeng Academy</div>
               <h1>How to use Moodeng Credit</h1>
               <p>
                  A simple walkthrough of the borrower flow. Start here if you want to know what to click, what lenders see, and how
                  repayment grows your limit.
               </p>
               <div className="academy-path" aria-label="Academy path">
                  {pathLinks.map((link) => (
                     <a href={`#academy-step-${link.stepId}`} key={link.stepId} onClick={(event) => handlePathClick(event, link.stepId)}>
                        {link.label}
                     </a>
                  ))}
               </div>
               <div className="academy-hero__actions">
                  <Link to="/request-board">See Request Board</Link>
                  {/* The Money guide had no inbound link from anywhere on the site, so
                      neither readers nor crawlers could reach it from the Academy. */}
                  <Link to="/academy/money">Money &amp; getting started</Link>
               </div>
               <button
                  type="button"
                  className="academy-video-callout"
                  id="academy-tutorial-video"
                  aria-expanded={showTutorialVideo}
                  aria-haspopup="dialog"
                  onClick={() => setShowTutorialVideo(true)}
               >
                  <div className="academy-video-callout__play" aria-hidden="true" />
                  <div>
                     <strong>Tutorial Video</strong>
                     <span>Watch the quick Moodeng walkthrough.</span>
                  </div>
               </button>
            </div>
            <div className="academy-hero__visual" aria-hidden="true">
               <div className="academy-mecha-card">
                  <div className="academy-mecha-card__bubble">I am Mecha. I will walk you through Moodeng step by step.</div>
                  <img src="https://c.animaapp.com/wawSHnKX/img/screenshot-2024-09-19-at-15-51-16-removebg-preview-3.png" alt="" />
               </div>
            </div>
         </section>

         {showTutorialVideo ? (
            <div className="academy-video-window" role="dialog" aria-modal="true" aria-labelledby="academy-video-window-title">
               <button
                  type="button"
                  className="academy-video-window__backdrop"
                  aria-label="Close tutorial video"
                  onClick={() => setShowTutorialVideo(false)}
               />
               <div className="academy-video-window__panel">
                  <div className="academy-video-window__header">
                     <div>
                        <span>Video guide</span>
                        <h2 id="academy-video-window-title">Tutorial Video</h2>
                     </div>
                     <button
                        type="button"
                        className="academy-video-window__close"
                        aria-label="Close tutorial video"
                        onClick={() => setShowTutorialVideo(false)}
                     >
                        x
                     </button>
                  </div>
                  <div className="academy-video-window__frame">
                     <iframe
                        src={tutorialVideoEmbedUrl}
                        title="Moodeng Academy tutorial video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                     />
                  </div>
                  <Link
                     to="/credit-leveling-guide"
                     className="academy-video-window__learn-more"
                     onClick={() => setShowTutorialVideo(false)}
                  >
                     Want to learn more? Open the step-by-step credit guide.
                  </Link>
               </div>
            </div>
         ) : null}

         <section id="academy-steps" className="academy-steps" aria-label="Moodeng Credit steps">
            {steps.map((step) => (
               <article className="academy-step" id={`academy-step-${step.id}`} key={step.title}>
                  <div className="academy-step__copy">
                     <div className="academy-step__eyebrow">{step.eyebrow}</div>
                     <h2>{step.title}</h2>
                     <p>{step.body}</p>
                     {renderStepAction(step)}
                  </div>
                  <div className="academy-step__screen">
                     <StepScreen screen={step.screen} onMechaAction={showMechaMessage} />
                  </div>
               </article>
            ))}
            <article className="academy-quiz" id="academy-step-quiz">
               <div className="academy-quiz__intro">
                  <div className="academy-step__eyebrow">Final quiz</div>
                  <h2>Earn your Academy reward</h2>
                  <p>
                     Finish the quick check. Score {quizPassingScore} of {quizQuestions.length} or better to pass. This is a learning score
                     today, not a live IOU or trust-points balance.
                  </p>
                  <div className="academy-role-toggle" aria-label="Choose reward type">
                     <button
                        className={quizRole === 'borrower' ? 'is-active' : undefined}
                        type="button"
                        onClick={() => handleQuizRoleChange('borrower')}
                     >
                        Borrower
                     </button>
                     <button
                        className={quizRole === 'lender' ? 'is-active' : undefined}
                        type="button"
                        onClick={() => handleQuizRoleChange('lender')}
                     >
                        Lender
                     </button>
                  </div>
                  <div className="academy-quiz__reward">
                     <span>{quizPoints} pts</span>
                     <strong>
                        {quizPassed
                           ? `Nice. You earned ${quizReward}.`
                           : quizStatus === 'score'
                             ? `Almost. Retake for ${quizReward}.`
                             : `Score ${quizPassingScore}+ to earn ${quizReward}. Each correct answer is ${ACADEMY_QUIZ_POINTS_PER_CORRECT_ANSWER} points.`}
                     </strong>
                  </div>
               </div>
               <div className="academy-quiz__questions">
                  {quizStatus === 'start' ? (
                     <div className="academy-quiz-start">
                        <span>Moodeng Academy Quiz</span>
                        <h3>Ready for the check?</h3>
                        <p>
                           Answer {quizQuestions.length} quick questions. Each correct answer earns {ACADEMY_QUIZ_POINTS_PER_CORRECT_ANSWER}{' '}
                           points toward your Academy score.
                        </p>
                        <button type="button" onClick={resetQuiz}>
                           Start quiz
                        </button>
                     </div>
                  ) : quizStatus === 'playing' && activeQuestion ? (
                     <div className="academy-quiz-card">
                        <div className="academy-quiz-card__top">
                           <span>
                              Question {quizIndex + 1} of {quizQuestions.length}
                           </span>
                           <strong>{quizTimer}s</strong>
                        </div>
                        <div className="academy-quiz-meter" aria-hidden="true">
                           <span style={{ width: `${(quizTimer / quizSecondsPerQuestion) * 100}%` }} />
                        </div>
                        <h3>{activeQuestion.question}</h3>
                        <div className="academy-quiz-options">
                           {activeQuestion.options.map((option) => (
                              <button
                                 className={[
                                    activeAnswer === option ? 'is-selected' : '',
                                    quizSubmitted && option === activeQuestion.answer ? 'is-correct' : '',
                                    quizSubmitted && activeAnswer === option && option !== activeQuestion.answer ? 'is-wrong' : ''
                                 ]
                                    .filter(Boolean)
                                    .join(' ')}
                                 key={option}
                                 type="button"
                                 disabled={quizSubmitted}
                                 onClick={() =>
                                    setQuizAnswers((currentAnswers) => ({
                                       ...currentAnswers,
                                       [activeQuestion.id]: option
                                    }))
                                 }
                              >
                                 {option}
                              </button>
                           ))}
                        </div>
                        <button
                           className="academy-quiz-next"
                           disabled={!activeAnswer && !quizSubmitted}
                           type="button"
                           onClick={handleQuizPrimary}
                        >
                           {quizSubmitted ? (quizIndex === quizQuestions.length - 1 ? 'See score' : 'Next question') : 'Submit answer'}
                        </button>
                     </div>
                  ) : (
                     <div className="academy-quiz-result">
                        <span>{quizPoints} pts</span>
                        <h3>{quizPassed ? 'Academy passed' : 'Try again'}</h3>
                        <p>
                           {quizPassed
                              ? `You scored ${quizScore} of ${quizQuestions.length}. Log in and finish the ${quizRole} flow to keep going.`
                              : `You scored ${quizScore} of ${quizQuestions.length}. Score ${quizPassingScore} of ${quizQuestions.length} to unlock ${quizReward}.`}
                        </p>
                        {quizPassed && (
                           <Link className="academy-quiz-claim" to={quizClaimPath}>
                              {quizClaimLabel}
                           </Link>
                        )}
                        <button type="button" onClick={resetQuiz}>
                           Retake quiz
                        </button>
                     </div>
                  )}
               </div>
            </article>
         </section>
      </main>
   );
}
