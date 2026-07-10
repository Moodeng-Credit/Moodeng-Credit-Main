import { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { getRelayLoans } from '@/lib/loanNotes/api';
import { getLoanManagerService } from '@/lib/web3/loanManager';
import type { RelayLoan } from '@/lib/loanNotes/types';

const usd = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const shareUrl = (loanId: string) => {
   const origin = typeof window !== 'undefined' ? window.location.origin : '';
   return `${origin}/lend/loan/${loanId}`;
};

const statusTone: Record<RelayLoan['status'], string> = {
   Listed: 'border-emerald-900 bg-emerald-950/60 text-emerald-300',
   Sold: 'border-blue-900 bg-blue-950/60 text-blue-300',
   Repaid: 'border-[#3d1f6e] bg-[#241044] text-[#a89bb8]',
   Defaulted: 'border-red-900 bg-red-950/60 text-red-300'
};

// Node palette for the inline diagrams (dark admin theme). Categories:
// money = emerald (Moodeng's capital), contract = purple, people = pink, admin UI = neutral.
const NODE = {
   money: { stroke: '#10b981', title: '#a7f3d0' },
   contract: { stroke: '#8336f0', title: '#ddc9ff' },
   people: { stroke: '#f472b6', title: '#fbcfe8' },
   neutral: { stroke: '#5b4580', title: '#e9e2f7' }
} as const;

type NodeKind = keyof typeof NODE;

const DiagramNode = ({ x, y, w, kind, title, subtitle }: { x: number; y: number; w: number; kind: NodeKind; title: string; subtitle: string }) => (
   <g>
      <rect x={x} y={y} width={w} height={52} rx={10} fill="#241044" stroke={NODE[kind].stroke} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + 21} textAnchor="middle" fill={NODE[kind].title} fontSize={15} fontWeight={700}>
         {title}
      </text>
      <text x={x + w / 2} y={y + 40} textAnchor="middle" fill="#a89bb8" fontSize={12}>
         {subtitle}
      </text>
   </g>
);

const DiagramArrow = ({ x, y1, y2, markerId }: { x: number; y1: number; y2: number; markerId: string }) => (
   <line x1={x} y1={y1} x2={x} y2={y2} stroke="#6b5b8a" strokeWidth={1.5} markerEnd={`url(#${markerId})`} />
);

const ArrowMarker = ({ id }: { id: string }) => (
   <defs>
      <marker id={id} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
         <path d="M0,0 L8,4 L0,8 z" fill="#6b5b8a" />
      </marker>
   </defs>
);

/** The relay cycle: fund → mint → share link → lender buys → capital returns. */
const RelayCycleDiagram = () => (
   <svg
      viewBox="0 0 340 428"
      role="img"
      aria-label="The relay cycle: you fund a loan through the smart contract, share the link from this tab, a lender buys the Loan Note, and the USDC returns to Moodeng."
      className="w-full"
   >
      <ArrowMarker id="relay-arr" />
      <DiagramNode x={40} y={8} w={260} kind="money" title="You fund the loan" subtitle="Send Your Help → Smart Contract Lend" />
      <DiagramArrow x={170} y1={62} y2={94} markerId="relay-arr" />
      <DiagramNode x={40} y={98} w={260} kind="contract" title="LoanManager contract" subtitle="Pays the borrower, mints a Loan Note" />
      <DiagramArrow x={170} y1={152} y2={184} markerId="relay-arr" />
      <DiagramNode x={40} y={188} w={260} kind="neutral" title="This tab" subtitle="Copy the loan's share link below" />
      <DiagramArrow x={170} y1={242} y2={274} markerId="relay-arr" />
      <DiagramNode x={40} y={278} w={260} kind="people" title="A lender opens your link" subtitle="Buys the Note at the principal" />
      <DiagramArrow x={170} y1={332} y2={364} markerId="relay-arr" />
      <DiagramNode x={40} y={368} w={260} kind="money" title="USDC returns to Moodeng" subtitle="Ready to fund the next loan ↻" />
   </svg>
);

/** Hold-and-release: borrower repays → contract accumulates → note owner paid at the end. */
const RepaymentFlowDiagram = () => (
   <svg
      viewBox="0 0 340 248"
      role="img"
      aria-label="How repayments flow: the borrower repays as usual, the contract holds each repayment, and the Note owner receives the full amount at payoff or the due date."
      className="w-full"
   >
      <ArrowMarker id="repay-arr" />
      <DiagramNode x={40} y={8} w={260} kind="people" title="Borrower repays as usual" subtitle="Their flow doesn't change at all" />
      <DiagramArrow x={170} y1={62} y2={94} markerId="repay-arr" />
      <DiagramNode x={40} y={98} w={260} kind="contract" title="Contract holds each repayment" subtitle="Accumulates until the end" />
      <DiagramArrow x={170} y1={152} y2={184} markerId="repay-arr" />
      <DiagramNode x={40} y={188} w={260} kind="money" title="Note owner gets the full pot" subtitle="At payoff or on the due date" />
   </svg>
);

const HOW_IT_WORKS_STEPS: Array<{ title: string; detail: string }> = [
   {
      title: 'Fund a request with the smart contract',
      detail: 'Open a borrower’s request from the board and tap “Send Your Help”. As a funding admin you get two choices — pick “Smart Contract Lend”. Moodeng’s USDC goes to the borrower and a sellable Loan Note is created.'
   },
   {
      title: 'Come back here and copy the link',
      detail: 'The loan appears on this page with a “Copy link” button (and “Copy message” for a ready-to-paste blurb). The link is the whole marketplace — there’s nothing else to set up.'
   },
   {
      title: 'Send the link to a lender',
      detail: 'Chat, Telegram, anywhere. They open it, see the loan (no personal borrower details), sign in, connect a wallet, and buy the Note for the principal amount.'
   },
   {
      title: 'Moodeng’s money comes back',
      detail: 'Their payment refills what Moodeng fronted, so the same capital can fund the next borrower. The buyer becomes the loan’s lender in the app and earns the interest.'
   },
   {
      title: 'Repayments release automatically',
      detail: 'The borrower repays exactly as before. Repayments accumulate in the contract and release to the Note owner in one go — on full payoff or on the due date. No claiming, no manual payouts.'
   }
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
   {
      q: 'Who can see this tab?',
      a: 'Only the funding admins (George and Emma). Borrowers and regular lenders never see it — they only ever see the purchase page behind the link you share.'
   },
   {
      q: 'What does the buyer pay, and what do they get?',
      a: 'They pay the principal (what Moodeng fronted) and collect the borrower’s full repayment at the end. Their profit is the interest — shown as “Lender upside” on each loan card.'
   },
   {
      q: 'Does the borrower notice anything?',
      a: 'No. They received their loan and repay exactly as always. Who holds the Loan Note is invisible to them.'
   },
   {
      q: 'What happens once someone buys a Note?',
      a: 'The card flips to “Sold” and its copy buttons disable, so a Note can’t be sold twice. The buyer becomes the lender in the app and can track the loan under “My Funded Loans”.'
   },
   {
      q: 'What if nobody buys the link?',
      a: 'Nothing breaks. Moodeng simply stays the lender: repayments accumulate in the contract and release back to Moodeng at the end.'
   },
   {
      q: 'Is real money moving on-chain right now?',
      a: 'Not yet — the app runs in mock mode: the full flow works and purchases are recorded, but no real USDC or on-chain Note moves. The smart contract is already deployed on Base, so going live is a config flip.'
   }
];

/**
 * Admin "Liquidity Relay" panel (George/Emma only). Lists smart-contract-funded loans and
 * provides a copyable lender funding link for each, plus a ready-to-paste share message.
 * Also carries the how-it-works guide + FAQ so the tab explains itself when empty.
 * Read-only — sharing a link kicks off the lender purchase flow at /lend/loan/:loanId.
 */
export default function RelayLinksSection() {
   const { data: loans, isLoading, refetch, isRefetching } = useQuery<RelayLoan[]>({
      queryKey: ['admin-relay-loans'],
      queryFn: getRelayLoans
   });
   const queryClient = useQueryClient();
   const { showToast } = useToast();
   const [copiedId, setCopiedId] = useState<string | null>(null);
   const [releasingId, setReleasingId] = useState<string | null>(null);

   const release = async (loan: RelayLoan) => {
      if (!loan.onchainLoanId) return;
      setReleasingId(loan.loanId);
      try {
         await getLoanManagerService().settle(loan.onchainLoanId);
         showToast(TOAST_TYPES.SUCCESS, 'Released', `Released held repayments for ${loan.borrowerDisplayName} to the lender.`);
         queryClient.invalidateQueries({ queryKey: ['admin-relay-loans'] });
      } catch (err) {
         showToast(TOAST_TYPES.ERROR, 'Release failed', (err as Error).message || 'Could not release held repayments.');
      } finally {
         setReleasingId(null);
      }
   };

   const copy = async (loan: RelayLoan, withMessage: boolean) => {
      const link = shareUrl(loan.loanId);
      const text = withMessage ? `Help fund ${loan.borrowerDisplayName}'s loan on Moodeng: ${link}` : link;
      try {
         await navigator.clipboard.writeText(text);
         setCopiedId(`${loan.loanId}:${withMessage ? 'msg' : 'link'}`);
         setTimeout(() => setCopiedId(null), 1500);
      } catch {
         /* clipboard unavailable */
      }
   };

   return (
      <section className="space-y-6">
         <div className="flex items-start justify-between gap-4">
            <div>
               <h2 className="break-words text-4xl font-black sm:text-5xl">Liquidity Relay</h2>
               <p className="mt-3 text-2xl text-[#a89bb8]">
                  Loans Moodeng fronted via the smart contract. Share a funding link with a lender — they buy the Loan Note, refilling
                  Moodeng&rsquo;s capital. Borrower repayments then go to the lender.
               </p>
            </div>
            <button
               type="button"
               onClick={() => refetch()}
               className="shrink-0 rounded-2xl border border-[#3d1f6e] bg-[#241044] px-5 py-3 text-lg font-black text-white"
            >
               {isRefetching ? 'Refreshing…' : 'Refresh'}
            </button>
         </div>

         {isLoading ? (
            <p className="text-xl text-[#a89bb8]">Loading…</p>
         ) : !loans || loans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#3d1f6e] p-10 text-center text-xl text-[#a89bb8]">
               Empty for now — no smart-contract-funded loans yet. Fund a borrower with “Smart Contract Lend” from the request board
               and it appears here with a shareable link. The guide below explains the whole flow.
            </div>
         ) : (
            <div className="grid gap-4">
               {loans.map((loan) => {
                  const link = shareUrl(loan.loanId);
                  return (
                     <div key={loan.loanId} className="rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                           <div>
                              <div className="flex items-center gap-2">
                                 <strong className="text-2xl text-white">{loan.borrowerDisplayName}</strong>
                                 <span className={`rounded-full border px-3 py-1 text-sm font-bold ${statusTone[loan.status]}`}>{loan.status}</span>
                              </div>
                              {loan.borrowerUsername ? <p className="text-lg text-[#a89bb8]">@{loan.borrowerUsername}</p> : null}
                              {loan.onchainLoanId ? <p className="text-base text-[#7d6f95]">Loan Note #{loan.onchainLoanId}</p> : null}
                           </div>
                           <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-lg">
                              <dt className="text-[#a89bb8]">Principal</dt>
                              <dd className="font-bold text-white">${usd(loan.principal)}</dd>
                              <dt className="text-[#a89bb8]">Lender pays</dt>
                              <dd className="font-bold text-white">${usd(loan.salePrice)}</dd>
                              <dt className="text-[#a89bb8]">Borrower owes</dt>
                              <dd className="font-bold text-white">${usd(loan.totalOwed)}</dd>
                              <dt className="text-[#a89bb8]">Lender upside</dt>
                              <dd className="font-bold text-emerald-400">${usd(loan.lenderUpside)}</dd>
                              <dt className="text-[#a89bb8]">Held in contract</dt>
                              <dd className="font-bold text-white">${usd(loan.heldInContract)}</dd>
                           </dl>
                        </div>

                        {loan.heldInContract > 0 ? (
                           <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#241044] px-4 py-3">
                              <span className="text-base text-[#a89bb8]">
                                 ${usd(loan.heldInContract)} repaid is held in the contract. It releases to the lender automatically on full
                                 payoff, or on the due date.
                              </span>
                              <button
                                 type="button"
                                 onClick={() => release(loan)}
                                 disabled={!loan.canRelease || releasingId === loan.loanId}
                                 title={loan.canRelease ? 'Release held repayments to the lender' : 'Can release on or after the due date'}
                                 className="rounded-xl bg-[#8336f0] px-5 py-3 text-base font-black text-white hover:brightness-110 disabled:opacity-40"
                              >
                                 {releasingId === loan.loanId ? 'Releasing…' : loan.canRelease ? 'Release to lender' : 'Release on due date'}
                              </button>
                           </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                           <code className="flex-1 truncate rounded-xl bg-[#241044] px-4 py-3 text-base text-purple-100" title={link}>
                              {link}
                           </code>
                           <button
                              type="button"
                              onClick={() => copy(loan, false)}
                              disabled={loan.status !== 'Listed'}
                              className="rounded-xl bg-[#0052FF] px-5 py-3 text-base font-black text-white hover:bg-[#0041cc] disabled:opacity-40"
                           >
                              {copiedId === `${loan.loanId}:link` ? 'Copied!' : 'Copy link'}
                           </button>
                           <button
                              type="button"
                              onClick={() => copy(loan, true)}
                              disabled={loan.status !== 'Listed'}
                              className="rounded-xl border border-[#3d1f6e] bg-[#241044] px-5 py-3 text-base font-black text-white disabled:opacity-40"
                           >
                              {copiedId === `${loan.loanId}:msg` ? 'Copied!' : 'Copy message'}
                           </button>
                        </div>
                        {loan.status !== 'Listed' ? (
                           <p className="mt-2 text-base text-[#7d6f95]">
                              {loan.status === 'Sold'
                                 ? 'Already funded by a lender — link disabled.'
                                 : loan.status === 'Repaid'
                                   ? 'Loan fully repaid.'
                                   : 'Loan defaulted.'}
                           </p>
                        ) : null}
                     </div>
                  );
               })}
            </div>
         )}

         <div className="rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-6 sm:p-8">
            <h3 className="text-3xl font-black text-white">How it works</h3>
            <p className="mt-2 text-lg text-[#a89bb8]">
               The relay keeps Moodeng&rsquo;s capital from getting stuck in open loans: we front a loan, then sell the right to collect its
               repayments — so the same money can help the next borrower right away.
            </p>

            <div className="mt-6 grid gap-8 lg:grid-cols-2">
               <div>
                  <h4 className="mb-3 text-center text-xl font-black text-white">The relay cycle</h4>
                  <RelayCycleDiagram />
               </div>
               <div>
                  <h4 className="mb-3 text-center text-xl font-black text-white">How repayments flow</h4>
                  <RepaymentFlowDiagram />
                  <p className="mt-4 rounded-xl bg-[#241044] p-4 text-base text-[#a89bb8]">
                     The Loan Note is the key piece: a transferable token that means &ldquo;whoever holds this collects the repayments&rdquo;.
                     We list it at the loan&rsquo;s principal, so the buyer&rsquo;s profit is the interest — and the borrower notices nothing.
                  </p>
               </div>
            </div>

            <ol className="mt-8 space-y-4">
               {HOW_IT_WORKS_STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                     <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#8336f0] text-lg font-black text-white">
                        {i + 1}
                     </span>
                     <div>
                        <strong className="block text-xl text-white">{step.title}</strong>
                        <p className="mt-1 text-lg text-[#a89bb8]">{step.detail}</p>
                     </div>
                  </li>
               ))}
            </ol>
         </div>

         <div className="rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-6 sm:p-8">
            <h3 className="text-3xl font-black text-white">FAQ</h3>
            <div className="mt-4 divide-y divide-[#2a1453]">
               {FAQ_ITEMS.map((item) => (
                  <details key={item.q} className="group py-4">
                     <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xl font-black text-white [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <span aria-hidden="true" className="text-2xl text-[#8336f0] transition-transform group-open:rotate-45">
                           +
                        </span>
                     </summary>
                     <p className="mt-3 text-lg text-[#a89bb8]">{item.a}</p>
                  </details>
               ))}
            </div>
         </div>
      </section>
   );
}
