// What a borrower can send as proof of income, by how they earn. /documents asks "How do you earn?"
// first, then shows only the documents that fit, each with a drawn example of a good one.
// The reader (supabase/functions/_shared/incomeDocs.ts) knows the same document types.

export type EarnId = 'job' | 'rider' | 'seller' | 'store' | 'freelance' | 'family' | 'other';

/** A drawn example: what a good one shows, and the common wrong one. Sample data only. */
export type DocExampleSpec = {
   /** The screen or paper's heading, e.g. "Payslip" or "Weekly earnings". */
   header: string;
   rows: Array<{ date: string; label: string; amount: string }>;
   wrong: { big: string; small: string; caption: string };
};

export type DocKind = {
   id: string;
   emoji: string;
   title: string;
   /** Where it comes from, in a few words. */
   hint: string;
   /** What to send when one recent document is enough. */
   askRecent: string;
   /** What to send when the loan needs months of history; null = this one can't show months. */
   askMonths: string | null;
   example: DocExampleSpec;
   /** The three things that must show, when they differ from name / dates / money in. */
   mustShow?: string[];
};

export type EarnType = { id: EarnId; emoji: string; label: string; kinds: DocKind[] };

const BALANCE_ONLY = { big: '₱1,250.00', small: 'Available balance', caption: 'Not only your balance' };
const CROPPED = { big: '…₱8,4', small: 'Cut off', caption: 'Not cropped or blurry' };

const walletHistory = (hint: string): DocKind => ({
   id: 'wallet_history',
   emoji: '📱',
   title: 'GCash or Maya history',
   hint,
   askRecent: 'Screenshots of your recent transaction history.',
   askMonths: 'Screenshots of your last 2–3 months of transaction history.',
   example: {
      header: 'Transaction history',
      rows: [
         { date: 'Oct 15', label: 'Received', amount: '+₱9,000' },
         { date: 'Sep 30', label: 'Received', amount: '+₱9,000' },
         { date: 'Sep 15', label: 'Received', amount: '+₱9,000' }
      ],
      wrong: BALANCE_ONLY
   }
});

export const EARN_TYPES: EarnType[] = [
   {
      id: 'job',
      emoji: '💼',
      label: 'I have a job',
      kinds: [
         {
            id: 'payslip',
            emoji: '🧾',
            title: 'Payslip',
            hint: 'From your employer',
            askRecent: 'A photo or screenshot of your latest payslip.',
            askMonths: 'Your last 2–3 payslips.',
            example: {
               header: 'Payslip',
               rows: [
                  { date: 'Oct 1–15', label: 'Gross pay', amount: '₱10,500' },
                  { date: '', label: 'Deductions', amount: '−₱1,200' },
                  { date: '', label: 'Net pay', amount: '₱9,300' }
               ],
               wrong: CROPPED
            }
         },
         {
            id: 'sss',
            emoji: '🏛️',
            title: 'SSS contributions',
            hint: 'Screenshot from the My.SSS app',
            askRecent: 'A screenshot of your contributions list in the My.SSS app.',
            askMonths: 'A screenshot of your contributions list showing the last 3 months.',
            example: {
               header: 'Contributions · Employer: ACME Trading',
               rows: [
                  { date: 'Oct 2026', label: 'Posted', amount: '₱900' },
                  { date: 'Sep 2026', label: 'Posted', amount: '₱900' },
                  { date: 'Aug 2026', label: 'Posted', amount: '₱900' }
               ],
               wrong: CROPPED
            }
         },
         walletHistory('Showing your salary coming in')
      ]
   },
   {
      id: 'rider',
      emoji: '🛵',
      label: 'I drive or deliver',
      kinds: [
         {
            id: 'gig_earnings',
            emoji: '🛵',
            title: 'Earnings screen',
            hint: 'Grab, Lalamove, foodpanda, Angkas',
            askRecent: 'A screenshot of your earnings in the app, last 4 weeks.',
            askMonths: 'Screenshots of your earnings in the app, last 8 weeks or more.',
            example: {
               header: 'Weekly earnings',
               rows: [
                  { date: 'Oct 20–26', label: '62 trips', amount: '₱5,480' },
                  { date: 'Oct 13–19', label: '58 trips', amount: '₱5,120' },
                  { date: 'Oct 6–12', label: '65 trips', amount: '₱5,760' }
               ],
               wrong: { big: '₱860', small: 'Today', caption: 'Not only one day' }
            }
         },
         walletHistory('Showing your payouts coming in')
      ]
   },
   {
      id: 'seller',
      emoji: '🛍️',
      label: 'I sell online',
      kinds: [
         {
            id: 'seller_payout',
            emoji: '🛍️',
            title: 'Shop income screen',
            hint: 'Shopee, Lazada, TikTok Shop',
            askRecent: 'A screenshot of “My Income” or payouts in your seller app.',
            askMonths: 'Screenshots of “My Income” or payouts for the last 2–3 months.',
            example: {
               header: 'My income · Released',
               rows: [
                  { date: 'Oct 21', label: 'Payout', amount: '₱3,240' },
                  { date: 'Oct 14', label: 'Payout', amount: '₱2,980' },
                  { date: 'Oct 7', label: 'Payout', amount: '₱3,410' }
               ],
               wrong: { big: '128', small: 'Orders', caption: 'Not only orders or likes' }
            }
         },
         walletHistory('Showing your sales coming in')
      ]
   },
   {
      id: 'store',
      emoji: '🏪',
      label: 'I run a store or business',
      kinds: [
         walletHistory('Showing customers paying you'),
         {
            id: 'business_permit',
            emoji: '📜',
            title: 'Business permit',
            hint: 'Barangay or DTI',
            askRecent: 'A clear photo of your barangay or DTI permit, all 4 corners showing.',
            askMonths: null,
            mustShow: ['Your name', 'This year', 'All 4 corners'],
            example: {
               header: 'Business permit',
               rows: [
                  { date: 'Valid 2026', label: 'Business name', amount: '' },
                  { date: '', label: 'Owner', amount: '' },
                  { date: '', label: 'Permit no.', amount: '' }
               ],
               wrong: CROPPED
            }
         }
      ]
   },
   {
      id: 'freelance',
      emoji: '💻',
      label: 'I freelance online',
      kinds: [
         {
            id: 'freelance_earnings',
            emoji: '💻',
            title: 'Earnings screen',
            hint: 'Upwork, OnlineJobs',
            askRecent: 'A screenshot of your earnings or payments received.',
            askMonths: 'Screenshots of your earnings for the last 2–3 months.',
            example: {
               header: 'Earnings',
               rows: [
                  { date: 'Oct 28', label: 'Client payment', amount: '+$180' },
                  { date: 'Oct 14', label: 'Client payment', amount: '+$180' },
                  { date: 'Sep 30', label: 'Client payment', amount: '+$200' }
               ],
               wrong: { big: '★ 4.9', small: 'Profile', caption: 'Not only your profile' }
            }
         },
         {
            id: 'payout_history',
            emoji: '💸',
            title: 'PayPal, Wise or Payoneer',
            hint: 'Your payment history',
            askRecent: 'Screenshots of the payments you received recently.',
            askMonths: 'Screenshots of the payments you received in the last 2–3 months.',
            example: {
               header: 'Activity',
               rows: [
                  { date: 'Oct 28', label: 'Payment from client', amount: '+$180' },
                  { date: 'Oct 14', label: 'Payment from client', amount: '+$180' },
                  { date: 'Sep 30', label: 'Payment from client', amount: '+$200' }
               ],
               wrong: { big: '$42.10', small: 'Balance', caption: 'Not only your balance' }
            }
         }
      ]
   },
   {
      id: 'family',
      emoji: '💌',
      label: 'Family sends me money',
      kinds: [
         {
            id: 'remittance',
            emoji: '💌',
            title: 'Remittance receipts',
            hint: 'Palawan, Cebuana, Western Union, GCash Remit',
            askRecent: 'Your latest receipt or claim slip.',
            askMonths: 'Your last 2–3 receipts, one for each month.',
            example: {
               header: 'Remittance receipt',
               rows: [
                  { date: 'Oct 5', label: 'Amount received', amount: '₱8,000' },
                  { date: '', label: 'Sender', amount: 'M. Dela Cruz' },
                  { date: '', label: 'Reference no.', amount: '•••• 4821' }
               ],
               wrong: CROPPED
            }
         },
         walletHistory('Showing the money arriving')
      ]
   },
   {
      id: 'other',
      emoji: '✨',
      label: 'Something else',
      kinds: [
         walletHistory('Showing money coming in'),
         {
            id: 'bank_statement',
            emoji: '🏦',
            title: 'Bank statement',
            hint: 'From your bank app or branch',
            askRecent: 'Your latest statement, or screenshots from your bank app.',
            askMonths: 'Statements or screenshots for the last 2–3 months.',
            example: {
               header: 'Account statement',
               rows: [
                  { date: 'Oct 15', label: 'Deposit', amount: '+₱9,000' },
                  { date: 'Sep 30', label: 'Deposit', amount: '+₱9,000' },
                  { date: 'Sep 15', label: 'Deposit', amount: '+₱9,000' }
               ],
               wrong: BALANCE_ONLY
            }
         }
      ]
   }
];

/** The documents that fit this way of earning; ones that can't show months are left out when months are needed. Pure. */
export const kindsFor = (earn: EarnType, monthsNeeded: number) => earn.kinds.filter((k) => monthsNeeded <= 0 || k.askMonths != null);

/** What to send for this document at this step. Pure. */
export const askFor = (kind: DocKind, monthsNeeded: number) => (monthsNeeded > 0 && kind.askMonths ? kind.askMonths : kind.askRecent);

/** The note the team sees with the send: how they earn, what they picked, then their own words. Pure. */
export const sendNote = (earn: EarnType, kind: DocKind, typed: string, max = 300) =>
   [`${earn.label} · ${kind.title}`, typed.trim()].filter(Boolean).join(' — ').slice(0, max);

export const EXAMPLE_MUST_SHOW = ['Your name', 'The dates', 'The money coming in'];

/** A photo this small can't be read (a thumbnail or a forwarded preview, not the real screenshot). Pure. */
export const MIN_READABLE_PX = 480;
export const tooSmallToRead = (width: number, height: number) => width > 0 && height > 0 && Math.min(width, height) < MIN_READABLE_PX;

/** Empty boxes to fill: three when the loan needs months of history, one otherwise. Pure. */
export const slotCount = (monthsNeeded: number) => (monthsNeeded > 0 ? 3 : 1);

/**
 * The nudge under the boxes, or null: months are needed and what's added so far (screenshots, no PDF)
 * is unlikely to cover them. Never blocks sending. Pure.
 */
export const moreNeededHint = (monthsNeeded: number, files: Array<{ isPdf: boolean }>) =>
   monthsNeeded > 0 && files.length > 0 && files.length < 2 && !files.some((f) => f.isPdf)
      ? `Add more screenshots until ${monthsNeeded} months show.`
      : null;
