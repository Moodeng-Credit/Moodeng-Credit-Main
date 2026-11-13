import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { ArrowRight, Check, ChevronRight, Clock, Landmark, Loader2, QrCode, Search, Smartphone, Wallet, XCircle } from 'lucide-react';

import PoweredByStableyard from '@/components/brand/PoweredByStableyard';

import { isValidEmail } from '@/lib/accountEmail';
import { isPlaceholderEmail } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { GoldButton } from '@/views/indonesia/ui';
import { qrPayeeName } from '@/views/payQr/qrReader';
import QrCashoutSteps, { type DecodeReply, QrTrail } from '@/views/withdraw/QrCashoutSteps';

// "Straight to GCash or bank" cash-out through Stableyard (an off-ramp): the borrower picks a bank or
// e-wallet, types the account number and a peso amount, gets a USDC quote, then sends that USDC from
// their Moodeng wallet to Stableyard's escrow address, and Stableyard pays the pesos out over InstaPay.
// Everything server-side goes through stableyard-deposit-address (qr: setup / bank_list / bank_create /
// get / sent). Open to every borrower since 2026-11-07 (kill switch: bank_payout_public = 'off').
// Stableyard needs a verified email + its own KYC on the person's account before it pays out fiat.
// If Stableyard allows it and our Didit record has what payout partners need, the person can share
// their Moodeng ID check instead of doing a second one (onboarding: kyc_import, with consent).
// mode 'qr': the same flow, but the money goes to the person's own bank QR (InstaPay / QR Ph "Receive"
// QR) over Stableyard's QR rail (qr: qr_cash_decode / qr_cash_create), with the gold step-by-step
// QrCashoutSteps in place of the bank form. It works while Stableyard's bank payout provider is down.

const FN = 'stableyard-deposit-address';
const MIN_PHP = 50;
const MAX_PHP = 5000;
// Shown first in the bank list: what most borrowers use.
// The picker asks "E-wallet or bank?" first; each side lists its own popular ones before searching.
const POPULAR_WALLETS = ['GCASH', 'MAYA PHILIPPINES, INC./ MAYA WALLET', 'GRABPAY', 'SHOPEEPAY', 'DCPAY / COINS.PH', 'PALAWANPAY'];
const POPULAR_BANKS = ['GOTYME BANK', 'BDO', 'BPI', 'MARIBANK', 'UNIONDIGITAL BANK', 'METROBANK', 'LANDBANK /OFBANK', 'SECURITY BANK'];
const POPULAR = [...POPULAR_WALLETS, ...POPULAR_BANKS];
// Stableyard's list mixes wallets and banks; these names are wallets / payment apps.
const WALLET_NAME =
   /GCASH|MAYA PHILIPPINES|GRABPAY|SHOPEEPAY|COINS\.PH|PALAWANPAY|TAYOCASH|TOKTOKWALLET|STARPAY|MARCOPAY|LULU MONEY|BANANAPAY|LAZADA WALLET|OMNIPAY|PAY MONGO|SPEEDYPAY|TRAXIONPAY|JUANCASH|I-REMIT|USSC|BAYAD|NATIONLINK|PDAX/;
type PayeeKind = 'wallet' | 'bank';
const kindOf = (name: string): PayeeKind => (WALLET_NAME.test(name) ? 'wallet' : 'bank');
const DONE = new Set(['succeeded', 'completed']);
const FAILED = new Set(['failed', 'cancelled', 'expired', 'refunded', 'requires_intervention']);

type Bank = { code: string; name: string };
type DepositInstructions = { address: string; chainId: number; tokenAddress: string; decimals: number; amount: string };
type FnResult = {
   ok?: boolean;
   accountId?: string;
   code?: string | null;
   error?: string;
   emailVerified?: boolean;
   kycApproved?: boolean;
   kycStatus?: string;
   kycUrl?: string | null;
   kycEligibility?: string | null;
   reuseAvailable?: boolean;
   reuseImportStatus?: string | null;
   consentText?: string | null;
   sourceReady?: boolean;
   // bank_list: whether e-wallets are on (off since 2026-11-07, server setting bank_payout_ewallets).
   ewallets?: boolean;
   result?: {
      banks?: Bank[];
      // qr_cash_decode: who the QR pays.
      merchant?: { displayName?: string; name?: string };
      challenge?: { id?: string };
      verificationUrl?: string;
      payment?: {
         id?: string;
         status?: string;
         stage?: string;
         quoteExpiresAt?: string;
         expiresAt?: string;
         // Stableyard's price breakdown: what to send, the fees inside it, and the PHP→USD rate.
         funding?: {
            required?: { amount?: string };
            totalFees?: { amount?: string };
            exchangeRate?: { rate?: string; baseAssetCode?: string; quoteAssetCode?: string };
         } | null;
      };
      nextAction?: { type?: string; url?: string; expiresAt?: string | null; depositInstructions?: DepositInstructions } | null;
   };
};

const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const PREVIEW: Record<string, FnResult> = {
   setup: { ok: true, emailVerified: true, kycApproved: true, sourceReady: true },
   bank_list: {
      ok: true,
      result: { banks: POPULAR.map((name, i) => ({ code: `BLC_${i}`, name })).concat([{ code: 'BLC_X', name: 'METROBANK' }]) }
   },
   bank_create: {
      ok: true,
      result: {
         payment: { id: 'payment_preview', status: 'requires_action' },
         nextAction: {
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            depositInstructions: {
               address: '0x9f2e000000000000000000000000000000c41a',
               chainId: 8453,
               tokenAddress: BASE_USDC,
               decimals: 6,
               amount: '1.79'
            }
         }
      }
   },
   get: { ok: true, result: { payment: { id: 'payment_preview', status: 'succeeded' } } },
   sent: { ok: true },
   qr_cash_decode: { ok: true, result: { merchant: { name: 'JUAN DELA CRUZ' } } }
};

// A shared Moodeng ID check that Stableyard is still copying or reviewing.
const REUSE_PENDING = new Set(['sharing', 'submitting', 'imported']);
const PREVIEW_CONSENT = 'Sends your name, birthday, ID and selfie to Stableyard.';
// Stableyard KYC states where the person has nothing to do but wait (or is busy on Stableyard's page).
const KYC_WAITING = new Set(['pending', 'in_progress', 'requires_review', 'in_review']);
// While the ID is being checked, re-check setup this often, for at most this many times (~10 minutes).
const SETUP_POLL_MS = 6000;
const SETUP_POLL_MAX = 100;
let previewReviewSince = 0;

async function call(isPreview: boolean, input: Record<string, string | boolean>): Promise<FnResult> {
   let body = input;
   if (isPreview) {
      await new Promise((r) => setTimeout(r, 600));
      // ?sim=email / ?sim=verify show the one-time setup at the email / ID step; ?sim=compliance shows
      // Stableyard's one-time form after the first "Get my price".
      const sim = new URLSearchParams(window.location.search).get('sim');
      if (body.qr === 'setup' && sim === 'email') return { ok: true, emailVerified: false, kycApproved: false, kycStatus: 'not_started' };
      if (body.qr === 'setup' && sim === 'verify') return { ok: true, emailVerified: true, kycApproved: false, kycStatus: 'not_started' };
      // ?sim=reuse shows the "use your Moodeng ID check" step; ?sim=reused shows it under review.
      if (body.qr === 'setup' && sim === 'reuse')
         return {
            ok: true,
            emailVerified: true,
            kycApproved: false,
            kycStatus: 'not_started',
            reuseAvailable: true,
            consentText: PREVIEW_CONSENT
         };
      // ?sim=reused is approved ~8s after it first shows, so the auto-refresh can be seen moving on.
      if (body.qr === 'setup' && sim === 'reused') {
         previewReviewSince ||= Date.now();
         if (Date.now() - previewReviewSince > 8000) return PREVIEW.setup;
         return { ok: true, emailVerified: true, kycApproved: false, kycStatus: 'requires_review', reuseImportStatus: 'imported' };
      }
      // ?sim=personal: Stableyard won't take the QR.
      if (body.qr === 'qr_cash_decode' && sim === 'personal')
         return { ok: false, code: 'personal_qr_not_supported', error: 'Personal QR codes are not supported.' };
      if (body.qr === 'qr_cash_create') body = { ...body, qr: 'bank_create' };
      if (body.qr === 'bank_create' && sim === 'compliance') {
         return {
            ok: true,
            result: {
               payment: { id: 'payment_preview', status: 'requires_action' },
               nextAction: { type: 'complete_compliance', url: 'https://stableyard.fi' }
            }
         };
      }
      if (body.qr === 'bank_create') {
         // Priced from the typed pesos like Stableyard does (rate + ~2.2% fees), so the breakdown adds up.
         const rate = 0.01725;
         const principal = Number(body.amount ?? 0) * rate;
         const fee = Math.round(principal * 0.022 * 1e6) / 1e6;
         const required = (principal + fee).toFixed(6);
         const priced = PREVIEW.bank_create;
         return {
            ...priced,
            result: {
               ...priced.result,
               payment: {
                  ...priced.result?.payment,
                  funding: {
                     required: { amount: required },
                     totalFees: { amount: String(fee) },
                     exchangeRate: { rate: String(rate), baseAssetCode: 'PHP', quoteAssetCode: 'USD' }
                  }
               },
               nextAction: priced.result?.nextAction
                  ? {
                       ...priced.result.nextAction,
                       depositInstructions: { ...priced.result.nextAction.depositInstructions!, amount: required }
                    }
                  : null
            }
         };
      }
      return PREVIEW[body.qr ?? body.onboarding ?? ''] ?? { ok: true };
   }
   const { data, error } = await getSupabaseBrowserClient().functions.invoke(FN, { body });
   if (!error) return (data as FnResult) ?? { ok: false, error: 'No response' };
   const context = (error as { context?: { json?: () => Promise<FnResult> } }).context;
   return (await context?.json?.().catch(() => null)) ?? { ok: false, error: error.message };
}

// PH mobile numbers for e-wallets: accept +63 976…, 63976…, 976… or 0976… and keep the local 09… form.
const toLocalMobile = (digits: string) => {
   if (digits.startsWith('63')) return `0${digits.slice(2)}`.slice(0, 11);
   if (digits.startsWith('9')) return `0${digits}`.slice(0, 11);
   return digits.slice(0, 11);
};

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const normalize = (s: string) =>
   s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
// Logos for the banks most borrowers use: each bank's official app icon (PH App Store, publisher
// checked), 96px, in public/bank-logos. Keyed by Stableyard's bank name. Everything else gets initials.
const BANK_LOGOS: Record<string, string> = {
   GCASH: 'gcash',
   'MAYA PHILIPPINES, INC./ MAYA WALLET': 'maya',
   'MAYA BANK, INC.': 'maya',
   'GOTYME BANK': 'gotyme',
   BDO: 'bdo',
   BPI: 'bpi',
   GRABPAY: 'grabpay',
   MARIBANK: 'maribank',
   'UNIONDIGITAL BANK': 'uniondigital',
   METROBANK: 'metrobank',
   'LANDBANK /OFBANK': 'landbank',
   'SECURITY BANK': 'securitybank',
   'RCBC/DISKARTECH': 'rcbc',
   PNB: 'pnb',
   'TONIK BANK': 'tonik',
   'DCPAY / COINS.PH': 'coinsph',
   CHINABANK: 'chinabank',
   'UNION BANK': 'unionbank',
   'PHILIPPINE SAVINGS BANK': 'psbank',
   'EASTWEST BANK': 'eastwest',
   ALLBANK: 'allbank',
   'ASIA UNITED BANK': 'aub',
   'BANK OF COMMERCE': 'bankcom',
   'BPI GLOBE BANKO': 'banko',
   'CARD BANK INC.': 'cardbank',
   'CARD SME BANK': 'cardsme',
   'CHINA BANK SAVINGS INC.': 'cbs',
   'CIMB PHILIPPINES, INC.': 'cimb',
   'CIS BAYAD CENTER / BAYAD': 'bayad',
   'CITY SAVINGS BANK': 'citysavings',
   'CTBC BANK (PHILIPPINES) CORP.': 'ctbc',
   'EASTWEST RURAL BANK / KOMO': 'komo',
   'ISLA BANK': 'islabank',
   'LULU MONEY': 'lulu',
   MAYBANK: 'maybank',
   NETBANK: 'netbank',
   'OWN BANK': 'ownbank',
   PALAWANPAY: 'palawanpay',
   PBCOM: 'pbcom',
   'PHILIPPINE DIGITAL ASSET EXCHANGE, INC. / PDAX': 'pdax',
   PVB: 'pvb',
   STARPAY: 'starpay',
   'STERLING BANK': 'sterling',
   'TAYOCASH,INC.': 'tayocash',
   UNOBANK: 'unobank',
   MARCOPAY: 'marcopay',
   'TRAXIONPAY/DIGICOOP/COOPNET': 'traxionpay'
};
const INITIALS_SKIP = new Set(['BANK', 'INC', 'THE', 'OF', 'A', 'AND', 'CORP', 'CORPORATION', 'RURAL', 'SAVINGS']);

function BankBadge({ name, size = 28 }: { name: string; size?: number }) {
   const logo = BANK_LOGOS[name];
   if (logo)
      return (
         <img
            src={`/bank-logos/${logo}.webp`}
            alt=""
            width={size}
            height={size}
            className="shrink-0 rounded-[7px] border border-[var(--border-card)]"
            style={{ width: size, height: size }}
         />
      );
   const words = name
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((w) => w && !INITIALS_SKIP.has(w));
   const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2)).toUpperCase();
   // Same colour for the same bank every time.
   let hue = 0;
   for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
   return (
      <span
         aria-hidden="true"
         className="shrink-0 rounded-full flex items-center justify-center text-white font-bold"
         style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 45% 52%)` }}
      >
         {initials}
      </span>
   );
}

const shortBank = (name: string) => (name.startsWith('MAYA PHILIPPINES') ? 'Maya' : name === 'GCASH' ? 'GCash' : name);

// The last payout's bank + account, kept on this device only (we never store full account numbers
// server-side), keyed by the Stableyard account so another login on the same phone doesn't see it.
type SavedPayee = { bankCode: string; accountNumber: string; accountName: string };
const savedKey = (accountId: string) => `moodeng.bankPayout.last.${accountId}`;
const readSavedPayee = (accountId: string): SavedPayee | null => {
   try {
      const raw = window.localStorage.getItem(savedKey(accountId));
      const saved = raw ? (JSON.parse(raw) as Partial<SavedPayee>) : null;
      return saved?.bankCode && saved.accountNumber && saved.accountName ? (saved as SavedPayee) : null;
   } catch {
      return null;
   }
};
const writeSavedPayee = (accountId: string, payee: SavedPayee) => {
   try {
      window.localStorage.setItem(savedKey(accountId), JSON.stringify(payee));
   } catch {
      /* private mode / storage blocked: just don't remember */
   }
};

const inputClass =
   'w-full rounded-[8px] border-2 border-[#e8e4ff] bg-[var(--surface)] px-[14px] py-[12px] text-[16px] text-[var(--ink)] outline-none focus:border-[#6b55f7]';
const primaryClass =
   // Milestone design: purple gradient pill.
   'w-full rounded-[36px] px-[20px] py-[15px] flex items-center justify-center gap-[8px] text-[16px] font-semibold text-white bg-[linear-gradient(85deg,#9584ff_0%,#6b55f7_98%)] shadow-[0_6px_16px_rgba(107,85,247,0.3)] disabled:bg-none disabled:bg-[var(--disabled)] disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.98] transition-all';
const linkClass = 'w-full text-center text-[15px] font-semibold text-[#4492f1] py-[8px] hover:underline disabled:opacity-60';
function Panel({ children }: { children: React.ReactNode }) {
   return <div className="rounded-[8px] border-2 border-[#e8e4ff] bg-[var(--surface)] p-[16px] space-y-[12px]">{children}</div>;
}

function ErrorLine({ text }: { text: string }) {
   return (
      <p className="rounded-[12px] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-[12px] py-[10px] text-[13px] text-[var(--danger-text)]">
         {text}
      </p>
   );
}

// One-time setup (Milestone design): a banner where Moodeng's pandesal grows with each step (tiny →
// bun → giant hug), three dots, and just the input or button. Keep every step to a few words.
const SETUP_ART = {
   email: '/withdraw-setup/pandesal-1.webp',
   id: '/withdraw-setup/pandesal-2.webp',
   form: '/withdraw-setup/pandesal-3.webp'
};

function SetupBanner({ art, line }: { art: keyof typeof SETUP_ART; line: string }) {
   return (
      <div className="relative w-full h-[112px] rounded-[12px] overflow-hidden bg-[linear-gradient(100deg,#efeaff_0%,#ddd5ff_100%)] dark:bg-[linear-gradient(100deg,#252035_0%,#30285a_100%)]">
         <img
            key={art}
            src={SETUP_ART[art]}
            alt=""
            aria-hidden="true"
            className="moo-float absolute right-[18px] bottom-[-6px] h-[122px] w-auto pointer-events-none select-none"
         />
         <div className="relative flex h-full flex-col justify-center pl-[16px] pr-[130px]">
            <h2 className="text-[22px] font-black italic leading-[1.1] tracking-[-0.5px] text-[#6b55f7] dark:text-[#b3a6ff]">
               Set up cash-out
            </h2>
            <p className="mt-[4px] text-[15px] font-semibold text-[#594d65] dark:text-[#e6def0]">{line}</p>
         </div>
      </div>
   );
}

const SETUP_STEPS = ['Email', 'ID', 'Form'];

function SetupStepper({ done }: { done: number }) {
   return (
      <div className="flex items-start px-[4px]">
         {SETUP_STEPS.map((label, i) => {
            const state = i < done ? 'done' : i === done ? 'current' : 'next';
            return (
               <Fragment key={label}>
                  <div className="flex w-[52px] shrink-0 flex-col items-center gap-[4px]">
                     <span
                        className={`flex h-[28px] w-[28px] items-center justify-center rounded-full text-[13px] font-bold ${
                           state === 'done'
                              ? 'bg-[#1baf7a] text-white'
                              : state === 'current'
                                ? 'bg-[#6b55f7] text-white shadow-[0_0_0_4px_rgba(107,85,247,0.18)]'
                                : 'border-2 border-[#e8e4ff] text-[var(--text-muted)]'
                        }`}
                     >
                        {state === 'done' ? <Check className="w-[15px] h-[15px]" strokeWidth={3} /> : i + 1}
                     </span>
                     <span className={`text-[12px] ${state === 'next' ? 'text-[var(--text-muted)]' : 'font-semibold text-[var(--ink)]'}`}>
                        {label}
                     </span>
                  </div>
                  {i < SETUP_STEPS.length - 1 ? (
                     <div className={`mt-[13px] h-[3px] flex-1 rounded-full ${i < done ? 'bg-[#1baf7a]' : 'bg-[#e8e4ff]'}`} />
                  ) : null}
               </Fragment>
            );
         })}
      </div>
   );
}

const hintClass = 'text-center text-[12px] leading-[16px] text-[var(--text-faint)]';

// 'compliance': Stableyard wants a one-time form (nextAction complete_compliance) before it prices the payout.
// 'pricing': the Payment exists and Stableyard is still working out the quote.
type Step = 'loading' | 'verify' | 'form' | 'compliance' | 'pricing' | 'quote' | 'sending' | 'tracking';

export default function BankPayoutFlow({
   isPreview,
   spendable,
   send,
   onDone,
   mode = 'bank',
   onUseBank
}: {
   isPreview: boolean;
   /** 'qr': pay out to the person's own bank QR instead of a typed account number. */
   mode?: 'bank' | 'qr';
   /** QR mode: switch to the account-number cash-out (offered when Stableyard won't take a QR). */
   onUseBank?: () => void;
   spendable: number | null;
   send: (
      toAddress: string,
      amount: string,
      exchange: string,
      onSubmitted?: () => void
   ) => Promise<{ hash: string; confirmed: boolean } | null>;
   onDone: () => void;
}) {
   const [step, setStep] = useState<Step>('loading');
   const [error, setError] = useState('');
   const [busy, setBusy] = useState(false);
   const [setup, setSetup] = useState<FnResult | null>(null);
   const [challengeId, setChallengeId] = useState('');
   const [code, setCode] = useState('');
   // Where Stableyard sends its code: the login email, or blank for Telegram / phone / TikTok sign-ups
   // whose login email is a placeholder nobody can read, so they type a real one.
   const [codeEmail, setCodeEmail] = useState('');
   const [useHostedCheck, setUseHostedCheck] = useState(false);
   useEffect(() => {
      if (isPreview) return;
      void getSupabaseBrowserClient()
         .auth.getUser()
         .then(({ data }) => {
            const login = data.user?.email ?? '';
            if (login && !isPlaceholderEmail(login)) setCodeEmail((current) => current || login);
         });
   }, [isPreview]);
   const [banks, setBanks] = useState<Bank[]>([]);
   const [bankCode, setBankCode] = useState('');
   const [accountNumber, setAccountNumber] = useState('');
   const [accountName, setAccountName] = useState('');
   const [amount, setAmount] = useState('');
   const [paymentId, setPaymentId] = useState('');
   const [deposit, setDeposit] = useState<DepositInstructions | null>(null);
   // Fee inside the USDC to send, and USD per peso, from Stableyard's quote (null if it didn't say).
   const [feeUsdc, setFeeUsdc] = useState<number | null>(null);
   const [usdPerPeso, setUsdPerPeso] = useState<number | null>(null);
   const [expiresAt, setExpiresAt] = useState<number | null>(null);
   const [now, setNow] = useState(Date.now());
   const [status, setStatus] = useState('');
   // When the USDC went out, and a 1s clock for the oven tracker (kept apart from `now`, which re-arms the status poll).
   const [sentAt, setSentAt] = useState(0);
   const [clock, setClock] = useState(Date.now());
   const requestKey = useRef('');
   const [complianceUrl, setComplianceUrl] = useState('');
   const [remembered, setRemembered] = useState(false);
   const pricingTries = useRef(0);
   const qrMode = mode === 'qr';
   // QR mode: the QR text (never stored or logged) and who it pays, once Stableyard has read it.
   const [qrPayload, setQrPayload] = useState('');
   const [qrName, setQrName] = useState('');

   const bank = banks.find((b) => b.code === bankCode);
   const isEwallet = bank ? /GCASH|MAYA|GRABPAY|SHOPEEPAY|COINS|PALAWANPAY/.test(bank.name) : false;
   const amountNum = Number(amount);
   const amountOk = amount !== '' && amountNum >= MIN_PHP && amountNum <= MAX_PHP;
   const nameOk = accountName.trim().length >= 2;
   const accountOk = isEwallet ? /^09\d{9}$/.test(accountNumber) : accountNumber.length >= 6;

   const sortedBanks = useMemo(() => {
      const top = POPULAR.map((name) => banks.find((b) => b.name === name)).filter((b): b is Bank => Boolean(b));
      const rest = banks.filter((b) => !POPULAR.includes(b.name)).sort((a, b) => a.name.localeCompare(b.name));
      return { top, rest };
   }, [banks]);

   // Type-to-search over ~90 banks: every typed word must appear in the name (ignoring case and
   // punctuation), popular ones first. An empty search shows the popular list.
   const [bankQuery, setBankQuery] = useState('');
   const [pickingBank, setPickingBank] = useState(false);
   const [payeeKind, setPayeeKind] = useState<PayeeKind>('bank');
   // E-wallets are paused (Stableyard: not a stable PHP payout method); the server says when they're back.
   const [ewallets, setEwallets] = useState(false);
   const bankMatches = useMemo(() => {
      const words = normalize(bankQuery).split(' ').filter(Boolean);
      const popular = payeeKind === 'wallet' ? POPULAR_WALLETS : POPULAR_BANKS;
      if (words.length === 0) return popular.map((name) => banks.find((b) => b.name === name)).filter((b): b is Bank => Boolean(b));
      const all = [...sortedBanks.top, ...sortedBanks.rest].filter((b) => {
         const name = normalize(`${b.name} ${shortBank(b.name)}`);
         return words.every((w) => name.includes(w));
      });
      // Names with a word that starts with what you typed come first ("g" → GCash, GrabPay, GoTyme).
      const startsWith = (b: Bank) =>
         normalize(`${b.name} ${shortBank(b.name)}`)
            .split(' ')
            .some((part) => part.startsWith(words[0]));
      const ranked = [...all.filter(startsWith), ...all.filter((b) => !startsWith(b))];
      // Search this side first; if the name is on the other side (picked the wrong tab), still show it.
      const sameKind = ranked.filter((b) => kindOf(b.name) === payeeKind);
      return (sameKind.length ? sameKind : ranked).slice(0, 6);
   }, [bankQuery, sortedBanks, banks, payeeKind]);

   // Pick a bank / e-wallet. A GCash number isn't a bank account number (and back), so switching
   // between the two clears the number.
   const pickBank = (picked: Bank) => {
      if (bank && kindOf(bank.name) !== kindOf(picked.name)) setAccountNumber('');
      setBankCode(picked.code);
      setPickingBank(false);
      setBankQuery('');
   };

   const loadSetup = async () => {
      setError('');
      setStep('loading');
      const res = await call(isPreview, { qr: 'setup' });
      setSetup(res);
      if (!res.ok) {
         setError(res.code === 'no_wallet' ? 'Set up your Moodeng wallet first.' : (res.error ?? 'Could not start. Try again.'));
         setStep('verify');
         return;
      }
      if (!res.emailVerified || !res.kycApproved) {
         setStep('verify');
         return;
      }
      if (qrMode) {
         setStep('form');
         return;
      }
      const list = await call(isPreview, { qr: 'bank_list', country: 'PH' });
      const allowWallets = list.ewallets === true;
      setEwallets(allowWallets);
      if (!allowWallets) setPayeeKind('bank');
      const all = (list.result?.banks ?? []).filter((b) => allowWallets || kindOf(b.name) === 'bank');
      setBanks(all);
      const saved = readSavedPayee(res.accountId ?? 'preview');
      if (saved && all.some((b) => b.code === saved.bankCode)) {
         setBankCode(saved.bankCode);
         setAccountNumber(saved.accountNumber);
         setAccountName(saved.accountName);
         setRemembered(true);
      } else {
         const first = allowWallets ? 'GCASH' : POPULAR_BANKS[0];
         setBankCode((current) =>
            all.some((b) => b.code === current) ? current : all.find((b) => b.name === first)?.code || all[0]?.code || ''
         );
      }
      if (!list.ok) setError(list.error ?? 'Could not load banks. Try again.');
      setStep('form');
   };

   useEffect(() => {
      void loadSetup();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // On the ID step, re-check quietly so the form shows up by itself once Stableyard approves: every few
   // seconds while the ID is being checked (shared or on Stableyard's page), and whenever the person
   // comes back to this tab. "Check again" stays as a fallback.
   const emailVerified = Boolean(setup?.emailVerified);
   const kycApproved = Boolean(setup?.kycApproved);
   const idWaiting = REUSE_PENDING.has(setup?.reuseImportStatus ?? '') || KYC_WAITING.has(setup?.kycStatus ?? '');
   useEffect(() => {
      if (step !== 'verify' || !emailVerified || kycApproved) return;
      let stopped = false;
      let polls = 0;
      const check = async () => {
         if (stopped) return;
         const res = await call(isPreview, { qr: 'setup' });
         if (stopped || !res.ok) return;
         if (res.emailVerified && res.kycApproved) return void loadSetup();
         setSetup(res);
      };
      const onBack = () => {
         if (document.visibilityState === 'visible') void check();
      };
      document.addEventListener('visibilitychange', onBack);
      window.addEventListener('focus', onBack);
      const timer = idWaiting
         ? setInterval(() => {
              polls += 1;
              if (polls > SETUP_POLL_MAX) return clearInterval(timer);
              void check();
           }, SETUP_POLL_MS)
         : undefined;
      return () => {
         stopped = true;
         document.removeEventListener('visibilitychange', onBack);
         window.removeEventListener('focus', onBack);
         if (timer) clearInterval(timer);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [step, emailVerified, kycApproved, idWaiting, isPreview]);

   // Quote countdown.
   useEffect(() => {
      if (step !== 'quote') return;
      const t = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(t);
   }, [step]);

   useEffect(() => {
      if (step !== 'tracking') return;
      const t = setInterval(() => setClock(Date.now()), 1000);
      return () => clearInterval(t);
   }, [step]);

   // After the USDC is sent, follow the payout until Stableyard says it landed or failed.
   useEffect(() => {
      if (step !== 'tracking' || !paymentId || DONE.has(status) || FAILED.has(status)) return;
      const t = setTimeout(
         async () => {
            const res = await call(isPreview, { qr: 'get', paymentId });
            const next = res.result?.payment?.status;
            // The preview answers 'succeeded' at once; hold it ~12s so the oven tracker can be seen.
            if (isPreview && next && DONE.has(next) && Date.now() - sentAt < 12_000) return setNow(Date.now());
            if (next) setStatus(next);
            // Always re-arm: the same status twice in a row ('processing' → 'processing') changes no state,
            // so without this the poll stopped after its second read and the success screen never came.
            setNow(Date.now());
         },
         isPreview ? 1500 : 5000
      );
      return () => clearTimeout(t);
   }, [step, paymentId, status, now, isPreview, sentAt]);

   const runOnboarding = async (action: string, extra: Record<string, string | boolean> = {}) => {
      setBusy(true);
      setError('');
      const res = await call(isPreview, { onboarding: action, ...extra });
      setBusy(false);
      if (!res.ok) return setError(res.error ?? 'Something went wrong. Try again.');
      if (res.result?.challenge?.id) setChallengeId(res.result.challenge.id);
      if (action === 'kyc_start' && res.result?.verificationUrl) window.open(res.result.verificationUrl, '_blank', 'noopener');
      if (action === 'email_confirm' || action === 'kyc_import') void loadSetup();
   };

   // One reply (from create or a re-read) → the next screen. A bank payout can come back priced, waiting
   // on Stableyard's one-time compliance form, or still pricing.
   const showPayment = (res: FnResult) => {
      const payment = res.result?.payment;
      const next = res.result?.nextAction;
      if (!res.ok || !payment?.id) {
         setStep('form');
         return setError(res.error ?? 'Could not get a price right now. Try again in a minute.');
      }
      setPaymentId(payment.id);
      if (payment.status && FAILED.has(payment.status)) {
         setStep('form');
         return setError('That price expired. Tap the button again for a new one.');
      }
      const instructions = next?.depositInstructions;
      if (instructions) {
         if (instructions.chainId !== 8453 || instructions.tokenAddress.toLowerCase() !== BASE_USDC || instructions.decimals !== 6) {
            setStep('form');
            return setError('This payout needs a different coin. Please contact support.');
         }
         setDeposit(instructions);
         const funding = payment.funding;
         const fee = Number(funding?.totalFees?.amount);
         const rate = Number(funding?.exchangeRate?.rate);
         const phpToUsd = funding?.exchangeRate?.baseAssetCode === 'PHP' && funding?.exchangeRate?.quoteAssetCode === 'USD';
         setFeeUsdc(Number.isFinite(fee) && fee >= 0 ? fee : null);
         setUsdPerPeso(phpToUsd && Number.isFinite(rate) && rate > 0 ? rate : null);
         const expiry = next?.expiresAt ?? payment.quoteExpiresAt ?? payment.expiresAt;
         setExpiresAt(expiry ? new Date(expiry).getTime() : null);
         setNow(Date.now());
         return setStep('quote');
      }
      if (next?.type === 'complete_compliance' && next.url) {
         setComplianceUrl(next.url);
         return setStep('compliance');
      }
      pricingTries.current = 0;
      setStep('pricing');
   };

   const createPayment = async () => {
      setBusy(true);
      setError('');
      requestKey.current = crypto.randomUUID();
      if (qrMode) {
         const qrRes = await call(isPreview, {
            qr: 'qr_cash_create',
            country: 'PH',
            qrPayload,
            amount: String(amountNum),
            requestKey: requestKey.current
         });
         setBusy(false);
         return qrRes;
      }
      const res = await call(isPreview, {
         qr: 'bank_create',
         country: 'PH',
         bankCode,
         bankName: bank?.name ?? '',
         accountNumber,
         beneficiaryName: accountName.trim(),
         amount: String(amountNum),
         requestKey: requestKey.current
      });
      setBusy(false);
      return res;
   };

   const getQuote = async () => showPayment(await createPayment());

   // Stableyard never moves a Payment on once the form is done (it keeps asking for it), so after
   // the form we start a fresh Payment; only if that one still asks has the form not landed.
   const recheckPayment = async () => {
      const res = await createPayment();
      if (res.ok && res.result?.nextAction?.type === 'complete_compliance')
         return setError("Stableyard hasn't received the form yet. Finish it, then try again.");
      showPayment(res);
   };

   // While Stableyard prices the payout, re-read it every few seconds (up to ~1 minute).
   useEffect(() => {
      if (step !== 'pricing' || !paymentId) return;
      const t = setTimeout(async () => {
         pricingTries.current += 1;
         const res = await call(isPreview, { qr: 'get', paymentId });
         const next = res.result?.nextAction;
         if (next?.depositInstructions || next?.type === 'complete_compliance' || !res.ok) return showPayment(res);
         if (pricingTries.current >= 20) {
            setStep('form');
            return setError('Stableyard is taking long to price this. Try again in a few minutes.');
         }
         setNow(Date.now());
      }, 3000);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [step, paymentId, now]);

   const usdc = deposit ? Number(deposit.amount) : 0;
   const notEnough = spendable != null && usdc > spendable;
   const secondsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null;
   const expired = secondsLeft === 0;

   const confirmSend = async () => {
      if (!deposit) return;
      setBusy(true);
      setError('');
      setStep('sending');
      try {
         const outcome = await send(
            deposit.address,
            deposit.amount,
            qrMode ? 'Bank QR via Stableyard' : `${shortBank(bank?.name ?? 'bank')} via Stableyard`
         );
         if (!outcome) {
            setStep('quote');
            return;
         }
         void call(isPreview, { qr: 'sent', paymentId, txHash: outcome.hash });
         if (!qrMode) writeSavedPayee(setup?.accountId ?? 'preview', { bankCode, accountNumber, accountName: accountName.trim() });
         setStatus('processing');
         setSentAt(Date.now());
         setClock(Date.now());
         setStep('tracking');
      } catch (err) {
         setError((err as Error).message || 'The send did not go through. Nothing left your wallet.');
         setStep('quote');
      } finally {
         setBusy(false);
      }
   };

   const accountLabel = qrMode ? qrName || 'your bank' : `${shortBank(bank?.name ?? '')} ••${accountNumber.slice(-4)}`;

   const decodeQr = async (payload: string): Promise<DecodeReply> => {
      const res = await call(isPreview, { qr: 'qr_cash_decode', country: 'PH', qrPayload: payload });
      if (!res.ok) return { ok: false, code: res.code, error: res.error };
      const name = res.result?.merchant?.displayName ?? res.result?.merchant?.name ?? qrPayeeName(payload) ?? '';
      setQrPayload(payload);
      setQrName(name);
      setError('');
      return { ok: true, name };
   };

   if (step === 'loading') {
      return (
         <Panel>
            <div className="flex items-center gap-[10px] text-[14px] text-[var(--text-muted)]">
               <Loader2 className="w-[18px] h-[18px] animate-spin" /> Getting things ready…
            </div>
         </Panel>
      );
   }

   if (step === 'verify') {
      const emailDone = Boolean(setup?.emailVerified);
      const reusePending = REUSE_PENDING.has(setup?.reuseImportStatus ?? '');
      const reviewing = reusePending || setup?.kycStatus === 'requires_review' || setup?.kycStatus === 'in_review';
      const offerReuse = Boolean(setup?.reuseAvailable && setup?.consentText) && !useHostedCheck && !reviewing;
      const idStep = emailDone && !setup?.kycApproved;
      return (
         <div className="space-y-[12px]">
            <SetupBanner
               art={emailDone ? 'id' : 'email'}
               line={!emailDone ? 'Step 1 · Your email' : reviewing ? 'Checking your ID…' : 'Step 2 · Your ID'}
            />
            <Panel>
               <SetupStepper done={emailDone ? (setup?.kycApproved ? 2 : 1) : 0} />
               {error ? <ErrorLine text={error} /> : null}
               {!emailDone ? (
                  <div className="space-y-[8px]">
                     <input
                        value={codeEmail}
                        onChange={(e) => setCodeEmail(e.target.value.trim())}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="Your email"
                        className={inputClass}
                     />
                     {challengeId ? (
                        <div className="flex gap-[8px]">
                           <input
                              value={code}
                              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              inputMode="numeric"
                              placeholder="6-digit code"
                              className={inputClass}
                           />
                           <button
                              className="shrink-0 rounded-[14px] px-[16px] font-semibold text-white bg-[var(--primary)] disabled:bg-[var(--disabled)]"
                              disabled={busy || code.length !== 6}
                              onClick={() => void runOnboarding('email_confirm', { challengeId, code })}
                           >
                              Confirm
                           </button>
                        </div>
                     ) : null}
                     <button
                        className={challengeId ? `${linkClass}` : primaryClass}
                        disabled={busy || !isValidEmail(codeEmail) || isPlaceholderEmail(codeEmail)}
                        onClick={() => void runOnboarding('email_start', { email: codeEmail })}
                     >
                        {challengeId ? 'Send again' : 'Send code'}
                     </button>
                  </div>
               ) : null}
               {idStep && reviewing ? (
                  <p className="flex items-center justify-center gap-[8px] py-[6px] text-[14px] font-semibold text-[var(--text-muted)]">
                     <Loader2 className="w-[16px] h-[16px] animate-spin text-[#6b55f7]" /> A few minutes
                  </p>
               ) : null}
               {idStep && offerReuse ? (
                  <div className="space-y-[8px]">
                     <p className="mx-auto flex w-fit items-center gap-[6px] rounded-full bg-[#e6f7ef] px-[12px] py-[5px] text-[13px] font-semibold text-[#148a5f] dark:bg-[#123d2e] dark:text-[#6fe0b0]">
                        <Check className="w-[14px] h-[14px]" strokeWidth={3} /> Verified with Moodeng
                     </p>
                     {/* Tapping the button is the consent; the line under it is what's shared (saved with the receipt). */}
                     <button className={primaryClass} disabled={busy} onClick={() => void runOnboarding('kyc_import', { consent: true })}>
                        {busy ? 'Sharing…' : 'Use my Moodeng ID'}
                     </button>
                     <p className={hintClass}>{setup?.consentText}</p>
                     <button
                        className={`${linkClass} flex items-center justify-center gap-[2px]`}
                        disabled={busy}
                        onClick={() => setUseHostedCheck(true)}
                     >
                        New ID check instead <ChevronRight className="w-[16px] h-[16px]" />
                     </button>
                  </div>
               ) : null}
               {idStep && !offerReuse && !reviewing ? (
                  <div className="space-y-[8px]">
                     <button
                        className={primaryClass}
                        disabled={busy}
                        onClick={() => (setup?.kycUrl ? window.open(setup.kycUrl, '_blank', 'noopener') : void runOnboarding('kyc_start'))}
                     >
                        {setup?.kycStatus && setup.kycStatus !== 'not_started' ? 'Continue ID check' : 'Start ID check'}
                     </button>
                     <p className={hintClass}>Have your ID ready</p>
                  </div>
               ) : null}
            </Panel>
            {emailDone ? (
               <button className={linkClass} disabled={busy} onClick={() => void loadSetup()}>
                  Check again
               </button>
            ) : null}
            <div className="flex justify-center">
               <PoweredByStableyard />
            </div>
         </div>
      );
   }

   if (step === 'form' && qrMode) {
      return (
         <QrCashoutSteps
            spendable={spendable}
            amount={amount}
            setAmount={setAmount}
            minPhp={MIN_PHP}
            maxPhp={MAX_PHP}
            busy={busy}
            error={error}
            qrName={qrName}
            hasQr={Boolean(qrPayload)}
            decode={decodeQr}
            onClearQr={() => {
               setQrPayload('');
               setQrName('');
               setError('');
            }}
            onGetPrice={() => void getQuote()}
            onUseBank={onUseBank}
         />
      );
   }

   if (step === 'form') {
      return (
         <div className="space-y-[12px]">
            <Panel>
               {remembered && (
                  <p className="flex w-fit items-center gap-[6px] rounded-full bg-[var(--surface-2)] px-[10px] py-[4px] text-[12px] font-semibold text-[var(--text-muted)]">
                     <Check className="w-[13px] h-[13px]" strokeWidth={3} /> Filled in from last time
                  </p>
               )}
               <span className="block text-[13px] font-semibold text-[var(--ink)]">Send to</span>
               {bank && !pickingBank ? (
                  <button
                     type="button"
                     onClick={() => {
                        setBankQuery('');
                        setPayeeKind(kindOf(bank.name));
                        setPickingBank(true);
                     }}
                     className={`${inputClass} mt-[6px] flex items-center gap-[10px] text-left`}
                  >
                     <BankBadge name={bank.name} />
                     <span className="flex-1 min-w-0 truncate font-semibold">{shortBank(bank.name)}</span>
                     <span className="text-[13px] font-semibold text-[var(--accent)] shrink-0">Change</span>
                  </button>
               ) : (
                  <div className="mt-[6px]">
                     {ewallets ? (
                        <div className="grid grid-cols-2 gap-[6px] mb-[8px]" role="tablist">
                           {(
                              [
                                 ['wallet', 'E-wallet'],
                                 ['bank', 'Bank']
                              ] as const
                           ).map(([kind, label]) => (
                              <button
                                 key={kind}
                                 type="button"
                                 role="tab"
                                 aria-selected={payeeKind === kind}
                                 onClick={() => {
                                    setPayeeKind(kind);
                                    setBankQuery('');
                                 }}
                                 className={`flex items-center justify-center gap-[6px] rounded-[10px] border-2 px-[10px] py-[9px] text-[14px] font-semibold transition-colors ${payeeKind === kind ? 'border-[#6b55f7] bg-[var(--surface-2)] text-[#6b55f7] dark:text-[#a98bff]' : 'border-[var(--border-card)] text-[var(--ink)]'}`}
                              >
                                 {kind === 'wallet' ? (
                                    <Smartphone className="w-[16px] h-[16px]" />
                                 ) : (
                                    <Landmark className="w-[16px] h-[16px]" />
                                 )}
                                 {label}
                              </button>
                           ))}
                        </div>
                     ) : null}
                     <div className="relative">
                        <Search className="w-[16px] h-[16px] text-[var(--text-faint)] absolute left-[12px] top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                           value={bankQuery}
                           onChange={(e) => setBankQuery(e.target.value)}
                           onKeyDown={(e) => {
                              // The keyboard's Go / Enter picks the top match.
                              if (e.key !== 'Enter' || !bankQuery.trim() || !bankMatches[0]) return;
                              e.preventDefault();
                              pickBank(bankMatches[0]);
                           }}
                           enterKeyHint="go"
                           autoFocus={pickingBank}
                           placeholder={payeeKind === 'wallet' ? 'Search e-wallets' : 'Search banks'}
                           className={`${inputClass} pl-[36px]`}
                        />
                     </div>
                     <div className="mt-[6px] rounded-[12px] border border-[var(--border-card)] overflow-hidden divide-y divide-[var(--divider)]">
                        {bankMatches.map((b) => (
                           <button
                              key={b.code}
                              type="button"
                              onClick={() => pickBank(b)}
                              className="w-full px-[12px] py-[10px] flex items-center gap-[10px] text-left hover:bg-[var(--surface-2)]"
                           >
                              <BankBadge name={b.name} />
                              <span className="flex-1 min-w-0 truncate text-[14px] text-[var(--ink)]">{shortBank(b.name)}</span>
                              {b.code === bankCode && <Check className="w-[16px] h-[16px] text-[var(--primary)] shrink-0" />}
                           </button>
                        ))}
                        {bankMatches.length === 0 && (
                           <p className="px-[12px] py-[10px] text-[13px] text-[var(--text-muted)]">No match. Try fewer letters.</p>
                        )}
                     </div>
                  </div>
               )}
               {/* The account fields follow the chosen bank (GCash number vs account number), so they wait until one is picked. */}
               {bank && !pickingBank && (
                  <>
                     <label className="block">
                        <span className="text-[13px] font-semibold text-[var(--ink)]">
                           {isEwallet ? `${shortBank(bank?.name ?? '')} number` : 'Account number'}
                        </span>
                        <input
                           value={accountNumber}
                           onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              setAccountNumber(isEwallet ? toLocalMobile(digits) : digits.slice(0, 20));
                           }}
                           inputMode="numeric"
                           placeholder={isEwallet ? '09XX XXX XXXX' : 'Account number'}
                           className={`${inputClass} mt-[6px]`}
                        />
                        {accountNumber && !accountOk ? (
                           <span className="text-[12px] text-[var(--danger)]">
                              {isEwallet ? '11 digits, starts with 09' : 'Check the number'}
                           </span>
                        ) : null}
                     </label>
                     <label className="block">
                        <span className="text-[13px] font-semibold text-[var(--ink)]">Account name</span>
                        <input
                           value={accountName}
                           onChange={(e) => setAccountName(e.target.value.slice(0, 100))}
                           autoComplete="name"
                           placeholder="Full name"
                           className={`${inputClass} mt-[6px]`}
                        />
                     </label>
                     <label className="block">
                        <span className="text-[13px] font-semibold text-[var(--ink)]">Amount</span>
                        <div className="relative mt-[6px]">
                           <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[16px] text-[var(--text-muted)]">₱</span>
                           <input
                              value={amount}
                              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{0,2}).*/, '$1'))}
                              inputMode="decimal"
                              placeholder="0"
                              className={`${inputClass} pl-[30px]`}
                           />
                        </div>
                        <span className="text-[12px] text-[var(--text-faint)]">
                           {peso(MIN_PHP)}–{peso(MAX_PHP)}
                           {spendable != null ? ` · you have ${spendable} USDC` : ''}
                        </span>
                     </label>
                  </>
               )}
               {error ? <ErrorLine text={error} /> : null}
            </Panel>
            <button
               className={primaryClass}
               disabled={busy || !bankCode || !accountOk || !nameOk || !amountOk}
               onClick={() => void getQuote()}
            >
               {busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : null}
               {busy ? 'One moment…' : 'Continue'}
               {!busy ? <ArrowRight className="w-4 h-4" /> : null}
            </button>
         </div>
      );
   }

   if (step === 'compliance') {
      return (
         <div className="space-y-[12px]">
            <SetupBanner art="form" line="Step 3 · Short form" />
            <Panel>
               <SetupStepper done={2} />
               {error ? <ErrorLine text={error} /> : null}
               <button className={primaryClass} onClick={() => window.open(complianceUrl, '_blank', 'noopener')}>
                  Open form <ArrowRight className="w-4 h-4" />
               </button>
               <p className={hintClass}>Works once · finish in one go</p>
            </Panel>
            <button className={linkClass} disabled={busy} onClick={() => void recheckPayment()}>
               {busy ? 'Checking…' : 'Done — get my price'}
            </button>
         </div>
      );
   }

   if (step === 'pricing') {
      return (
         <Panel>
            <div className="flex flex-col items-center gap-[8px] py-[6px]">
               <img src={SETUP_ART.id} alt="" aria-hidden="true" className="moo-float h-[104px] w-auto" />
               <p className="flex items-center gap-[8px] text-[15px] font-semibold text-[var(--text-muted)]">
                  <Loader2 className="w-[16px] h-[16px] animate-spin text-[#6b55f7]" /> Getting your price…
               </p>
            </div>
         </Panel>
      );
   }

   if (step === 'quote' || step === 'sending') {
      // Everything in pesos so the fee is plain to see: what leaves your wallet, minus the fee, is what arrives.
      const sendUsdc = Number(deposit?.amount ?? 0);
      const toPeso = (usdc: number) => (usdPerPeso ? usdc / usdPerPeso : null);
      const sendPhp = toPeso(sendUsdc);
      const feePhp = feeUsdc != null ? toPeso(feeUsdc) : null;
      const usdcText = (n: number) => `${n.toFixed(2)} USDC`;
      return (
         <div className="space-y-[12px]">
            {qrMode ? <QrTrail step={2} /> : null}
            <Panel>
               <div className="text-center pt-[4px]">
                  <p className="text-[13px] text-[var(--text-muted)]">You get</p>
                  <p className="text-[40px] font-black italic leading-[1.15] tracking-[-0.8px] text-[#735dfa] dark:text-[#a98bff]">
                     {peso(amountNum)}
                  </p>
                  <div className="mt-[6px] inline-flex items-center gap-[8px] rounded-full bg-[var(--surface-2)] pl-[4px] pr-[12px] py-[4px]">
                     {qrMode ? (
                        <QrCode className="w-[18px] h-[18px] ml-[4px] text-[var(--primary)]" />
                     ) : bank ? (
                        <BankBadge name={bank.name} size={24} />
                     ) : (
                        <Landmark className="w-[18px] h-[18px] text-[var(--primary)]" />
                     )}
                     <span className="text-[14px] font-semibold text-[var(--ink)]">{accountLabel}</span>
                  </div>
               </div>
               {/* The breakdown: what leaves the wallet, each fee with whose it is, and what arrives. Every fee
                   in Stableyard's quote is theirs (their 0.5% + their payout partner's); our partner fee is 0. */}
               <div className="rounded-[16px] bg-[var(--surface-2)] p-[4px]">
                  <div className="rounded-[12px] bg-[var(--surface)] px-[14px] py-[12px] space-y-[12px] text-[14px] text-[var(--ink)]">
                     <div className="flex items-center gap-[10px]">
                        <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-[#f1eeff] dark:bg-[#2a2150]">
                           <Wallet className="w-[15px] h-[15px] text-[#6b55f7] dark:text-[#a98bff]" />
                        </span>
                        <span className="flex-1">You send</span>
                        <span className="text-right">
                           <span className="font-semibold">{sendPhp != null ? peso(sendPhp) : usdcText(sendUsdc)}</span>
                           {sendPhp != null ? (
                              <span className="block text-[11px] leading-[14px] text-[var(--text-faint)]">
                                 {Number(deposit?.amount ?? 0)} USDC
                              </span>
                           ) : null}
                        </span>
                     </div>
                     <div className="flex items-center gap-[10px]">
                        <img
                           src="/brand/stableyard/stableyard-logomark.svg"
                           alt=""
                           aria-hidden="true"
                           className="h-[28px] w-[28px] shrink-0 rounded-[8px]"
                        />
                        <span className="flex-1">Stableyard fee</span>
                        <span className="font-semibold text-[var(--text-muted)]">
                           {feeUsdc == null ? 'Included' : feePhp != null ? `− ${peso(feePhp)}` : `− ${usdcText(feeUsdc)}`}
                        </span>
                     </div>
                     <div className="flex items-center gap-[10px]">
                        <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/5">
                           <img src="/moodenglogo.webp" alt="" aria-hidden="true" className="h-[20px] w-auto" />
                        </span>
                        <span className="flex-1">Moodeng fee</span>
                        <span className="rounded-full bg-[#e6f7ef] px-[8px] py-[2px] text-[13px] font-bold text-[#148a5f] dark:bg-[#123d2e] dark:text-[#6fe0b0]">
                           ₱0
                        </span>
                     </div>
                  </div>
                  <div className="flex items-center justify-between px-[14px] pt-[10px] pb-[8px]">
                     <span className="text-[15px] font-bold text-[var(--ink)]">You get</span>
                     <span className="text-[20px] font-black italic tracking-[-0.3px] text-[#6b55f7] dark:text-[#a98bff]">
                        {peso(amountNum)}
                     </span>
                  </div>
               </div>
               {secondsLeft != null ? (
                  <p
                     className={`text-[12px] flex items-center justify-center gap-[6px] ${expired ? 'text-[var(--danger)]' : 'text-[var(--text-faint)]'}`}
                  >
                     <Clock className="w-[13px] h-[13px]" />
                     {expired ? 'Price expired' : `Price held ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
                  </p>
               ) : null}
               {notEnough ? <ErrorLine text={`You have ${spendable} USDC. Lower the amount.`} /> : null}
               {error ? <ErrorLine text={error} /> : null}
            </Panel>
            {expired && qrMode ? (
               <GoldButton disabled={busy} onClick={() => void getQuote()}>
                  Refresh price
               </GoldButton>
            ) : expired ? (
               <button className={primaryClass} disabled={busy} onClick={() => void getQuote()}>
                  Refresh price
               </button>
            ) : qrMode ? (
               <GoldButton busy={step === 'sending'} disabled={busy || notEnough || spendable == null} onClick={() => void confirmSend()}>
                  {step === 'sending' ? 'Sending…' : 'Confirm'}
               </GoldButton>
            ) : (
               <button className={primaryClass} disabled={busy || notEnough || spendable == null} onClick={() => void confirmSend()}>
                  {step === 'sending' ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : null}
                  {step === 'sending' ? 'Sending…' : 'Confirm'}
               </button>
            )}
            <button className={linkClass} disabled={busy} onClick={() => setStep('form')}>
               Change details
            </button>
         </div>
      );
   }

   // tracking
   const done = DONE.has(status);
   const failed = FAILED.has(status);
   // Stableyard only says waiting / processing / succeeded, so the cake rises on a clock while we wait
   // (frames 1-5, holding at 5) and the finished cake shows when the payout succeeds. The bar is an
   // estimate too: 15% once the USDC is sent, easing toward 92% (never stalls at a round number), 100% on success.
   const realElapsed = Math.max(0, (clock - sentAt) / 1000);
   const elapsed = realElapsed / (isPreview ? 0.08 : 1); // the preview bakes ~12x faster
   const ovenFrame = elapsed < 10 ? 1 : elapsed < 40 ? 2 : elapsed < 90 ? 3 : elapsed < 150 ? 4 : 5;
   const percent = done ? 100 : Math.round(15 + 77 * (1 - Math.exp(-elapsed / 90)));
   const slow = !done && !failed && realElapsed > 300;
   const minutes = Math.floor(realElapsed / 60);
   const steps: { label: string; state: 'done' | 'active' | 'todo' }[] = [
      { label: 'USDC sent from your wallet', state: 'done' },
      { label: 'Converting to pesos', state: done ? 'done' : 'active' },
      { label: qrMode ? 'Arrived in the bank' : `Arrived in ${accountLabel}`, state: done ? 'done' : 'todo' }
   ];
   return (
      <div className="space-y-[12px]">
         <Panel>
            {failed ? (
               <div className="flex flex-col items-center text-center gap-[10px] py-[8px]">
                  <XCircle className="w-[44px] h-[44px] text-[var(--danger)]" />
                  <p className="text-[20px] font-semibold text-[var(--ink)]">The payout did not go through</p>
                  <p className="text-[13px] text-[var(--text-muted)] leading-[18px]">
                     Don&apos;t worry, your USDC is safe. Message us and we&apos;ll sort it out.
                  </p>
               </div>
            ) : (
               <div className="flex flex-col items-center text-center">
                  {done ? (
                     <img src="/withdraw-oven/cake.webp" alt="" aria-hidden="true" className="h-[96px] w-auto" />
                  ) : (
                     // All frames stacked so they're preloaded; the current one fades in.
                     <div className="relative w-[150px] aspect-[549/560]" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((n) => (
                           <img
                              key={n}
                              src={`/withdraw-oven/oven-${n}.webp`}
                              alt=""
                              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-700"
                              style={{ opacity: n === ovenFrame ? 1 : 0 }}
                           />
                        ))}
                     </div>
                  )}
                  <div className="mt-[12px] w-full">
                     <div className="flex justify-between text-[12px] font-semibold text-[var(--text-muted)] mb-[4px]">
                        <span>{done ? 'Done' : 'Sending…'}</span>
                        <span className="text-[#6b55f7] dark:text-[#a98bff]">{percent}%</span>
                     </div>
                     <div
                        className="h-[10px] w-full rounded-full bg-[var(--surface-2,#f1edff)] overflow-hidden"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                     >
                        <div
                           className="h-full rounded-full bg-[linear-gradient(85deg,#9584ff_0%,#6b55f7_98%)] transition-[width] duration-1000 ease-out"
                           style={{ width: `${percent}%` }}
                        />
                     </div>
                  </div>
                  <p
                     className={
                        done
                           ? 'mt-[6px] text-[26px] font-black italic leading-[1.2] tracking-[-0.5px] text-[#6b55f7] dark:text-[#b3a6ff]'
                           : 'mt-[6px] text-[20px] font-semibold text-[var(--ink)]'
                     }
                  >
                     {done ? `${peso(amountNum)} sent to ${accountLabel}!` : `Baking your ${peso(amountNum)}…`}
                  </p>
                  {done ? (
                     <p className="text-[13px] text-[var(--text-muted)] leading-[18px] mt-[4px]">
                        Check your app. It can take a few minutes to show.
                     </p>
                  ) : (
                     <>
                        <ol className="mt-[12px] w-full space-y-[8px] text-left">
                           {steps.map((st) => (
                              <li key={st.label} className="flex items-center gap-[10px] text-[14px]">
                                 <span
                                    className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 ${
                                       st.state === 'done'
                                          ? 'bg-[#6b55f7] text-white'
                                          : st.state === 'active'
                                            ? 'border-2 border-[#6b55f7]'
                                            : 'border-2 border-[var(--border-input)]'
                                    }`}
                                 >
                                    {st.state === 'done' ? (
                                       <Check className="w-[13px] h-[13px]" strokeWidth={3} />
                                    ) : st.state === 'active' ? (
                                       <Loader2 className="w-[12px] h-[12px] text-[#6b55f7] animate-spin" />
                                    ) : null}
                                 </span>
                                 <span className={st.state === 'todo' ? 'text-[var(--text-faint)]' : 'text-[var(--ink)] font-semibold'}>
                                    {st.label}
                                 </span>
                              </li>
                           ))}
                        </ol>
                        <p className="mt-[12px] text-[12px] text-[var(--text-muted)] leading-[17px]">
                           {slow
                              ? 'Taking longer than usual, but it’s on its way. You can leave this page; we’ll keep sending it.'
                              : `Started ${minutes < 1 ? 'just now' : `${minutes} min ago`} · usually a few minutes. You can leave this page.`}
                        </p>
                     </>
                  )}
               </div>
            )}
         </Panel>
         {qrMode ? (
            <GoldButton onClick={onDone}>Done</GoldButton>
         ) : (
            <button className={primaryClass} onClick={onDone}>
               Done
            </button>
         )}
      </div>
   );
}
