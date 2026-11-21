import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from './discord.ts';
import { sendEmail } from './email.ts';
import { incomeDocKeyboard, incomeDocUrl, postIncomeDocDiscordCard, reachLine } from './incomeDocCards.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { askOnMessengerIfWaiting } from './messengerIncomeDocReply.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { fileMarkers, gcashRefIssues, type ImageInfo, imageInfo, isAiSize, rowKeys, rowOverlap } from './fileForensics.ts';
import { sendTelegramFiles, sendTelegramMessage, type TelegramInlineKeyboard, type TelegramUpload } from './telegram.ts';
import { idLocaleOf, idResendReason, isIdTrackUser, loadIdStatus, notifyIdNextStep, sendIdTelegram } from './idTrack.ts';
import { withToday } from './aiToday.ts';
import { chatTokens, logAiUsage } from './aiUsage.ts';

// Proof of income sent from moodeng.app/documents (see the income_documents migration).
//   0. ping     Telegram admin chat + Discord #kyc right away: who sent what, open it in Admin
//   1. read     DeepSeek Flash turns the screenshots/photos (as images) and PDFs (as their text
//               layer — DeepSeek can't open PDFs) into rows, each with the page + exact text
//   2. numbers  plain code: money in/out per month, balances, regular deposits + their payday
//   3. checks   edits (balance math, payslip math, PDF editor/dates, same file on another account),
//               identity (name vs Didit ID) and ability to repay (repayment vs monthly money in,
//               2+ months of history, balance vs repayment, due date vs payday)
//   4. score    0–100 from the checks, rule-based — NOT a calibrated default probability until we
//               have enough repaid/late loans above $60 to test it on
//   5. note     a second, text-only DeepSeek call writes a 3-line lend / maybe / decline note
// Results land on the row (Admin → Risk → Income docs) and as a reply under the ping.

// Flash is DeepSeek's only model that reads images, and costs about a cent per send.
// Reads the pages (it sees images). Thinking off: it's copying rows, and with thinking on (DeepSeek's
// default) the hidden reasoning used up the answer's room — 5 screenshots "too long to read", Nov 11.
const MODEL = 'deepseek-flash';
// Writes the lending opinion from the document + the borrower's history. Text only, so the bigger
// model with thinking on is cheap (one call per send).
const OPINION_MODEL = 'deepseek-v4-pro';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const TOO_LONG = 'document too long to read in one pass';
// Rough rates for the affordability checks only; close enough to compare sizes.
const PER_USD: Record<string, number> = { USD: 1, PHP: 57, IDR: 16300, THB: 33 };

export const parseStatedIncome = (text: string | null | undefined) => {
   const m = (text ?? '').toLowerCase().replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k)?/);
   if (!m) return null;
   const n = Number(m[1]) * (m[2] ? 1000 : 1);
   return n > 0 ? n : null;
};

type Nullable<T> = T | null;

export type ExtractedField = { key: string; label: string; value: string; page: number; source_text: string };
export type ExtractedTransaction = {
   date: string;
   description: string;
   amount: number;
   balance: Nullable<number>;
   page: number;
   source_text: string;
};
export type Extracted = {
   readable: boolean;
   unreadable_reason: Nullable<string>;
   doc_type: 'gcash_history' | 'maya_history' | 'bank_statement' | 'payslip' | 'remittance' | 'business_permit' | 'gig_earnings' | 'seller_payout' | 'freelance_earnings' | 'sss_contributions' | 'other';
   holder_name: Nullable<string>;
   institution: Nullable<string>;
   currency: Nullable<string>;
   period_start: Nullable<string>;
   period_end: Nullable<string>;
   opening_balance: Nullable<number>;
   closing_balance: Nullable<number>;
   payslip: Nullable<{ employer: Nullable<string>; gross_pay: Nullable<number>; total_deductions: Nullable<number>; net_pay: Nullable<number> }>;
   fields: ExtractedField[];
   transactions: ExtractedTransaction[];
   visual_anomalies: string[];
   /**
    * Government ID numbers printed on a payslip / SSS record (SSS, PhilHealth, Pag-IBIG, TIN). Only ever
    * held in memory: hashed into income_documents.id_hashes (idKeys) and emptied before anything is saved.
    */
   id_numbers?: Array<{ type: string; value: string }>;
};

export type Flag = { code: string; severity: 'red' | 'orange' | 'info'; detail: string };

export type Metrics = {
   months_covered: number;
   transaction_count: number;
   total_in: number;
   total_out: number;
   monthly_in: number;
   monthly_out: number;
   average_balance: Nullable<number>;
   lowest_balance: Nullable<number>;
   regular_deposits: Array<{ amount: number; months: number; description: string; refs: string[]; payday: Nullable<number> }>;
   largest_in: Nullable<{ amount: number; share: number; ref: string }>;
   net_pay: Nullable<number>;
};

/** Their open request or loan, in USD. */
export type LoanContext = { amount: number; total_repayment: number; due_date: Nullable<string> };

// DeepSeek's JSON mode has no schema, so the prompt carries an example of the exact shape and
// normalizeExtracted() fills anything it leaves out.
const EXAMPLE_JSON = {
   readable: true,
   unreadable_reason: null,
   doc_type: 'gcash_history',
   holder_name: 'Juan Dela Cruz',
   institution: 'GCash',
   currency: 'PHP',
   period_start: '2026-08-01',
   period_end: '2026-10-15',
   opening_balance: 1000,
   closing_balance: 13500,
   payslip: null,
   fields: [{ key: 'account_last4', label: 'Account', value: '1234', page: 1, source_text: '0917 *** 1234' }],
   transactions: [{ date: '2026-08-15', description: 'Received from ACME Trading', amount: 12000, balance: 13000, page: 1, source_text: 'Aug 15 Received from ACME Trading +12,000.00 13,000.00' }],
   visual_anomalies: [],
   id_numbers: []
};

const SYSTEM = `You read proof-of-income documents for a small lender in the Philippines, Indonesia and Thailand: GCash, Maya, DANA, OVO or PromptPay/bank-app transaction history (PDF export or app screenshots), bank statements (often bilingual, e.g. Thai + English — read the English labels and the numbers), payslips, remittance receipts, business permits, and proof of the work itself: a rider's or driver's earnings screen (Grab, Lalamove, foodpanda, Angkas, Gojek), an online shop's income or payout screen (Shopee, Lazada, TikTok Shop, Tokopedia), a freelancer's earnings or payout history (Upwork, OnlineJobs, PayPal, Wise, Payoneer), or an SSS contributions record (My.SSS). Several files from one person are usually screenshots of the SAME history: read them as one document, merge the rows, and drop rows that appear twice because screenshots overlap.

Copy what the document says. Never guess or fill in a number that is not printed.
- transactions: every row, oldest first. amount is positive for money in, negative for money out. balance is the running balance printed on that row, or null. date as YYYY-MM-DD.
- source_text: the exact characters printed for that row or field, so a person can find it. Include the reference number (e.g. "Ref No. 1234 567 890123") when the row shows one. page: 1-based, counting files in the order given (a screenshot is one page).
- fields: other key facts printed (account number last 4 digits only, employer, pay period, permit number, address). Never copy a full account or ID number.
- period_start / period_end: the statement or pay period as printed, or the first and last transaction dates, YYYY-MM-DD.
- visual_anomalies: only things you can actually see that suggest editing: mixed fonts or sizes within one column, misaligned digits, numbers pasted over a different background, blurred amounts next to sharp text, totals that do not match the rows, a layout that does not match the institution's real format. Empty if none.
- Before you call a total wrong, do the math the way payroll does. Rows like Late, Tardiness, Undertime, Absence, Cash advance or Loan are SUBTRACTED from pay even when the template lists them under Earnings without a minus sign (e.g. Basic 6,600 + Overtime 546.56 − Late 426.65 + COLA 500 = 7,219.91, printed as 7,220). Totals rounded to the whole peso are fine. Only report a total that is off by more than 1 after trying that.
- A payslip from a small branch often shows a franchise brand's logo (Generika, Mercury Drug, 7-Eleven, Jollibee…) next to the owner's own company name (e.g. "ALIOA DRUGSTORE OPC"): that is one employer, not a mismatch. Put the company name in employer and mention the brand in institution.
- If you cannot read it (blank, not a financial document, password-protected, too blurry), set readable false, say why in unreadable_reason, and leave the lists empty.
- doc_type is one of: gcash_history, maya_history, bank_statement, payslip, remittance, business_permit, gig_earnings (rider/driver app earnings), seller_payout (online shop income), freelance_earnings (freelance platform or PayPal/Wise/Payoneer payouts), sss_contributions, other. Use other only when it is none of these.
- gig_earnings, seller_payout, freelance_earnings: each day, week or payout shown is one transaction with a positive amount (what they earned or were paid), dated at the end of that day or week; balance is null. institution is the app.
- sss_contributions: put the employer and each month's contribution in fields, leave transactions empty (a contribution is not money in), and set period_start / period_end to the first and last month shown.
- payslip is null unless it is a payslip, else {"employer", "gross_pay", "total_deductions", "net_pay"} (numbers or null).
- id_numbers: only on a payslip or SSS record, the worker's government ID numbers exactly as printed, as [{"type": "sss" | "philhealth" | "pagibig" | "tin", "value": "05-1234567-8"}]. (They are only used to check one person isn't on several accounts and are never shown or stored; the "never copy a full ID number" rule is for fields.) Empty for other documents.

Reply with ONLY a json object in exactly this shape (values here are just an example):
${JSON.stringify(EXAMPLE_JSON)}`;

const round2 = (n: number) => Math.round(n * 100) / 100;
const monthKey = (date: string) => (/^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : null);
const dayOf = (date: string) => (/^\d{4}-\d{2}-\d{2}/.test(date) ? Number(date.slice(8, 10)) : null);
const median = (xs: number[]) => {
   if (!xs.length) return null;
   const s = [...xs].sort((a, b) => a - b);
   return s[Math.floor(s.length / 2)];
};

/** Money in/out, balances and regular deposits (with their usual day of the month), from the rows. Pure. */
export const computeMetrics = (doc: Extracted): Metrics => {
   const tx = doc.transactions;
   const months = new Set(tx.map((t) => monthKey(t.date)).filter(Boolean));
   const spanMonths = (() => {
      if (doc.period_start && doc.period_end) {
         const days = (Date.parse(doc.period_end) - Date.parse(doc.period_start)) / 86_400_000;
         if (Number.isFinite(days) && days > 0) return Math.max(0.25, days / 30.4);
      }
      return Math.max(1, months.size);
   })();
   const credits = tx.map((t, i) => ({ ...t, ref: `T${i + 1}` })).filter((t) => t.amount > 0);
   const totalIn = credits.reduce((s, t) => s + t.amount, 0);
   const totalOut = tx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
   const balances = tx.map((t) => t.balance).filter((b): b is number => typeof b === 'number');

   // Regular deposits: credits within 10% of each other landing in 2+ different months.
   const groups: Array<{ amount: number; months: Set<string>; description: string; refs: string[]; days: number[] }> = [];
   for (const c of credits) {
      const m = monthKey(c.date);
      if (!m || c.amount < 100) continue;
      const day = dayOf(c.date);
      const g = groups.find((x) => Math.abs(x.amount - c.amount) <= x.amount * 0.1);
      if (g) {
         g.months.add(m);
         g.refs.push(c.ref);
         if (day) g.days.push(day);
      } else groups.push({ amount: c.amount, months: new Set([m]), description: c.description, refs: [c.ref], days: day ? [day] : [] });
   }
   const regular = groups
      .filter((g) => g.months.size >= 2)
      .map((g) => ({ amount: round2(g.amount), months: g.months.size, description: g.description, refs: g.refs, payday: median(g.days) }))
      .sort((a, b) => b.amount * b.months - a.amount * a.months)
      .slice(0, 5);

   const largest = credits.reduce<(typeof credits)[number] | null>((best, t) => (!best || t.amount > best.amount ? t : best), null);

   return {
      months_covered: round2(spanMonths),
      transaction_count: tx.length,
      total_in: round2(totalIn),
      total_out: round2(totalOut),
      monthly_in: round2(totalIn / Math.max(1, spanMonths)),
      monthly_out: round2(totalOut / Math.max(1, spanMonths)),
      average_balance: balances.length ? round2(balances.reduce((s, b) => s + b, 0) / balances.length) : null,
      lowest_balance: balances.length ? Math.min(...balances) : null,
      regular_deposits: regular,
      largest_in: largest && totalIn > 0 ? { amount: largest.amount, share: round2(largest.amount / totalIn), ref: largest.ref } : null,
      net_pay: doc.payslip?.net_pay ?? null
   };
};

const nameTokens = (name: string | null | undefined) =>
   new Set(
      (name ?? '')
         .toLowerCase()
         .normalize('NFD')
         .replace(/[̀-ͯ]/g, '')
         .split(/[^a-z]+/)
         .filter((t) => t.length > 1)
   );

/** True when two names share at least two words (or the only word of a one-word name). */
export const namesMatch = (a: string | null | undefined, b: string | null | undefined) => {
   const x = nameTokens(a);
   const y = nameTokens(b);
   if (!x.size || !y.size) return true;
   const shared = [...x].filter((t) => y.has(t)).length;
   return shared >= Math.min(2, x.size, y.size);
};

export type PdfInfo = { encrypted: boolean; producer: string | null; creator: string | null; created: string | null; modified: string | null };

/** Best-effort read of the PDF info dictionary (plain-text trailer only; compressed ones read as null). */
export const readPdfInfo = (bytes: Uint8Array): PdfInfo => {
   const text = new TextDecoder('latin1').decode(bytes);
   const pick = (key: string) => text.match(new RegExp(`/${key}\\s*\\(([^)]{0,200})\\)`))?.[1]?.trim() ?? null;
   return {
      encrypted: /\/Encrypt\s/.test(text),
      producer: pick('Producer'),
      creator: pick('Creator'),
      created: pick('CreationDate'),
      modified: pick('ModDate')
   };
};

const EDITOR_RE = /photoshop|canva|illustrator|gimp|ilovepdf|smallpdf|sejda|pdfescape|pdf-?xchange|foxit phantom|word|wps|libreoffice|google docs|inkscape|affinity|pixelmator|picsart/i;

export type FileFacts = { name: string; image: ImageInfo | null; markers: ReturnType<typeof fileMarkers> };

// ---- Steps (credit ladder) --------------------------------------------------------------------
// The more someone asks for, the more we need. Same rules as src/lib/incomeDocSteps.ts (the loan
// form); the list lives in telegram_bot_settings.income_doc_tiers.
export type IncomeDocStep = {
   min: number;
   months: number;
   fresh: boolean;
   autoApprove: boolean;
   maxShare: number | null;
   balance: boolean;
   liveCall: boolean;
};

export const parseSteps = (raw: unknown): IncomeDocStep[] =>
   (Array.isArray(raw) ? raw : [])
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && Number((x as Record<string, unknown>).min) > 0)
      .map((x) => ({
         min: Number(x.min),
         months: Number(x.months) || 0,
         fresh: x.fresh === true,
         autoApprove: x.autoApprove === true,
         maxShare: typeof x.maxShare === 'number' ? x.maxShare : null,
         balance: x.balance === true,
         liveCall: x.liveCall === true
      }))
      .sort((a, b) => a.min - b.min);

/**
 * Above the auto-approve steps: approve without the team only when the AI is confident. Off unless
 * telegram_bot_settings.income_doc_ai_auto is set, e.g. {"maxUsd":60,"minScore":80}. Every check must
 * pass (looks_good), every AI opinion must say lend (at least 2 of them), the score must reach minScore and
 * the amount asked must be known and at most maxUsd. The score is NOT calibrated yet: keep this strict.
 */
export type AiAutoRule = { maxUsd: number; minScore: number };
export const parseAiAutoRule = (raw: string | null | undefined): AiAutoRule | null => {
   try {
      const x = JSON.parse(String(raw ?? '')) as Record<string, unknown>;
      const maxUsd = Number(x?.maxUsd);
      const minScore = Number(x?.minScore);
      return maxUsd > 0 && minScore > 0 && minScore <= 100 ? { maxUsd, minScore } : null;
   } catch {
      return null;
   }
};
export const aiAutoApproves = (
   rule: AiAutoRule | null,
   o: { verdict: Verdict; votes: string[] | null; score: number; askedAmount: number | null }
): boolean =>
   !!rule &&
   o.verdict === 'looks_good' &&
   !!o.votes &&
   o.votes.length >= 2 &&
   o.votes.every((v) => v === 'lend') &&
   o.score >= rule.minScore &&
   o.askedAmount != null &&
   Number.isFinite(o.askedAmount) &&
   o.askedAmount <= rule.maxUsd;

export const stepFor = (amount: number | null, steps: IncomeDocStep[]) =>
   amount != null && Number.isFinite(amount) ? ([...steps].reverse().find((x) => amount >= x.min) ?? null) : null;

export type CheckContext = {
   /** The step for the amount they're asking (null: no amount known — the old $60 rules apply). */
   step?: IncomeDocStep | null;
   pdfs: PdfInfo[];
   /** Per file: image size and hidden tags (fileForensics.ts). */
   files?: FileFacts[];
   /** Other accounts' documents sharing this history's rows: share of our rows they also have. */
   rowMatches?: Array<{ user_id: string; share: number }>;
   duplicateOf: Array<{ user_id: string }>;
   /** How many other accounts sent a document with one of the same government ID numbers (id_hashes). */
   idMatches?: number;
   /** Their own other recent sends (a payslip checks their histories, a history checks their payslips). */
   otherDocs?: Array<Pick<Extracted, 'doc_type' | 'institution' | 'currency' | 'period_start' | 'period_end' | 'payslip' | 'transactions'>>;
   kycName: string | null;
   statedMonthlyIncome: number | null;
   loan: LoanContext | null;
   now?: number;
};

/** What the document shows coming in per month, in USD (net pay, else the main regular deposit, else all money in). */
export const monthlyIncomeUsd = (doc: Extracted, metrics: Metrics) => {
   const rate = PER_USD[(doc.currency ?? 'PHP').toUpperCase()];
   if (!rate) return null;
   const monthly = metrics.net_pay ?? (metrics.regular_deposits[0]?.amount || metrics.monthly_in);
   return monthly > 0 ? round2(monthly / rate) : null;
};

// ---- Cross-checks across their own sends and other accounts --------------------------------------

const HISTORY_TYPES = new Set<Extracted['doc_type']>(['gcash_history', 'maya_history', 'bank_statement']);
const ID_TYPES: Record<string, string> = { sss: 'sss', philhealth: 'philhealth', pagibig: 'pagibig', 'pag-ibig': 'pagibig', hdmf: 'pagibig', tin: 'tin' };

/** Government ID numbers → hashes to compare across accounts (the numbers themselves are never kept). */
export const idKeys = async (ids: Array<{ type: string; value: string }>) => {
   const keys = new Set<string>();
   for (const id of ids) {
      const type = ID_TYPES[id.type.toLowerCase().replace(/\s+/g, '')];
      const digits = id.value.replace(/\D/g, '');
      if (!type || digits.length < 8 || /^(\d)\1+$/.test(digits)) continue;
      const bytes = new TextEncoder().encode(`moodeng-id:${type}:${digits}`);
      keys.add([...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join(''));
   }
   return [...keys];
};

type SalaryDoc = NonNullable<CheckContext['otherDocs']>[number];
const dayMs = (date: string | null) => (date && /^\d{4}-\d{2}-\d{2}/.test(date) ? Date.parse(date.slice(0, 10)) : NaN);

/**
 * Did the payslip's net pay land in a wallet or bank history around payday (3 days before the period
 * ends to 10 days after, within 2%)? Only judged when the history covers that window. Pure.
 */
export const salaryCheck = (payslip: SalaryDoc, history: SalaryDoc): Flag | null => {
   const net = payslip.payslip?.net_pay;
   const end = dayMs(payslip.period_end);
   if (!net || net <= 0 || !Number.isFinite(end)) return null;
   if (payslip.currency && history.currency && payslip.currency.toUpperCase() !== history.currency.toUpperCase()) return null;
   const from = end - 3 * 86_400_000;
   const to = end + 10 * 86_400_000;
   const covers = dayMs(history.period_start) <= from + 3 * 86_400_000 && dayMs(history.period_end) >= end + 7 * 86_400_000;
   const hit = history.transactions.find((t) => {
      const d = dayMs(t.date);
      return t.amount > 0 && d >= from && d <= to && Math.abs(t.amount - net) <= Math.max(net * 0.02, 1);
   });
   const where = history.institution ?? 'their history';
   if (hit) return { code: 'salary_landed', severity: 'info', detail: `Payslip net pay ${net} landed on ${hit.date} in ${where} ✅` };
   if (!covers) return null;
   return {
      code: 'salary_not_landed',
      severity: 'orange',
      detail: `Payslip net pay ${net} (period ending ${payslip.period_end}) doesn't show up in ${where} around payday — paid in cash, or the payslip isn't theirs.`
   };
};

/** The salary check between this send and their other recent sends, whichever way round. Pure. */
export const salaryFlags = (doc: SalaryDoc, others: SalaryDoc[]): Flag[] => {
   const pairs: Array<[SalaryDoc, SalaryDoc]> =
      doc.doc_type === 'payslip'
         ? others.filter((o) => HISTORY_TYPES.has(o.doc_type)).map((h) => [doc, h])
         : HISTORY_TYPES.has(doc.doc_type)
           ? others.filter((o) => o.doc_type === 'payslip').map((p) => [p, doc])
           : [];
   const found = pairs.map(([p, h]) => salaryCheck(p, h)).filter((f): f is Flag => f !== null);
   // One landing anywhere is enough; otherwise report each history that should have shown it.
   const landed = found.find((f) => f.code === 'salary_landed');
   return landed ? [landed] : found.slice(0, 2);
};

/** Does any of their histories cover this payslip's payday? (If not, we ask for one.) Pure. */
export const hasHistoryForPayday = (payslip: SalaryDoc, others: SalaryDoc[]) =>
   others.some((h) => HISTORY_TYPES.has(h.doc_type) && salaryCheck(payslip, h) !== null);

/** Rule checks: edits, identity, and ability to repay. Pure. */
export const runChecks = (doc: Extracted, metrics: Metrics, ctx: CheckContext): Flag[] => {
   const flags: Flag[] = [];
   const tx = doc.transactions;
   const now = ctx.now ?? Date.now();
   const rate = PER_USD[(doc.currency ?? 'PHP').toUpperCase()] ?? null;

   // --- Edits -------------------------------------------------------------------------------------
   if (ctx.duplicateOf.length) {
      flags.push({ code: 'same_file_other_account', severity: 'red', detail: `The exact same file was sent by ${ctx.duplicateOf.length} other account(s).` });
   }
   // When the opening and closing balances are just the first and last rows' (a long history read in
   // batches), this sum is the running-balance check below counted twice, so it's skipped.
   const endsFromRows =
      tx.length > 0 &&
      tx[0].balance != null &&
      tx[tx.length - 1].balance != null &&
      doc.opening_balance === round2((tx[0].balance as number) - tx[0].amount) &&
      doc.closing_balance === tx[tx.length - 1].balance;
   if (doc.opening_balance != null && doc.closing_balance != null && tx.length && !endsFromRows) {
      const expected = doc.opening_balance + tx.reduce((s, t) => s + t.amount, 0);
      if (Math.abs(expected - doc.closing_balance) > 1) {
         flags.push({
            code: 'balance_math',
            severity: 'red',
            detail: `Opening ${doc.opening_balance} + rows = ${round2(expected)}, but closing balance says ${doc.closing_balance}.`
         });
      }
   }
   const breaks: string[] = [];
   for (let i = 1; i < tx.length; i++) {
      const prev = tx[i - 1].balance;
      const cur = tx[i].balance;
      if (prev == null || cur == null) continue;
      // Newest-first exports (GCash) run the other way; accept either direction.
      const forward = Math.abs(prev + tx[i].amount - cur) <= 1;
      const backward = Math.abs(cur + tx[i - 1].amount - prev) <= 1;
      if (!forward && !backward) breaks.push(`T${i + 1}`);
   }
   if (breaks.length) {
      flags.push({
         code: 'running_balance',
         severity: breaks.length > 2 ? 'red' : 'orange',
         detail: `Running balance doesn't add up at ${breaks.slice(0, 6).join(', ')}${breaks.length > 6 ? '…' : ''}.`
      });
   }
   const p = doc.payslip;
   if (p?.gross_pay != null && p.total_deductions != null && p.net_pay != null && Math.abs(p.gross_pay - p.total_deductions - p.net_pay) > 1) {
      flags.push({
         code: 'payslip_math',
         severity: 'red',
         detail: `Gross ${p.gross_pay} − deductions ${p.total_deductions} = ${round2(p.gross_pay - p.total_deductions)}, but net pay says ${p.net_pay}.`
      });
   }
   for (const pdf of ctx.pdfs) {
      const tool = [pdf.producer, pdf.creator].filter(Boolean).join(' / ');
      if (tool && EDITOR_RE.test(tool)) {
         flags.push({ code: 'made_in_editor', severity: 'orange', detail: `PDF was made with ${tool}, not exported by a bank or e-wallet.` });
      }
      // Phone scans (iPhone "Scan Document", Android/scanner apps) are re-saved whenever they're renamed
      // or shared, so a later change date means nothing there; it matters for a bank's own export.
      const phoneScan = /\b(iOS|iPadOS|Android|CamScanner|Adobe Scan|Genius Scan|Microsoft Lens|Scanner)\b/i.test(tool);
      if (pdf.created && pdf.modified && pdf.created.slice(2, 16) !== pdf.modified.slice(2, 16)) {
         flags.push({
            code: 'edited_after_creation',
            severity: phoneScan ? 'info' : 'orange',
            detail: phoneScan
               ? `Phone scan re-saved after it was made (${tool}) — normal for scans.`
               : `PDF was changed after it was made (${pdf.created} → ${pdf.modified}).`
         });
      }
   }
   for (const note of doc.visual_anomalies) flags.push({ code: 'visual_anomaly', severity: 'orange', detail: note });

   // --- Fakes, read from the file itself (no AI) ----------------------------------------------------
   for (const f of ctx.files ?? []) {
      if (f.markers.aiLabel) flags.push({ code: 'ai_label', severity: 'red', detail: `${f.name} is ${f.markers.aiLabel}.` });
      if (f.markers.generator) flags.push({ code: 'ai_generator', severity: 'red', detail: `${f.name} carries a ${f.markers.generator} tag — made with an AI image tool.` });
      if (f.markers.editor) flags.push({ code: 'edited_image', severity: 'orange', detail: `${f.name} was saved by ${f.markers.editor}, not straight from the phone.` });
      if (isAiSize(f.image)) {
         flags.push({
            code: 'ai_image_size',
            severity: 'orange',
            detail: `${f.name} is ${f.image!.width}×${f.image!.height}, a standard AI-image size — no phone screenshot is that size.`
         });
      }
   }
   const copied = (ctx.rowMatches ?? []).filter((m) => m.share >= 0.6);
   if (copied.length && tx.length >= 5) {
      flags.push({
         code: 'same_rows_other_account',
         severity: 'red',
         detail: `${Math.round(Math.max(...copied.map((m) => m.share)) * 100)}% of these transactions also appear in a document from ${copied.length} other account(s) — likely the same history or a reused template.`
      });
   }
   if (doc.doc_type === 'gcash_history') {
      const refs = gcashRefIssues(tx);
      if (refs.repeated.length) {
         flags.push({ code: 'gcash_ref_repeated', severity: 'red', detail: `GCash reference number repeats on different rows (${refs.repeated.slice(0, 2).join(', ')}) — real ones never do.` });
      }
      if (refs.wrongLength.length) {
         flags.push({
            code: 'gcash_ref_format',
            severity: 'orange',
            detail: `${refs.wrongLength.length} of ${refs.found} GCash reference numbers aren't 13 digits (e.g. ${refs.wrongLength[0]}).`
         });
      }
   }

   if (ctx.idMatches) {
      flags.push({
         code: 'same_id_other_account',
         severity: 'red',
         detail: `The same SSS / PhilHealth / Pag-IBIG / TIN number is on a document from ${ctx.idMatches} other account(s) — a shared payslip template or one person on several accounts.`
      });
   }
   flags.push(...salaryFlags(doc, ctx.otherDocs ?? []));

   // --- Identity ----------------------------------------------------------------------------------
   // No ID check yet (proof of income comes before Didit): say so, instead of a ✅ for a name nothing
   // was compared with. recheckIncomeNamesAfterId compares it once Didit has their name.
   if (!ctx.kycName?.trim() && doc.holder_name?.trim()) {
      flags.push({ code: 'name_not_checked', severity: 'info', detail: 'No ID check yet — the name is compared automatically when they finish Didit.' });
   }
   if (!namesMatch(doc.holder_name, ctx.kycName)) {
      flags.push({ code: 'name_mismatch', severity: 'red', detail: `Name on document "${doc.holder_name}" doesn't match the ID name "${ctx.kycName}".` });
   }

   // --- Ability to repay --------------------------------------------------------------------------
   const detectedMonthly = metrics.net_pay ?? (metrics.regular_deposits[0]?.amount || metrics.monthly_in);
   const incomeUsd = monthlyIncomeUsd(doc, metrics);
   if (ctx.statedMonthlyIncome && detectedMonthly > 0 && ctx.statedMonthlyIncome > detectedMonthly * 2) {
      flags.push({
         code: 'income_below_stated',
         severity: 'orange',
         detail: `Said ${ctx.statedMonthlyIncome}/month in their bio; this document shows about ${round2(detectedMonthly)}.`
      });
   }
   // The step sets how much of their monthly income the repayment may take (no step: 30%).
   const maxShare = ctx.step ? ctx.step.maxShare : 0.3;
   if (ctx.loan && incomeUsd && maxShare != null) {
      const share = ctx.loan.total_repayment / incomeUsd;
      if (share > maxShare) {
         flags.push({
            code: 'repayment_vs_income',
            severity: share > Math.max(0.5, maxShare + 0.2) ? 'red' : 'orange',
            detail: `Repayment $${ctx.loan.total_repayment} is ${Math.round(share * 100)}% of ~$${incomeUsd} coming in a month (aim: under ${Math.round(maxShare * 100)}%).`
         });
      }
   }
   const monthsNeeded = ctx.step ? ctx.step.months : 2;
   if (!tx.length && !p?.net_pay && doc.doc_type !== 'business_permit' && doc.doc_type !== 'sss_contributions') {
      flags.push({ code: 'no_income_rows', severity: 'orange', detail: 'No transactions or pay figures could be read.' });
   } else if (tx.length && monthsNeeded > 0 && metrics.months_covered < monthsNeeded - 0.25) {
      flags.push({
         code: 'short_history',
         severity: 'orange',
         detail: `Only ~${Math.round(metrics.months_covered * 4.3)} weeks of history — this loan needs ${monthsNeeded}+ months.`
      });
   }
   if (tx.length && !metrics.regular_deposits.length && !p?.net_pay) {
      flags.push({ code: 'no_regular_income', severity: 'orange', detail: 'No regular (salary-like) deposit across 2+ months.' });
   }
   if (ctx.loan && rate && metrics.average_balance != null) {
      const avgUsd = metrics.average_balance / rate;
      if (avgUsd < ctx.loan.total_repayment) {
         flags.push({
            code: 'balance_below_repayment',
            // From the $100 step the balance has to cover it; below that it's just a note.
            severity: ctx.step?.balance ? 'orange' : 'info',
            detail: `Average balance ~$${round2(avgUsd)} is below the $${ctx.loan.total_repayment} repayment — repayment depends on the next deposit.`
         });
      }
   }
   if (ctx.step?.liveCall) {
      flags.push({ code: 'live_call', severity: 'info', detail: `$${ctx.step.min}+ step: ask them to open GCash and scroll their history live on the call.` });
   }
   const payday = metrics.regular_deposits[0]?.payday ?? null;
   if (payday && ctx.loan?.due_date) {
      const dueDay = dayOf(ctx.loan.due_date);
      // Days from payday to the due date, wrapping the month. Due 0–5 days after payday is ideal.
      const gap = dueDay ? (dueDay - payday + 31) % 31 : null;
      if (gap != null && gap > 5) {
         flags.push({
            code: 'due_far_from_payday',
            severity: 'info',
            detail: `Usually paid around the ${payday}th; loan is due on the ${dueDay}th (${gap} days later). A due date of the ${Math.min(28, payday + 1)}th fits better.`
         });
      }
   }
   if (metrics.largest_in && metrics.largest_in.share > 0.6 && metrics.transaction_count > 3) {
      flags.push({
         code: 'one_big_deposit',
         severity: 'info',
         detail: `${Math.round(metrics.largest_in.share * 100)}% of money in is one deposit [${metrics.largest_in.ref}] — could be a loan or a top-up, not income.`
      });
   }
   if (doc.period_end) {
      const ageDays = (now - Date.parse(doc.period_end)) / 86_400_000;
      if (Number.isFinite(ageDays) && ageDays > 75) {
         flags.push({ code: 'old_document', severity: 'orange', detail: `Period ends ${doc.period_end}, ${Math.round(ageDays)} days ago.` });
      }
   }

   return flags;
};

/**
 * 0–100: how well this document supports repaying. Rule-based starting weights, following Kita's
 * published ranking (regular income on statements > cash flow & balances > payslip > ID). Re-weight
 * once ~30 loans above $60 have come due and we can compare scores with what actually happened.
 */
export const scoreOf = (doc: Extracted, metrics: Metrics, all: Flag[]) => {
   const flags = gating(all);
   let score = 50;
   if (metrics.regular_deposits.length || doc.payslip?.net_pay) score += 20;
   if (metrics.months_covered >= 2) score += 10;
   const has = (code: string) => flags.find((f) => f.code === code);
   const afford = has('repayment_vs_income');
   score += afford ? (afford.severity === 'red' ? -15 : 0) : 15;
   if (!has('balance_below_repayment') && metrics.average_balance != null) score += 5;
   for (const f of flags) {
      if (f.code === 'repayment_vs_income') continue;
      if (f.severity === 'red') score -= 35;
      else if (f.severity === 'orange') score -= 10;
   }
   // An edited file or someone else's document can't be outweighed by good-looking numbers in it.
   if (flags.some((f) => f.severity === 'red' && f.code !== 'repayment_vs_income')) score = Math.min(score, 30);
   return Math.max(0, Math.min(100, score));
};

const money = (n: number | null | undefined, currency: string) => (n == null ? '—' : `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

/** Short underwriter memo. Every figure names its source row ([T4]) or field. Pure. */
export const buildMemo = (doc: Extracted, metrics: Metrics, flags: Flag[]): string => {
   const cur = (doc.currency ?? 'PHP').toUpperCase();
   const lines: string[] = [];
   const period = doc.period_start || doc.period_end ? ` · ${doc.period_start ?? '?'} → ${doc.period_end ?? '?'}` : '';
   lines.push(`${doc.doc_type.replace(/_/g, ' ')}${doc.institution ? ` (${doc.institution})` : ''} for ${doc.holder_name ?? 'unknown name'}${period}`);
   if (doc.payslip?.net_pay != null) {
      lines.push(
         `Net pay ${money(doc.payslip.net_pay, cur)} (gross ${money(doc.payslip.gross_pay, cur)}, deductions ${money(doc.payslip.total_deductions, cur)})${doc.payslip.employer ? ` from ${doc.payslip.employer}` : ''}.`
      );
   }
   if (metrics.transaction_count) {
      lines.push(`${metrics.transaction_count} transactions over ~${metrics.months_covered} months: ${money(metrics.monthly_in, cur)}/month in, ${money(metrics.monthly_out, cur)}/month out.`);
      if (metrics.average_balance != null) lines.push(`Average balance ${money(metrics.average_balance, cur)}, lowest ${money(metrics.lowest_balance, cur)}.`);
      for (const r of metrics.regular_deposits.slice(0, 2)) {
         lines.push(`Regular deposit ~${money(r.amount, cur)} in ${r.months} months${r.payday ? `, around the ${r.payday}th` : ''} ("${r.description}") [${r.refs.slice(0, 4).join(', ')}].`);
      }
   }
   const shown = flags.filter((f) => f.severity !== 'info');
   lines.push(shown.length ? shown.map((f) => `${f.severity === 'red' ? '🔴' : '🟠'} ${f.detail}`).join('\n') : '✅ Math, file, name and affordability checks passed.');
   for (const f of flags.filter((x) => x.severity === 'info')) lines.push(`ℹ️ ${f.detail}`);
   return lines.join('\n');
};

/**
 * Flags the team sees but that never hold the borrower (George 2026-11-20: "dont block them just give us
 * a flag"). They show on the named checks and in the posts, but don't change risk, score or verdict —
 * those decide whether onboarding goes on by itself (journey_income_check) or auto-approves. Pure.
 */
export const FLAG_ONLY = new Set(['payslip_sent_before_period_end', 'salary_not_landed', 'same_id_other_account', 'name_mismatch_after_id', 'story_mismatch']);
const gating = (flags: Flag[]) => flags.filter((f) => !FLAG_ONLY.has(f.code));

export const riskOf = (all: Flag[]): 'green' | 'orange' | 'red' => {
   const flags = gating(all);
   return flags.some((f) => f.severity === 'red') ? 'red' : flags.some((f) => f.severity === 'orange') ? 'orange' : 'green';
};

// ---- Verdict (Didit-style) ---------------------------------------------------------------------
// Every send ends with one verdict, plus a list of named checks that each pass, warn or fail:
//   resend        a problem the borrower can fix (blurry, locked PDF, wrong document, too old, too
//                 short, no money in). They're told right away what to send instead; no team decision.
//   needs_review  anything that could be a fake, someone else's document or a repayment risk. Never
//                 explained to the borrower — the team decides.
//   looks_good    every check passed. The team's call, unless a step or income_doc_ai_auto approves it.

export type Verdict = 'resend' | 'needs_review' | 'looks_good';
export type ResendReason = 'password_protected' | 'scanned_pdf' | 'unsupported_file' | 'unreadable' | 'not_financial' | 'old_document' | 'short_history' | 'no_income';

/** What the borrower is told to fix, in their words. */
export const RESEND_TEXT: Record<ResendReason, string> = {
   password_protected: 'Your PDF is locked with a password, so we can’t open it. Please send screenshots of your history instead.',
   scanned_pdf: 'We couldn’t read your PDF. Please send screenshots of your history instead.',
   unsupported_file: 'We couldn’t open that photo type. Please send a screenshot or a JPG/PNG photo instead.',
   unreadable: 'We couldn’t read it clearly. Please retake it in good light with all 4 corners showing and the numbers sharp.',
   not_financial: 'This doesn’t look like proof of income. Please send one of the examples shown: a payslip, your earnings screen, or your GCash or Maya history.',
   old_document: 'This is more than 2 months old. Please send your latest one.',
   short_history: 'This doesn’t show enough history for the amount you’re asking. Please send your last 2–3 months.',
   no_income: 'We couldn’t see money coming in. Please send a history or statement that shows the money you receive.'
};

export type CheckSection = { key: string; label: string; status: 'pass' | 'warn' | 'fail' | 'skip'; notes: string[] };

// Which flag belongs to which named check. Anything that could mean a fake is in FAKE_SECTIONS.
const SECTIONS: Array<{ key: string; label: string; codes: string[] }> = [
   { key: 'authentic', label: 'Not edited', codes: ['balance_math', 'running_balance', 'payslip_math', 'made_in_editor', 'edited_after_creation', 'visual_anomaly', 'edited_image', 'payslip_sent_before_period_end'] },
   { key: 'not_ai', label: 'Not AI-made', codes: ['ai_label', 'ai_generator', 'ai_image_size', 'gcash_ref_repeated', 'gcash_ref_format'] },
   { key: 'identity', label: 'Name matches ID', codes: ['name_mismatch', 'name_not_checked', 'name_mismatch_after_id', 'name_matched_after_id'] },
   { key: 'unique', label: 'Not used by another account', codes: ['same_file_other_account', 'same_rows_other_account', 'same_id_other_account'] },
   { key: 'recent', label: 'Recent and 2+ months', codes: ['old_document', 'short_history'] },
   { key: 'income', label: 'Regular income', codes: ['no_income_rows', 'no_regular_income', 'income_below_stated', 'one_big_deposit', 'salary_landed', 'salary_not_landed'] },
   { key: 'afford', label: 'Can afford the repayment', codes: ['repayment_vs_income', 'balance_below_repayment', 'due_far_from_payday', 'live_call'] }
];
const FAKE_SECTIONS = new Set(['authentic', 'not_ai', 'identity', 'unique']);

/**
 * Named checks for the admin card, with the first one ("Readable") from the read itself. When the
 * document couldn't be read, checks that need its contents show 'skip' (not checked) instead of a
 * misleading pass; file-level findings (AI tags) still show. Pure.
 */
export const buildSections = (flags: Flag[], read: { ok: boolean; note?: string }): CheckSection[] => [
   { key: 'readable', label: 'Readable', status: read.ok ? 'pass' : 'fail', notes: read.note ? [read.note] : [] },
   ...SECTIONS.map(({ key, label, codes }) => {
      const mine = flags.filter((f) => codes.includes(f.code));
      const status: CheckSection['status'] = mine.some((f) => f.severity === 'red')
         ? 'fail'
         : mine.some((f) => f.severity === 'orange')
           ? 'warn'
           : read.ok && !mine.some((f) => f.code === 'name_not_checked')
             ? 'pass'
             : 'skip';
      return { key, label, status, notes: mine.map((f) => f.detail) };
   })
];

/** The verdict for a send that was read. Fake signs always win over a fixable problem. Pure. */
export const verdictOf = (flags: Flag[], docType: Extracted['doc_type']): { verdict: Verdict; reason: ResendReason | null } => {
   // Not a financial document at all (a cartoon, a selfie): telling them so gives nothing away, so
   // they're asked for a real one even if it also carries fake signs — the team still sees those.
   if (docType === 'other') return { verdict: 'resend', reason: 'not_financial' };
   const fakeCodes = new Set(SECTIONS.filter((x) => FAKE_SECTIONS.has(x.key)).flatMap((x) => x.codes));
   const serious = gating(flags).filter((f) => f.severity !== 'info');
   if (serious.some((f) => fakeCodes.has(f.code))) return { verdict: 'needs_review', reason: null };
   const has = (code: string) => serious.some((f) => f.code === code);
   if (has('no_income_rows')) return { verdict: 'resend', reason: 'no_income' };
   if (has('old_document')) return { verdict: 'resend', reason: 'old_document' };
   if (has('short_history')) return { verdict: 'resend', reason: 'short_history' };
   return { verdict: serious.length ? 'needs_review' : 'looks_good', reason: null };
};

const VERDICT_LINE: Record<Verdict, string> = {
   resend: '↩️ Asked them to resend',
   needs_review: '⚠️ Needs your review',
   looks_good: '✅ Looks good — approve?'
};

const toBase64 = (bytes: Uint8Array) => {
   let binary = '';
   for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
   return btoa(binary);
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type LoadedFile = { name: string; mime: string; bytes: Uint8Array<ArrayBuffer> };

type ChatPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' } };

/** One DeepSeek chat call in JSON mode. Blank or broken JSON (their JSON mode blanks invalid output) is retried once. */
const deepseekJson = async <T>(
   apiKey: string,
   system: string,
   content: string | ChatPart[],
   maxTokens: number,
   opts: { model?: string; thinking?: boolean; timeoutMs?: number; feature?: string } = {}
): Promise<T> => {
   for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(DEEPSEEK_URL, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
         ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
         body: JSON.stringify({
            model: opts.model ?? MODEL,
            thinking: { type: opts.thinking ? 'enabled' : 'disabled' },
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
            messages: [
               { role: 'system', content: withToday(system) },
               { role: 'user', content }
            ]
         })
      });
      if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
      logAiUsage(opts.feature ?? 'income_doc', opts.model ?? MODEL, chatTokens(body));
      const choice = body.choices?.[0];
      if (choice?.finish_reason === 'length') throw new Error(TOO_LONG);
      const text = choice?.message?.content?.trim();
      if (text) {
         try {
            return JSON.parse(text) as T;
         } catch {
            // fall through to the retry
         }
      }
   }
   throw new Error('model returned no usable json');
};

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v.replace(/,/g, ''))) ? Number(v.replace(/,/g, '')) : null);
const strOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const DOC_TYPES = new Set(['gcash_history', 'maya_history', 'bank_statement', 'payslip', 'remittance', 'business_permit', 'gig_earnings', 'seller_payout', 'freelance_earnings', 'sss_contributions', 'other']);

/** Make whatever came back match Extracted exactly (JSON mode has no schema). Pure. */
export const normalizeExtracted = (raw: Record<string, unknown>): Extracted => {
   const p = raw.payslip as Record<string, unknown> | null | undefined;
   return {
      readable: raw.readable !== false,
      unreadable_reason: strOrNull(raw.unreadable_reason),
      doc_type: (DOC_TYPES.has(String(raw.doc_type)) ? raw.doc_type : 'other') as Extracted['doc_type'],
      holder_name: strOrNull(raw.holder_name),
      institution: strOrNull(raw.institution),
      currency: strOrNull(raw.currency),
      period_start: strOrNull(raw.period_start),
      period_end: strOrNull(raw.period_end),
      opening_balance: numOrNull(raw.opening_balance),
      closing_balance: numOrNull(raw.closing_balance),
      payslip: p && typeof p === 'object' ? { employer: strOrNull(p.employer), gross_pay: numOrNull(p.gross_pay), total_deductions: numOrNull(p.total_deductions), net_pay: numOrNull(p.net_pay) } : null,
      fields: arr<Record<string, unknown>>(raw.fields).map((f) => ({
         key: String(f.key ?? ''),
         label: String(f.label ?? f.key ?? ''),
         value: String(f.value ?? ''),
         page: Number(f.page) || 1,
         source_text: String(f.source_text ?? '')
      })),
      transactions: arr<Record<string, unknown>>(raw.transactions)
         .map((t) => ({
            date: String(t.date ?? ''),
            description: String(t.description ?? ''),
            amount: numOrNull(t.amount) ?? NaN,
            balance: numOrNull(t.balance),
            page: Number(t.page) || 1,
            source_text: String(t.source_text ?? '')
         }))
         .filter((t) => Number.isFinite(t.amount)),
      visual_anomalies: arr<unknown>(raw.visual_anomalies).map(String).filter(Boolean),
      id_numbers: arr<Record<string, unknown>>(raw.id_numbers).map((x) => ({ type: String(x.type ?? '').toLowerCase(), value: String(x.value ?? '') }))
   };
};

/** PDF → its text layer, page by page. Scanned PDFs have none; those come back empty. */
const pdfText = async (bytes: Uint8Array<ArrayBuffer>) => {
   const pdf = await getDocumentProxy(new Uint8Array(bytes));
   const { text } = await extractText(pdf, { mergePages: false });
   return (text as string[]).map((t) => t.trim());
};

/**
 * The page photos inside a scanned PDF (iPhone "Scan Document", scanner apps): each page is usually
 * one JPEG stored as-is (/Filter /DCTDecode), so its bytes can be taken out and read as an image.
 * Pure; returns [] when there are none (e.g. compressed object streams).
 */
export const pdfJpegs = (bytes: Uint8Array, max = 6): Uint8Array[] => {
   const text = new TextDecoder('latin1').decode(bytes);
   const found: Uint8Array[] = [];
   const re = /<<([^]*?)>>\s*stream\r?\n/g;
   for (let m = re.exec(text); m && found.length < max; m = re.exec(text)) {
      const dict = m[1];
      if (!/\/Subtype\s*\/Image/.test(dict) || !/\/Filter\s*\/DCTDecode/.test(dict)) continue;
      const start = m.index + m[0].length;
      const declared = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
      const end = declared ? start + Number(declared[1]) : text.indexOf('endstream', start);
      if (end <= start || end > bytes.length) continue;
      const jpeg = bytes.subarray(start, end);
      // Small images are logos and icons, not pages.
      if (jpeg[0] === 0xff && jpeg[1] === 0xd8 && jpeg.length > 50_000) found.push(jpeg);
   }
   return found;
};

/**
 * Several reads of one send (a long history split into batches of screenshots) → one document. Rows
 * that show up twice because screenshots overlap are kept once. Pure.
 */
export const mergeExtracted = (parts: Extracted[]): Extracted => {
   const read = parts.filter((p) => p.readable);
   if (!read.length) return parts[0];
   const first = <K extends keyof Extracted>(k: K) => read.map((p) => p[k]).find((v) => v !== null && v !== undefined) ?? null;
   const typed = read.map((p) => p.doc_type).filter((t) => t !== 'other');
   // Overlapping screenshots repeat rows, and two reads word a row differently, so a row with a running
   // balance is the same row when date, amount and balance match; without a balance, the wording decides.
   const seen = new Set<string>();
   const transactions = read
      .flatMap((p) => p.transactions)
      .filter((t) => {
         const key = t.balance != null ? `${t.date}|${t.amount}|${t.balance}` : `${t.date}|${t.amount}||${t.description.trim().toLowerCase()}`;
         if (seen.has(key)) return false;
         seen.add(key);
         return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      // A row read twice from an overlap, with a wrong amount, breaks the running balance where the rows
      // either side of it join up exactly: that row is the misread copy, so it's dropped.
      .filter((t, i, all) => {
         const prev = all[i - 1];
         const next = all[i + 1];
         if (!prev || !next || prev.balance == null || t.balance == null || next.balance == null) return true;
         const fits = Math.abs(prev.balance + t.amount - t.balance) <= 1;
         const joinsWithout = Math.abs(prev.balance + next.amount - next.balance) <= 1;
         return fits || !joinsWithout;
      });
   // Balances at the ends come from the rows themselves (which read covered which end isn't known).
   const firstRow = transactions[0];
   const lastRow = transactions[transactions.length - 1];
   const dates = read.flatMap((p) => [p.period_start, p.period_end]).filter((d): d is string => Boolean(d)).sort();
   return {
      readable: true,
      unreadable_reason: null,
      doc_type: typed[0] ?? 'other',
      holder_name: first('holder_name') as string | null,
      institution: first('institution') as string | null,
      currency: first('currency') as string | null,
      period_start: dates[0] ?? null,
      period_end: dates[dates.length - 1] ?? null,
      opening_balance: firstRow?.balance != null ? round2(firstRow.balance - firstRow.amount) : read[0].opening_balance,
      closing_balance: lastRow?.balance != null ? lastRow.balance : read[read.length - 1].closing_balance,
      payslip: first('payslip') as Extracted['payslip'],
      fields: read.flatMap((p) => p.fields),
      transactions,
      visual_anomalies: [...new Set(read.flatMap((p) => p.visual_anomalies))],
      id_numbers: read.flatMap((p) => p.id_numbers ?? [])
   };
};

const extract = async (apiKey: string, files: LoadedFile[]): Promise<Extracted> => {
   // One entry per page (a screenshot, a PDF page's text, a scanned page's photo), each already
   // labelled with its page number across the whole send.
   const pages: ChatPart[][] = [];
   const unreadable: string[] = [];
   for (const f of files) {
      if (f.mime === 'application/pdf') {
         const texts = await pdfText(f.bytes).catch(() => [] as string[]);
         if (texts.some((t) => t.length > 40)) {
            for (const t of texts) pages.push([{ type: 'text', text: `--- page ${pages.length + 1} (from ${f.name}, PDF text) ---\n${t}` }]);
            continue;
         }
         // No text: a scan. Read the page photos inside it instead.
         const scans = pdfJpegs(f.bytes);
         if (!scans.length) {
            unreadable.push(f.name);
            continue;
         }
         for (const jpeg of scans) {
            pages.push([
               { type: 'text', text: `--- page ${pages.length + 1} (from ${f.name}, scanned page) ---` },
               { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${toBase64(jpeg)}`, detail: 'high' } }
            ]);
         }
      } else {
         pages.push([
            { type: 'text', text: `--- page ${pages.length + 1} (${f.name}, image) ---` },
            { type: 'image_url', image_url: { url: `data:${f.mime};base64,${toBase64(f.bytes)}`, detail: 'high' } }
         ]);
      }
   }
   // Only throw when nothing at all could be read; one bad PDF shouldn't sink the others.
   if (!pages.length) throw new Error(`${unreadable.join(', ')} is a scanned PDF with no text — ask for screenshots`);

   const read = (batch: ChatPart[][], of: string) =>
      deepseekJson<Record<string, unknown>>(
         apiKey,
         SYSTEM,
         [...batch.flat(), { type: 'text', text: `Read ${of} as one person's proof of income. Keep the page numbers printed above each page. Reply in json.` }],
         16000,
         { feature: 'income_read' }
      ).then(normalizeExtracted);

   // Up to 3 pages: one read, so the model sees them together. More (a long history, many screenshots
   // full of rows) can run past one answer's length (Nov 11: 5 GoTyme screenshots), so read 2 pages
   // at a time, all at once, splitting a batch that is still too long; then merge the rows.
   if (pages.length <= 3) {
      try {
         return await read(pages, `these ${pages.length} page(s)`);
      } catch (err) {
         if (!(err instanceof Error) || err.message !== TOO_LONG || pages.length < 2) throw err;
      }
   }
   const readBatch = async (from: number, batch: ChatPart[][]): Promise<Extracted[]> => {
      try {
         const doc = await read(batch, `pages ${from + 1}–${from + batch.length} of ${pages.length} (the others are read separately)`);
         // The model may count pages from 1 again within a batch: put them back in the whole send's numbering.
         const page = (n: number) => (n >= 1 && n <= batch.length ? from + n : n);
         return [{ ...doc, transactions: doc.transactions.map((t) => ({ ...t, page: page(t.page) })), fields: doc.fields.map((f) => ({ ...f, page: page(f.page) })) }];
      } catch (err) {
         if (!(err instanceof Error) || err.message !== TOO_LONG || batch.length < 2) throw err;
         return (await Promise.all(batch.map((page, j) => readBatch(from + j, [page])))).flat();
      }
   };
   const batches: Array<Promise<Extracted[]>> = [];
   for (let i = 0; i < pages.length; i += 2) batches.push(readBatch(i, pages.slice(i, i + 2)));
   return mergeExtracted((await Promise.all(batches)).flat());
};

/** What the pre-screening (no account yet, _shared/preScreening.ts) keeps from a proof-of-income read. */
export type IncomeProofRead = {
   readable: boolean;
   problem: string | null;
   doc_type: Extracted['doc_type'] | null;
   holder_name: string | null;
   institution: string | null;
   currency: string | null;
   period_start: string | null;
   period_end: string | null;
   months_covered: number | null;
   transactions: number;
   monthly_in: number | null;
   monthly_income_usd: number | null;
   net_pay: number | null;
   warnings: string[];
};

/**
 * Reads proof-of-income files the same way /documents does (images as images, PDFs by their text or
 * scanned pages), without an income_documents row, a user, or any message. Never throws: a file it
 * can't open comes back as readable=false with the reason.
 */
export const readIncomeProof = async (apiKey: string, files: Array<{ name: string; mime: string; bytes: Uint8Array<ArrayBuffer> }>): Promise<IncomeProofRead> => {
   const warnings: string[] = [];
   const loaded: LoadedFile[] = [];
   for (const f of files) {
      const markers = fileMarkers(f.bytes);
      if (markers.aiLabel) warnings.push(`${f.name} is ${markers.aiLabel}`);
      if (markers.generator) warnings.push(`${f.name} carries a ${markers.generator} tag`);
      if (f.mime === 'application/pdf') {
         if (readPdfInfo(f.bytes).encrypted) {
            warnings.push(`${f.name} is a password-protected PDF`);
            continue;
         }
      } else if (!IMAGE_TYPES.has(f.mime)) {
         warnings.push(`${f.name}: file type the AI can’t open`);
         continue;
      }
      loaded.push(f);
   }
   const empty = (problem: string): IncomeProofRead => ({
      readable: false,
      problem,
      doc_type: null,
      holder_name: null,
      institution: null,
      currency: null,
      period_start: null,
      period_end: null,
      months_covered: null,
      transactions: 0,
      monthly_in: null,
      monthly_income_usd: null,
      net_pay: null,
      warnings
   });
   if (!loaded.length) return empty('no file the AI can open');
   let doc: Extracted;
   try {
      doc = await extract(apiKey, loaded);
   } catch (err) {
      return empty(err instanceof Error ? err.message.slice(0, 200) : String(err));
   }
   if (!doc.readable) return empty(doc.unreadable_reason ?? 'could not read it');
   const metrics = computeMetrics(doc);
   return {
      readable: true,
      problem: null,
      doc_type: doc.doc_type,
      holder_name: doc.holder_name,
      institution: doc.institution,
      currency: doc.currency,
      period_start: doc.period_start,
      period_end: doc.period_end,
      months_covered: metrics.months_covered,
      transactions: metrics.transaction_count,
      monthly_in: round2(metrics.monthly_in),
      monthly_income_usd: monthlyIncomeUsd(doc, metrics),
      net_pay: metrics.net_pay,
      warnings: [...warnings, ...doc.visual_anomalies.map((a) => `looks edited: ${a}`)].slice(0, 8)
   };
};

// repayChance: the AI's 0–100 estimate that they repay this loan in full by the due date (George
// 2026-11-21: save a real prediction so the weekly report can check the AI against what happened).
export type AiOpinion = {
   verdict: 'lend' | 'maybe' | 'decline';
   note: string;
   ask: string[];
   repayChance?: number | null;
   reasons?: string[];
   /** Concrete things that don't fit across their sources (job typed, job photo, answers, call, document, ID). */
   mismatches?: string[];
};
/** Several opinions on the same send, combined into one direction. */
export type AiDirection = {
   direction: 'LEND' | 'LEAN LEND' | 'MAYBE' | 'LEAN DECLINE' | 'DECLINE';
   votes: AiOpinion['verdict'][];
   note: string;
   ask: string[];
   /** Average of the reads' chances (0–100), or null when none gave one. */
   repayChance: number | null;
   /** Up to 2 short reasons, from the read closest to that average. */
   reasons: string[];
   /** Story mismatches, only when most reads found some (one jumpy read can't flag anyone). */
   mismatches: string[];
};

const VOTE: Record<AiOpinion['verdict'], number> = { lend: 1, maybe: 0, decline: -1 };

/**
 * One reading of the evidence can swing (the same screenshots got MAYBE, then DECLINE). Several
 * independent opinions are averaged into a direction (lend = +1, maybe = 0, decline = −1): all
 * one way → LEND / DECLINE, a tilt → LEAN …, split → MAYBE. The note shown is from the opinion closest to
 * that average; the questions are pooled. Pure.
 */
export const combineOpinions = (opinions: AiOpinion[]): AiDirection | null => {
   if (!opinions.length) return null;
   const mean = opinions.reduce((s, o) => s + VOTE[o.verdict], 0) / opinions.length;
   const direction: AiDirection['direction'] =
      mean >= 0.8 ? 'LEND' : mean > 0.15 ? 'LEAN LEND' : mean <= -0.8 ? 'DECLINE' : mean < -0.15 ? 'LEAN DECLINE' : 'MAYBE';
   const closest = [...opinions].sort((a, b) => Math.abs(VOTE[a.verdict] - mean) - Math.abs(VOTE[b.verdict] - mean))[0];
   const ask = [...new Set([closest, ...opinions].flatMap((o) => o.ask))].slice(0, 2);
   const chances = opinions.map((o) => o.repayChance).filter((c): c is number => typeof c === 'number');
   const repayChance = chances.length ? Math.round(chances.reduce((a, b) => a + b, 0) / chances.length) : null;
   const byChance = repayChance == null ? [] : [...opinions].filter((o) => o.reasons?.length).sort((a, b) => Math.abs((a.repayChance ?? 0) - repayChance) - Math.abs((b.repayChance ?? 0) - repayChance));
   const withMismatch = opinions.filter((o) => o.mismatches?.length);
   const mismatches = withMismatch.length * 2 > opinions.length ? (withMismatch.find((o) => o === closest) ?? withMismatch[0]).mismatches!.slice(0, 3) : [];
   return {
      direction,
      votes: opinions.map((o) => o.verdict),
      note: closest.note,
      ask,
      repayChance,
      reasons: (byChance[0]?.reasons ?? closest.reasons ?? []).slice(0, 2),
      mismatches
   };
};


/**
 * The lending opinion: what the document shows (numbers, checks) next to who the borrower is — what they
 * told us about their work and income, every loan they've had with us and how it was repaid, and the AI
 * summary of their onboarding call. Help for the team, never a decision. Null when it couldn't be written.
 */
const OPINION_SYSTEM = `You help a small lender decide on loans of $20–$150 to Filipino and Indonesian borrowers, repaid in one payment within about a month. Their target is 90% repaid on time. Be fair to people with low or irregular incomes: small loans for bills, food, medicine or a pay gap are normal here.

You get: the loan they're asking for, what their proof-of-income document shows (money in and out, regular deposits, checks that passed or failed, a score), and the borrower's own record with us: what they told us about their work and income, their past loans (amount, when due, when repaid, days late), and the AI summary of their onboarding video call if there was one. Sometimes also what was said about their earlier documents: take it into account, but judge this send on its own evidence. Sometimes also their own answers to questions we asked them about this document: weigh them, but they are their word, not proof; an answer that contradicts the document is a red flag, and an answer that explains a gap can count in their favour.

Weigh them together: does the document match what they told us and said on the call? Can the money that comes in cover this repayment by the due date? Does their repayment history with us (on time, late, how late) support a bigger or smaller loan? Note any red flag (document contradicts their story, income too small, late before, signs the account isn't theirs).

Check that their story fits across every source you have: the job they typed in pre-screening and their answers there, what their job photo showed, what they told us (work, income), the call summary, the document (whose name, which employer or kind of income, how much), and the name on their ID. List in "mismatches" each concrete thing that does not fit, e.g. "Says teacher, but GCash shows only sari-sari sales" or "Payslip name differs from ID name", at most 3, each at most 15 words. Leave it empty when everything fits or there is too little to compare; a missing source is not a mismatch, and small differences in wording or spelling are fine. A franchise brand and the company that runs that branch are the same employer (says "Generika", payslip is from "Alioa Drugstore OPC" with the Generika logo = fits). Paid in cash with no GCash or bank history is common for small shops and fits on its own.

Also estimate "repay_chance": a whole number 0–100, your honest chance that THIS borrower repays THIS loan in full by the due date. For reference, about 83% of this lender's loans so far were repaid on time; move up or down from that on the evidence, and don't round to 100 or 0. Give "reasons": the 1–2 things that moved it most, each at most 8 words.

Cite document rows like [T3] when you mention a number from them. Do not invent numbers. Reply with only a json object:
{"verdict": "lend" | "maybe" | "decline", "note": "at most 4 short plain sentences", "ask": ["up to 2 questions for the team to ask them"], "repay_chance": 0-100, "reasons": ["short reason", "short reason"], "mismatches": ["short", "short"]}`;

const writeOpinion = async (apiKey: string, input: Record<string, unknown>): Promise<AiOpinion | null> => {
   type Out = { verdict?: string; note?: string; ask?: unknown; repay_chance?: unknown; reasons?: unknown; mismatches?: unknown };
   const body = JSON.stringify(input);
   // Thinking first (it weighs things better); if that's slow, a quick answer, so the whole check stays
   // inside the edge function's time limit.
   const out = await deepseekJson<Out>(apiKey, OPINION_SYSTEM, body, 6000, { model: OPINION_MODEL, thinking: true, timeoutMs: 45_000, feature: 'income_opinion' }).catch((err) => {
      console.warn('income doc opinion: thinking pass failed, trying without', err instanceof Error ? err.message : err);
      return deepseekJson<Out>(apiKey, OPINION_SYSTEM, body, 1500, { model: OPINION_MODEL, timeoutMs: 25_000, feature: 'income_opinion' });
   });
   const verdict = (['lend', 'maybe', 'decline'].includes(String(out.verdict)) ? String(out.verdict) : 'maybe') as AiOpinion['verdict'];
   const ask = Array.isArray(out.ask) ? out.ask.map(String).filter(Boolean).slice(0, 2) : [];
   const mismatches = Array.isArray(out.mismatches) ? out.mismatches.map((m) => String(m).trim().slice(0, 140)).filter(Boolean).slice(0, 3) : [];
   return out.note ? { verdict, note: String(out.note), ask, ...parseRepayChance(out), mismatches } : null;
};

/** The model's repay_chance (0–100, clamped to 1–99) and up to 2 short reasons. Pure. */
export const parseRepayChance = (out: { repay_chance?: unknown; reasons?: unknown } | null | undefined) => {
   const n = typeof out?.repay_chance === 'number' ? out.repay_chance : Number(out?.repay_chance);
   const repayChance = Number.isFinite(n) ? Math.min(99, Math.max(1, Math.round(n))) : null;
   const reasons = Array.isArray(out?.reasons) ? out!.reasons.map((r) => String(r).trim().slice(0, 80)).filter(Boolean).slice(0, 2) : [];
   return { repayChance, reasons };
};

/** The team line for the AI's repay chance. Pure. */
export const repayChanceLine = (o: Pick<AiDirection, 'repayChance' | 'reasons'>) =>
   o.repayChance == null ? null : `🎯 Chance of repaying on time: ${o.repayChance}%${o.reasons.length ? ` — ${o.reasons.join('; ')}` : ''}`;

const dayDiff = (from: string | null | undefined, to: string | null | undefined) =>
   from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) : null;

/** What we know about the borrower, for the opinion: their own answers, loans with us, and the call summary. No names. */
export const borrowerContext = async (supabase: SupabaseClient, userId: string) => {
   const [{ data: u }, { data: loans }, { data: call }, { data: ps }, { data: kyc }] = await Promise.all([
      supabase
         .from('users')
         .select(
            'created_at, profession, income_type, income_description, monthly_income, monthly_expenses, other_income, payday_type, payday_start, payday_end, market, mal, didit_id_status, video_call_outcome, current_risk_band'
         )
         .eq('id', userId)
         .maybeSingle(),
      supabase
         .from('loans')
         .select('loan_amount, total_repayment_amount, reason, loan_status, repayment_status, created_at, funded_at, due_date, repaid_at, repaid_amount')
         .eq('borrower_user_id', userId)
         .order('created_at', { ascending: true })
         .limit(30),
      supabase
         .from('call_transcripts')
         .select('summary, risk_level, call_started_at')
         .eq('user_id', userId)
         .not('summary', 'is', null)
         .order('call_started_at', { ascending: false })
         .limit(1)
         .maybeSingle(),
      supabase
         .from('pre_screenings')
         .select('name, questions, answers, grade')
         .eq('user_id', userId)
         .not('grade', 'is', null)
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle(),
      supabase
         .from('kyc_identities')
         .select('full_name')
         .eq('user_id', userId)
         .not('full_name', 'is', null)
         .order('session_created_at', { ascending: false })
         .limit(1)
         .maybeSingle()
   ]);
   const now = new Date().toISOString();
   const history = ((loans ?? []) as Array<Record<string, string | number | null>>).map((l) => {
      const repaid = l.repayment_status === 'Paid';
      const late = repaid ? dayDiff(l.due_date as string, l.repaid_at as string) : l.funded_at ? dayDiff(l.due_date as string, now) : null;
      return {
         amount: Number(l.loan_amount),
         repay: Number(l.total_repayment_amount),
         reason: l.reason,
         status: l.loan_status === 'Requested' ? 'asking now' : repaid ? 'repaid' : l.funded_at ? 'open' : String(l.loan_status ?? '').toLowerCase(),
         lent: (l.funded_at as string | null)?.slice(0, 10) ?? null,
         due: (l.due_date as string | null)?.slice(0, 10) ?? null,
         repaid_on: (l.repaid_at as string | null)?.slice(0, 10) ?? null,
         days_late: late != null && late > 0 ? late : 0
      };
   });
   return {
      account_age_days: u?.created_at ? dayDiff(u.created_at, now) : null,
      their_answers: u
         ? {
              work: u.profession,
              income_type: u.income_type,
              income: u.income_description,
              monthly_income: u.monthly_income,
              monthly_expenses: u.monthly_expenses,
              other_income: u.other_income,
              payday: [u.payday_type, u.payday_start, u.payday_end].filter(Boolean).join(' '),
              country: u.market
           }
         : null,
      credit_limit_usd: u?.mal ?? null,
      id_check: u?.didit_id_status ?? null,
      call_outcome: u?.video_call_outcome ?? null,
      risk_band: u?.current_risk_band ?? null,
      loans_with_us: history,
      repaid_count: history.filter((h) => h.status === 'repaid').length,
      late_count: history.filter((h) => h.days_late > 0).length,
      call_summary: call?.summary ? { risk_level: call.risk_level, ...(call.summary as Record<string, unknown>) } : null,
      // For the story check: their pre-screening (job, answers, what the job photo showed) and ID name.
      pre_screening: preScreeningContext(ps),
      id_name: (kyc as { full_name?: string | null } | null)?.full_name ?? null
   };
};

type PsRow = {
   name?: string | null;
   questions?: Array<{ id: string; kind?: string; text?: string; typed_job?: string }> | null;
   answers?: Array<{ q: string; text?: string | null }> | null;
   grade?: { summary?: string; answers?: Array<{ q: string; note?: string; transcript?: string | null; photo_check?: { note?: string } | null }> } | null;
};

/** Their latest graded pre-screening, boiled down for the story check (no files, no scores). Pure. */
export const preScreeningContext = (ps: PsRow | null | undefined) => {
   if (!ps) return null;
   const qText = new Map((ps.questions ?? []).map((q) => [q.id, q.text ?? q.id]));
   const job = (ps.questions ?? []).find((q) => q.kind === 'job')?.typed_job ?? null;
   const typed = (ps.answers ?? [])
      .filter((a) => a.text?.trim() && a.q !== 'medical')
      .map((a) => ({ question: qText.get(a.q) ?? a.q, answer: a.text!.trim().slice(0, 200) }))
      .slice(0, 8);
   const graded = ps.grade?.answers ?? [];
   const photo = graded.filter((a) => a.q.startsWith('job_photo')).map((a) => a.photo_check?.note || a.note).filter(Boolean)[0] ?? null;
   const spoken = graded.filter((a) => a.transcript).map((a) => ({ question: qText.get(a.q) ?? a.q, said: a.transcript!.slice(0, 200) })).slice(0, 4);
   return { name_given: ps.name ?? null, job_typed: job, answers: typed, said_on_video: spoken, job_photo_showed: photo, ai_summary: ps.grade?.summary ?? null };
};

/** The opinion as it goes out in the Telegram reply and the Discord post. Pure. */
export const opinionText = (o: AiDirection) =>
   [
      `🧠 AI opinion: ${o.direction} (${o.votes.length} reads: ${o.votes.join(', ')} · with their history)`,
      repayChanceLine(o),
      o.note,
      ...(o.mismatches ?? []).map((m) => `🔀 Doesn't fit: ${m}`),
      ...o.ask.map((q) => `❓ ${q}`)
   ]
      .filter(Boolean)
      .join('\n');

const OPINION_READS = 3;

/** One AI question as the borrower sees it (income_documents.questions). `team` is the AI's original wording. */
// kind: 'text' = typed answer; 'file' = "can you add more?" (they send new files); 'photo' = one screenshot
// attached as the answer itself (saved as `photo:<storage path>`, see PHOTO_ANSWER_PREFIX).
export type BorrowerQuestion = { id: string; team: string; en: string; local: string | null; kind: 'text' | 'file' | 'photo' };
export type BorrowerAnswer = { id: string; a: string; at: string; via: 'page' | 'messenger' };

const QUESTIONS_SYSTEM = `A small lender's team has questions about a borrower's proof-of-income document. The borrowers are Filipino or Indonesian, often not strong readers. Rewrite each team question as the message we send the borrower:
- ONE question, at most 20 words, everyday words, warm and polite; if a team question asks two things, keep only the more important one
- never mention fraud, suspicion, AI, a score, checks, a "top-up", a loan from someone else, or that anything looks wrong; just ask plainly
- keep exact amounts with their currency; write dates like "Nov 14", never "2026-11-14" (e.g. "Rp 2,100,000 on Nov 14")
- if the team wants more documents (a longer statement, payslips, more months), ask if they can add them and set kind "file"; otherwise kind "text"
- "local": the same message in light everyday Taglish for the Philippines, or simple Bahasa Indonesia for Indonesia
- leave out a question about things we already know from our own records (their loans with us, due dates, what they owe, repayment history) or that only the team can check; it is fine to return no questions
Reply with only a json object: {"questions": [{"team": "<the team question>", "en": "...", "local": "...", "kind": "text" | "file"}]}`;

/** Whatever the model sent back, as at most 2 clean questions with ids q1, q2. Pure. */
export const parseBorrowerQuestions = (raw: unknown): BorrowerQuestion[] => {
   const list = Array.isArray((raw as { questions?: unknown } | null)?.questions) ? ((raw as { questions: unknown[] }).questions) : [];
   return list
      .map((q) => (q && typeof q === 'object' ? (q as Record<string, unknown>) : {}))
      .map((q) => ({
         team: strOrNull(q.team)?.slice(0, 300) ?? '',
         en: strOrNull(q.en)?.slice(0, 200) ?? '',
         local: strOrNull(q.local)?.slice(0, 200) ?? null,
         kind: q.kind === 'file' ? ('file' as const) : ('text' as const)
      }))
      .filter((q) => q.en)
      .slice(0, 2)
      .map((q, i) => ({ id: `q${i + 1}`, ...q }));
};

// ---- Payslip proof questions --------------------------------------------------------------------
// A payslip is just a picture: totals can add up and the name can match while the dates or amounts were
// changed (Nov 2026: an AI-cleaned payslip passed every check; the chat it came from showed it sent on
// the first day of the pay period it claimed to cover). So every payslip send gets the same two
// questions, written here (not by the AI) so they're always asked and always worded the same.

/** A photo answer is saved as this prefix + its path in the income-docs bucket. */
export const PHOTO_ANSWER_PREFIX = 'photo:';

/** The fixed payslip questions, in their language (ids p1–p3 — the AI's are q1, q2). Pure. */
export const payslipProofQuestions = (country: 'Philippines' | 'Indonesia', opts: { askHistory?: boolean } = {}): BorrowerQuestion[] => [
   {
      id: 'p1',
      team: 'Did they edit or enhance the payslip photo in any app before sending it?',
      en: 'Did you edit or enhance this photo in any app before sending it to us?',
      local:
         country === 'Indonesia'
            ? 'Apakah kamu mengedit atau memperjelas foto ini di aplikasi apa pun sebelum mengirimnya ke kami?'
            : 'Na-edit o na-enhance mo ba ang photo na ito sa kahit anong app bago mo i-send sa amin?',
      kind: 'text'
   },
   {
      id: 'p2',
      team: 'Screenshot of the chat or email where they got this payslip, with the date showing.',
      en: 'Please send a screenshot of the chat or email where you got this payslip, with the date showing.',
      local:
         country === 'Indonesia'
            ? 'Tolong kirim screenshot chat atau email tempat kamu menerima slip gaji ini, dengan tanggalnya terlihat.'
            : 'Paki-send ng screenshot ng chat o email kung saan mo natanggap ang payslip na ito, kita dapat ang date.',
      kind: 'photo'
   },
   // No wallet/bank history of theirs covers this payday yet: ask for one, so the salary check can run.
   ...(opts.askHistory
      ? [
           {
              id: 'p3',
              team: 'Does their salary go to GCash or a bank? Ask for the history showing this payday (salary landed check).',
              en: 'Does your salary go to GCash or a bank? If yes, please send the history that shows this payday.',
              local:
                 country === 'Indonesia'
                    ? 'Apakah gajimu masuk ke e-wallet atau bank? Kalau iya, tolong kirim riwayat yang menunjukkan gaji ini masuk.'
                    : 'Pumapasok ba ang sahod mo sa GCash o bank? Kung oo, paki-send ang history na makikita ang sahod na ito.',
              kind: 'file' as const
           }
        ]
      : [])
];

/** The storage path of a photo answer, only if it's in the borrower's own folder. Pure. */
export const photoAnswerPath = (answer: string | null | undefined, userId: string) => {
   if (!answer?.startsWith(PHOTO_ANSWER_PREFIX)) return null;
   const path = answer.slice(PHOTO_ANSWER_PREFIX.length).trim();
   return path.startsWith(`${userId}/`) && !path.includes('..') ? path : null;
};

export type PayslipSourceRead = { sent_date: string | null; shows_payslip: boolean; notes: string };

const SOURCE_SYSTEM = `A borrower sent a payslip as proof of income. We asked them for a screenshot of the chat or email where they received it. You get that screenshot and what the payslip says. Read:
- sent_date: the date the payslip (image, file or message) was sent in that chat, as YYYY-MM-DD. Chat apps often show a date like "OCT 15 AT 9:39 AM" with no year: use the most recent such date that is not after today. Use the date shown just above or next to the payslip, not today's date or the phone's clock. null if no date is visible for it.
- shows_payslip: true only if a payslip is actually visible in the chat.
- notes: at most 2 short plain sentences on anything that doesn't fit: the payslip in the chat looks different from the one described, the chat reads like a job application or recruitment rather than payroll, it's not a chat at all. Empty string if nothing.
Reply with only a json object: {"sent_date": "YYYY-MM-DD" | null, "shows_payslip": true | false, "notes": "..."}`;

/** Whatever the model sent back, cleaned. Pure. */
export const parseSourceRead = (raw: unknown): PayslipSourceRead => {
   const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
   const date = typeof r.sent_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.sent_date) ? r.sent_date : null;
   return { sent_date: date, shows_payslip: r.shows_payslip === true, notes: strOrNull(r.notes)?.slice(0, 300) ?? '' };
};

const DAY_MS_DOCS = 86_400_000;

/**
 * The chat date against the pay period: a payslip can't be sent days before the period it covers has
 * ended. Up to 3 days early is normal (prepared before payday); more is a red flag. Pure.
 */
export const sourceDateFlag = (sentDate: string | null, periodEnd: string | null): Flag | null => {
   if (!sentDate || !periodEnd) return null;
   const sent = Date.parse(sentDate);
   const end = Date.parse(periodEnd);
   if (!Number.isFinite(sent) || !Number.isFinite(end)) return null;
   const early = Math.round((end - sent) / DAY_MS_DOCS);
   if (early > 3) {
      return {
         code: 'payslip_sent_before_period_end',
         severity: 'red',
         detail: `Their chat shows the payslip sent on ${sentDate}, ${early} days BEFORE the pay period it covers ends (${periodEnd}). A real payslip for that period couldn't exist yet.`
      };
   }
   if (early > 0) {
      return { code: 'payslip_sent_early', severity: 'info', detail: `Chat shows it sent on ${sentDate}, ${early} day(s) before the period ends (${periodEnd}) — normal for a payslip made before payday.` };
   }
   return null;
};

/** Read the chat screenshot they sent as a photo answer. Null when it can't be loaded or read. */
const readPayslipSource = async (supabase: SupabaseClient, apiKey: string, path: string, doc: Extracted): Promise<PayslipSourceRead | null> => {
   try {
      const { data: blob, error } = await supabase.storage.from('income-docs').download(path);
      if (error || !blob) return null;
      const mime = blob.type && IMAGE_TYPES.has(blob.type) ? blob.type : 'image/jpeg';
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const out = await deepseekJson<unknown>(
         apiKey,
         SOURCE_SYSTEM,
         [
            {
               type: 'text',
               text: JSON.stringify({
                  payslip: { employer: doc.payslip?.employer ?? doc.institution, pay_period: [doc.period_start, doc.period_end], net_pay: doc.payslip?.net_pay ?? null, currency: doc.currency }
               })
            },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${toBase64(bytes)}`, detail: 'high' } }
         ],
         600,
         { timeoutMs: 60_000, feature: 'payslip_chat_check' }
      );
      return parseSourceRead(out);
   } catch (err) {
      console.warn('payslip source read failed', err instanceof Error ? err.message : err);
      return null;
   }
};

/** The team line for the chat-screenshot check. Pure. */
export const sourceLine = (read: PayslipSourceRead | null, flag: Flag | null) => {
   if (!read) return '📸 Chat screenshot: couldn’t read it — open it in Admin → Income docs.';
   const parts = [
      flag?.severity === 'red' ? `🔴 ${flag.detail}` : null,
      !read.shows_payslip ? '🟠 No payslip visible in the chat screenshot.' : null,
      !read.sent_date ? '🟠 No date visible next to the payslip in the chat.' : null,
      flag?.severity === 'info' ? `✅ ${flag.detail}` : null,
      read.sent_date && !flag ? `✅ Chat shows it sent on ${read.sent_date}, after the pay period ended.` : null,
      read.notes ? `📝 ${read.notes}` : null
   ].filter(Boolean);
   return `📸 Chat screenshot check\n${parts.join('\n')}`;
};

/** The AI's team questions rewritten for the borrower. Empty when there are none or the call fails. */
/** Which local language the questions get: Indonesia for an ID account or a rupiah document. Pure. */
export const countryOf = (market: string | null | undefined, currency: string | null | undefined) =>
   market === 'ID' || currency === 'IDR' ? 'Indonesia' : 'Philippines';

const QUESTIONS_BUDGET_MS = 15_000;
const borrowerQuestions = async (apiKey: string, ask: string[], ctx: Record<string, unknown>): Promise<BorrowerQuestion[]> => {
   if (!ask.length) return [];
   try {
      // A hard cap (the JSON retry inside deepseekJson could double it): the whole check must finish
      // inside the 150 s the database gives it, and the result matters more than the questions.
      const out = await Promise.race([
         deepseekJson<unknown>(apiKey, QUESTIONS_SYSTEM, JSON.stringify({ team_questions: ask, ...ctx }), 1200, {
            model: OPINION_MODEL,
            timeoutMs: QUESTIONS_BUDGET_MS,
            feature: 'income_questions'
         }),
         new Promise<never>((_, reject) => setTimeout(() => reject(new Error('questions took too long')), QUESTIONS_BUDGET_MS))
      ]);
      return parseBorrowerQuestions(out);
   } catch (err) {
      console.warn('income doc borrower questions failed', err instanceof Error ? err.message : err);
      return [];
   }
};

/** Each question with their answer, for the AI re-read and the team post. Pure. */
export const pairAnswers = (questions: BorrowerQuestion[], answers: BorrowerAnswer[]) =>
   questions.map((q) => {
      const a = answers.find((x) => x.id === q.id);
      const answer = a?.a?.startsWith(PHOTO_ANSWER_PREFIX) ? '📸 sent a screenshot' : (a?.a ?? null);
      return { question: q.team || q.en, asked_them: q.en, answer, via: a?.via ?? null };
   });

// ---- Name check once Didit has their name ---------------------------------------------------------

/**
 * A send whose name couldn't be checked (no Didit yet), now that Didit has their name: the new checks
 * and flags, or null when there's nothing to do (already checked, no name on the document). A mismatch
 * found this late only flags the team (FLAG_ONLY): they may already be through onboarding. Pure.
 */
export const nameRecheck = (
   doc: { flags: Flag[] | null; checks: CheckSection[] | null; extracted: { holder_name?: string | null } | null },
   kycName: string
): { flags: Flag[]; checks: CheckSection[]; matched: boolean; holder: string } | null => {
   const flags = doc.flags ?? [];
   const holder = doc.extracted?.holder_name?.trim() ?? '';
   if (!holder || !kycName.trim() || !flags.some((f) => f.code === 'name_not_checked')) return null;
   const matched = namesMatch(holder, kycName);
   const flag: Flag = matched
      ? { code: 'name_matched_after_id', severity: 'info', detail: `Matches their ID name “${kycName}” (checked after Didit).` }
      : { code: 'name_mismatch_after_id', severity: 'red', detail: `Name on document “${holder}” doesn't match their ID name “${kycName}” (checked after Didit).` };
   const nextFlags = [...flags.filter((f) => f.code !== 'name_not_checked'), flag];
   const checks = (doc.checks ?? []).map((c) =>
      c.key === 'identity' ? { ...c, status: matched ? ('pass' as const) : ('fail' as const), notes: [flag.detail] } : c
   );
   return { flags: nextFlags, checks, matched, holder };
};

/**
 * kyc-cross-check, right after it stores Didit results: their proof-of-income sends from the last 120
 * days that said "name not checked yet" get compared with the ID name now. Matches update quietly; a
 * mismatch is posted to the KYC Telegram group + Discord. Never changes risk, score or a decision.
 */
export const recheckIncomeNamesAfterId = async (supabase: SupabaseClient, userId: string, kycName: string) => {
   const { data: docs } = await supabase
      .from('income_documents')
      .select('id, flags, checks, extracted')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('created_at', new Date(Date.now() - 120 * 86_400_000).toISOString());
   const mismatches: string[] = [];
   let updated = 0;
   for (const d of (docs ?? []) as Array<{ id: string; flags: Flag[] | null; checks: CheckSection[] | null; extracted: { holder_name?: string | null } | null }>) {
      const next = nameRecheck(d, kycName);
      if (!next) continue;
      // Only if it still says "not checked" (two runs at once don't both post).
      const { data: saved } = await supabase
         .from('income_documents')
         .update({ flags: next.flags, checks: next.checks })
         .eq('id', d.id)
         .contains('flags', [{ code: 'name_not_checked' }])
         .select('id')
         .maybeSingle();
      if (!saved) continue;
      updated += 1;
      if (!next.matched) mismatches.push(`${d.id}|${next.holder}`);
   }
   if (mismatches.length) {
      const [{ data: user }, { data: chat }] = await Promise.all([
         supabase.from('users').select('username, display_name').eq('id', userId).maybeSingle(),
         supabase.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle()
      ]);
      const who = personOf(user, userId);
      for (const m of mismatches) {
         const [docId, holder] = m.split('|');
         const text = `🪪 ${who}: name on their proof of income “${holder}” doesn't match their ID name “${kycName}”.
Checked now that Didit is done. Nothing was blocked — look before funding.`;
         if (chat?.value) await sendTelegramMessage(chat.value, text, { inlineKeyboard: incomeDocKeyboard(docId, true) }).catch(() => undefined);
         await postDiscord(
            { embeds: [{ title: `🪪 Name doesn't match ID — ${who}`, url: incomeDocUrl(docId), description: `${text}
${incomeDocUrl(docId)}`, color: 0xe74c3c }] },
            { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
         ).catch(() => undefined);
      }
   }
   return { updated, mismatches: mismatches.length };
};

/** The team post after they answered. Pure. */
export const answersText = (who: string, pairs: ReturnType<typeof pairAnswers>, ai: AiDirection | null) =>
   [
      `💬 ${who} answered the AI's questions`,
      ...pairs.map((p) => `❓ ${p.asked_them}\n💬 ${p.answer ?? '(no answer)'}${p.via === 'messenger' ? ' · on Messenger' : ''}`),
      ai ? `With the answers → ${opinionText(ai)}` : 'The AI couldn’t re-read it — decide from the answers above.'
   ].join('\n\n');

/** OPINION_READS opinions at once (same time as one), combined. Earlier opinions on this borrower go in too. */
const writeDirection = async (apiKey: string, input: Record<string, unknown>): Promise<AiDirection | null> => {
   const reads = await Promise.all(
      Array.from({ length: OPINION_READS }, () =>
         writeOpinion(apiKey, input).catch((err) => {
            console.warn('income doc opinion failed', err instanceof Error ? err.message : err);
            return null;
         })
      )
   );
   return combineOpinions(reads.filter((o): o is AiOpinion => o !== null));
};

const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
   [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

const personOf = (user: { username?: string | null; display_name?: string | null } | null, id: string) =>
   user?.display_name?.trim() || (user?.username ? `@${user.username}` : id.slice(0, 8));

/** The note messengerPhotoIntake.ts puts on income documents made from photos sent in the Messenger chat. */
export const MESSENGER_PHOTO_NOTE = 'Sent on Messenger';

/**
 * A Messenger photo we took as proof of income but isn't one: open (or add to) their Messenger support
 * ticket, so a question sent as a screenshot isn't lost. Never throws.
 */
const ticketForMessengerPhoto = async (supabase: SupabaseClient, userId: string, docUrl: string) => {
   try {
      const { data: u } = await supabase.from('users').select('messenger_psid').eq('id', userId).maybeSingle();
      if (!u?.messenger_psid) return;
      // Loaded here (not at the top): messengerSupport pulls in a lot, and only this path needs it.
      const { openMessengerTicket } = await import('./messengerSupport.ts');
      await openMessengerTicket(supabase, {
         contactId: u.messenger_psid,
         facebookName: null,
         userId,
         text: `📷 Photo sent on Messenger isn't a financial document (a question? a screenshot?): ${docUrl}`,
         hasAttachment: true,
         at: Date.now()
      });
   } catch (err) {
      console.error('messenger photo ticket failed', err instanceof Error ? err.message : err);
   }
};

/** One send end to end: ping the team, read it, check it, save the result, reply under the ping. */
export const analyseIncomeDocument = async (supabase: SupabaseClient, id: string, apiKey: string | null | undefined) => {
   const startedAt = Date.now();
   const { data: row, error: rowError } = await supabase
      .from('income_documents')
      .select('id, user_id, files, note, status, requested_amount, requested_repay')
      .eq('id', id)
      .maybeSingle();
   if (rowError || !row) return { ok: false, error: rowError?.message ?? 'not found' };
   if (row.status !== 'pending') return { ok: true, skipped: row.status };

   const files = (row.files ?? []) as Array<{ path: string; name?: string; mime?: string }>;
   const [{ data: user }, { data: kyc }, { data: loan }, { data: chat }, { data: stepsRow }, { data: aiAutoRow }] = await Promise.all([
      supabase.from('users').select('username, display_name, monthly_income, market').eq('id', row.user_id).maybeSingle(),
      supabase
         .from('kyc_identities')
         .select('full_name')
         .eq('user_id', row.user_id)
         .not('full_name', 'is', null)
         .order('session_created_at', { ascending: false })
         .limit(1)
         .maybeSingle(),
      supabase
         .from('loans')
         .select('id, loan_amount, total_repayment_amount, due_date, loan_status')
         .eq('borrower_user_id', row.user_id)
         .eq('repayment_status', 'Unpaid')
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle(),
      supabase.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle(),
      supabase.from('telegram_bot_settings').select('value').eq('key', 'income_doc_tiers').maybeSingle(),
      supabase.from('telegram_bot_settings').select('value').eq('key', 'income_doc_ai_auto').maybeSingle()
   ]);

   // The amount they were asking for when they sent it (loan form), else their open request.
   const askedAmount = row.requested_amount != null ? Number(row.requested_amount) : loan ? Number(loan.loan_amount) : null;
   const askedRepay = row.requested_repay != null ? Number(row.requested_repay) : loan ? Number(loan.total_repayment_amount) : null;
   let steps: IncomeDocStep[] = [];
   try {
      steps = parseSteps(JSON.parse(stepsRow?.value ?? '[]'));
   } catch {
      steps = [];
   }
   const step = stepFor(askedAmount, steps);

   // 0. Tell the team now — the AI read follows as a reply.
   const who = personOf(user, row.user_id);
   const stepLine = step ? ` · $${step.min} step${step.autoApprove ? ' (approves itself if every check passes)' : ''}` : '';
   const loanLine =
      askedAmount != null
         ? `${loan?.loan_status === 'Lent' && row.requested_amount == null ? 'Has a loan' : 'Asking'} $${askedAmount}${askedRepay ? ` → repay $${askedRepay}` : ''}${stepLine}`
         : 'No open request';
   const docUrl = incomeDocUrl(id);
   // The link the team copies to the borrower (Messenger etc.) to send it again, with their ask kept.
   const resendLink = `${DOCUMENTS_URL}${askedAmount != null ? `?back=loan&amount=${askedAmount}${askedRepay ? `&repay=${askedRepay}` : ''}` : ''}`;
   const resendRow: TelegramInlineKeyboard[number] = [{ text: '📋 Copy resend link for them', copy_text: { text: resendLink } }];
   const idName = kyc?.full_name?.trim();
   const whoLine = [user?.username ? `@${user.username}` : null, idName && idName !== who ? `ID name: ${idName}` : null, user?.monthly_income ? `bio says ${user.monthly_income}/month` : null]
      .filter(Boolean)
      .join(' · ');
   // Affiliate link + pre-screening (journey v2: this send is their AI check before onboarding).
   const { data: screening } = await supabase.rpc('team_screening_line', { p_user_id: row.user_id });
   const ping = [`📄 Proof of income from ${who}`, whoLine || null, typeof screening === 'string' && screening ? screening : null, `${files.length} file${files.length === 1 ? '' : 's'}${row.note ? ` · "${row.note}"` : ''} (attached below)`, loanLine]
      .filter(Boolean)
      .join('\n');
   let pingId: number | undefined;
   if (chat?.value) {
      try {
         const sent = (await sendTelegramMessage(chat.value, ping, { inlineKeyboard: [[{ text: '👀 Open this document', url: docUrl }], resendRow] })) as { message_id?: number } | undefined;
         pingId = sent?.message_id;
      } catch (err) {
         console.error('income doc ping failed', err);
      }
   }
   await postDiscord({ embeds: [{ title: `📄 Proof of income — ${who}`, description: `${ping.split('\n').slice(1).join('\n')}\n${docUrl}`, color: 0x6b55f7 }] }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }).catch(() => undefined);
   // The result (read OK, couldn't read, resend asked…) goes to both places the ping went.
   // One that waits for the team carries 👀 Check + ✅ Approve / ❌ Reject on Telegram and, when the
   // Discord bot is set up, on Discord too (incomeDocCards.ts). Otherwise Discord gets a webhook post
   // that links to the same Admin page.
   // Telegram: always a link to this document + the resend link; Approve / Reject unless it already
   // approved itself (a resend ask can still be approved anyway, like on the admin page).
   const reply = async (text: string, waiting = false, decide = waiting) => {
      if (chat?.value) {
         await sendTelegramMessage(chat.value, text, { replyToMessageId: pingId, inlineKeyboard: [...incomeDocKeyboard(id, decide), resendRow] }).catch((err) =>
            console.error('income doc result failed', err)
         );
      }
      const decisionEmbed = { title: `⚠️ Needs your decision — ${who}`, url: docUrl, description: text.slice(0, 3800), color: 0xf39c12 };
      if (waiting && (await postIncomeDocDiscordCard(supabase, id, decisionEmbed))) return;
      await postDiscord(
         {
            embeds: [
               waiting
                  ? {
                       title: `⚠️ Needs your decision — ${who}`,
                       url: docUrl,
                       description: `${text.slice(0, 3800)}\n\n👀 Check, then ✅ Approve or ❌ Decline: ${docUrl}`,
                       color: 0xf39c12
                    }
                  : { title: `📄 Result — ${who}`, description: `${text.slice(0, 3900)}\n${docUrl}`, color: 0x6b55f7 }
            ]
         },
         { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
      ).catch(() => undefined);
   };

   const finish = async (patch: Record<string, unknown>, replyText?: string) => {
      await supabase.from('income_documents').update({ ...patch, analyzed_at: new Date().toISOString() }).eq('id', id);
      // Not a resend ask and not approved by itself → it waits for the team's Approve / Reject.
      if (replyText) await reply(replyText, patch.verdict !== 'resend' && patch.decision !== 'approved', patch.decision !== 'approved');
      // Indonesia track: "✅ Bukti penghasilan selesai — langkah berikutnya: …" on Telegram, unless
      // they're asked to resend it or it approved itself (those get their own message).
      if (patch.verdict !== 'resend' && patch.decision !== 'approved') await notifyIdNextStep(supabase, row.user_id, 'income');
      return { ok: patch.status === 'done', ...patch };
   };
   // A problem the borrower can fix: tell them now (card + push/Messenger/Telegram) and the team in the reply.
   // If it also carries fake signs (e.g. an AI-made image), the borrower is still only asked for a
   // real document, but the team gets a 🚨 alert in the fraud group + Discord and it stays on the
   // admin "to review" list (risk 'red').
   const askResend = async (patch: Record<string, unknown>, reason: ResendReason, teamNote: string) => {
      const fraud = ((patch.flags as Flag[] | undefined) ?? []).filter((f) => f.severity === 'red');
      const result = await finish(
         { ...patch, verdict: 'resend', resend_reason: reason, checks: patch.checks ?? buildSections([], { ok: false, note: teamNote }) },
         `${fraud.length ? '🚨 Fraud signs · ' : ''}${VERDICT_LINE.resend}: ${RESEND_TEXT[reason]}\n\n${teamNote}`.slice(0, 3900)
      );
      await notifyIncomeDecision(supabase, id);
      // A photo picked up from their Messenger chat that isn't a financial document (a selfie, an error
      // screenshot, a job photo) may really be a question: also open a support ticket so the team sees it.
      if (reason === 'not_financial' && row.note === MESSENGER_PHOTO_NOTE) await ticketForMessengerPhoto(supabase, row.user_id, docUrl);
      if (fraud.length) {
         const alert = `🚨 Possible fraud: ${who} sent this as proof of income\n${fraud.map((f) => `• ${f.detail}`).join('\n')}\n${loanLine}`;
         const { data: fraudChat } = await supabase.from('telegram_bot_settings').select('value').eq('key', 'fraud_alert_chat_id').maybeSingle();
         if (fraudChat?.value) {
            await sendTelegramMessage(fraudChat.value, alert, { inlineKeyboard: [[{ text: '👀 Open this document', url: docUrl }], resendRow] }).catch(() => undefined);
         }
         await postDiscord(
            { embeds: [{ title: `🚨 Possible fraud — ${who}`, description: `${alert.split('\n').slice(1).join('\n')}\n${docUrl}`, color: 0xe74c3c }] },
            { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
         ).catch(() => undefined);
      }
      return result;
   };
   // Our side failed (download, AI down) — never the borrower's fault, so it goes to the team.
   const toTeam = (patch: Record<string, unknown>, teamNote: string) =>
      finish({ ...patch, verdict: 'needs_review', checks: buildSections([], { ok: false, note: teamNote }) }, `${VERDICT_LINE.needs_review}: ${teamNote}`);

   if (!apiKey) return toTeam({ status: 'skipped', error: 'DEEPSEEK_API_KEY not set' }, 'no AI key — check the files by hand');
   await supabase.from('income_documents').update({ status: 'processing', loan_id: loan?.id ?? null }).eq('id', id);

   // 1. Load the files.
   const loaded: LoadedFile[] = [];
   const pdfs: PdfInfo[] = [];
   const hashes: string[] = [];
   const facts: FileFacts[] = [];
   const uploads: TelegramUpload[] = [];
   let locked = false;
   let unsupported = false;
   for (const f of files) {
      const { data: blob, error } = await supabase.storage.from('income-docs').download(f.path);
      if (error || !blob) return toTeam({ status: 'failed', error: `download failed: ${f.path}` }, 'couldn’t open the files');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      hashes.push(await sha256(bytes));
      facts.push({ name: f.name ?? `file ${facts.length + 1}`, image: imageInfo(bytes), markers: fileMarkers(bytes) });
      const mime = f.mime && (f.mime === 'application/pdf' || IMAGE_TYPES.has(f.mime)) ? f.mime : blob.type;
      uploads.push({ name: f.name ?? f.path.split('/').pop() ?? 'file', mime: mime || 'application/octet-stream', bytes });
      if (mime === 'application/pdf') {
         const info = readPdfInfo(bytes);
         if (info.encrypted) {
            locked = true;
            continue;
         }
         pdfs.push(info);
      } else if (!IMAGE_TYPES.has(mime)) {
         unsupported = true; // HEIC etc.
         continue;
      }
      loaded.push({ name: f.name ?? f.path, mime, bytes });
   }

   // The files themselves, under the ping, so the team opens them inside Telegram.
   if (chat?.value) await sendTelegramFiles(chat.value, uploads, { replyToMessageId: pingId });

   // AI labels and generator tags are in the file itself: a fake sign, so it always goes to the team.
   const fileWarnings = facts
      .flatMap((f) => [f.markers.aiLabel && `🔴 ${f.name}: ${f.markers.aiLabel}`, f.markers.generator && `🔴 ${f.name}: ${f.markers.generator} tag`])
      .filter(Boolean)
      .join('\n');
   const fileFakeFlags: Flag[] = facts.flatMap((f) => [
      ...(f.markers.aiLabel ? [{ code: 'ai_label', severity: 'red' as const, detail: `${f.name} is ${f.markers.aiLabel}.` }] : []),
      ...(f.markers.generator ? [{ code: 'ai_generator', severity: 'red' as const, detail: `${f.name} carries a ${f.markers.generator} tag.` }] : [])
   ]);
   const unreadablePatch = (note: string, extra: Record<string, unknown> = {}) => ({
      status: 'failed',
      file_hashes: hashes,
      error: note,
      flags: fileFakeFlags,
      risk: fileFakeFlags.length ? 'red' : null,
      ...extra,
      checks: buildSections(fileFakeFlags, { ok: false, note })
   });

   if (!loaded.length) {
      const reason: ResendReason = locked ? 'password_protected' : 'unsupported_file';
      const note = locked ? 'password-protected PDF' : 'file type the AI can’t open (HEIC?)';
      if (fileWarnings) return finish({ ...unreadablePatch(note), verdict: 'needs_review' }, `${VERDICT_LINE.needs_review}: ${note}\n${fileWarnings}`);
      return askResend(unreadablePatch(note), reason, note);
   }

   // 2–5. Read, work out, check, score, note.
   let doc: Extracted;
   try {
      doc = await extract(apiKey, loaded);
   } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A scanned PDF has no text to read — the borrower can fix that with screenshots.
      if (/scanned PDF/.test(message) && !fileWarnings) return askResend(unreadablePatch(message), 'scanned_pdf', message);
      return finish({ ...unreadablePatch(`read failed: ${message}`), verdict: 'needs_review' }, `${VERDICT_LINE.needs_review}: AI couldn’t read it.${fileWarnings ? `\n${fileWarnings}` : ''}`);
   }
   // ID numbers become hashes right away; the numbers themselves are never saved.
   const idHashes = await idKeys(doc.id_numbers ?? []);
   doc = { ...doc, id_numbers: [] };
   if (!doc.readable) {
      const note = `unreadable: ${doc.unreadable_reason ?? 'no reason given'}`;
      const patch = unreadablePatch(note, { doc_type: doc.doc_type, extracted: doc, model: MODEL });
      // Not a financial document: ask for a real one (AI tags are still listed for the team).
      if (doc.doc_type === 'other') return askResend(patch, 'not_financial', fileWarnings ? `${note}\n${fileWarnings}` : note);
      if (fileWarnings) return finish({ ...patch, verdict: 'needs_review' }, `${VERDICT_LINE.needs_review}: ${note}\n${fileWarnings}`);
      return askResend(patch, 'unreadable', note);
   }

   const keys = rowKeys(doc.transactions);
   const [{ data: dupes }, { data: sameRows }, { data: sameIds }, { data: mine }] = await Promise.all([
      supabase.from('income_documents').select('user_id').overlaps('file_hashes', hashes).neq('user_id', row.user_id),
      keys.length >= 5
         ? supabase.from('income_documents').select('user_id, row_keys').overlaps('row_keys', keys).neq('user_id', row.user_id).limit(20)
         : Promise.resolve({ data: [] as Array<{ user_id: string; row_keys: string[] }> }),
      idHashes.length
         ? supabase.from('income_documents').select('user_id').overlaps('id_hashes', idHashes).neq('user_id', row.user_id).limit(20)
         : Promise.resolve({ data: [] as Array<{ user_id: string }> }),
      // Their own other recent sends, for the payslip ↔ history salary check.
      supabase
         .from('income_documents')
         .select('extracted')
         .eq('user_id', row.user_id)
         .neq('id', id)
         .eq('status', 'done')
         .gte('created_at', new Date(Date.now() - 120 * 86_400_000).toISOString())
         .order('created_at', { ascending: false })
         .limit(8)
   ]);
   const otherDocs = ((mine ?? []) as Array<{ extracted: Extracted | null }>).map((r) => r.extracted).filter((e): e is Extracted => !!e && Array.isArray(e.transactions));
   const loanCtx: LoanContext | null =
      askedAmount != null ? { amount: askedAmount, total_repayment: askedRepay ?? askedAmount, due_date: row.requested_amount == null ? (loan?.due_date ?? null) : null } : null;
   const metrics = computeMetrics(doc);
   const flags = runChecks(doc, metrics, {
      pdfs,
      step,
      files: facts,
      rowMatches: (sameRows ?? []).map((r) => ({ user_id: r.user_id, share: rowOverlap(keys, r.row_keys ?? []) })),
      duplicateOf: dupes ?? [],
      idMatches: new Set((sameIds ?? []).map((r: { user_id: string }) => r.user_id)).size,
      otherDocs,
      kycName: kyc?.full_name ?? null,
      statedMonthlyIncome: parseStatedIncome(user?.monthly_income),
      loan: loanCtx
   });
   const memo = buildMemo(doc, metrics, flags);
   const risk = riskOf(flags);
   const score = scoreOf(doc, metrics, flags);
   const checks = buildSections(flags, {
      ok: true,
      note: `${doc.transactions.length} rows read${locked ? ' (a locked PDF was skipped)' : ''}${unsupported ? ' (a HEIC photo was skipped)' : ''}`
   });
   const { verdict, reason } = verdictOf(flags, doc.doc_type);

   let aiNote: AiDirection | null = null;
   if (verdict !== 'resend') {
      try {
         // What the AI said about their earlier sends, so its view of the same person stays steady.
         const { data: earlier } = await supabase
            .from('income_documents')
            .select('created_at, ai_note')
            .eq('user_id', row.user_id)
            .neq('id', id)
            .not('ai_note', 'is', null)
            .order('created_at', { ascending: false })
            .limit(3);
         aiNote = await writeDirection(apiKey, {
            borrower: await borrowerContext(supabase, row.user_id),
            earlier_opinions_on_this_borrower: (earlier ?? []).map((e: { created_at: string; ai_note: string }) => ({ on: e.created_at.slice(0, 10), said: e.ai_note })),
            // In US dollars (the document is in its own currency; monthly_income_usd converts it).
            loan_usd: loanCtx ? { amount: loanCtx.amount, repay: loanCtx.total_repayment, due: loanCtx.due_date ?? 'about 30 days after funding' } : null,
            monthly_income_usd: monthlyIncomeUsd(doc, metrics),
            document: { type: doc.doc_type, institution: doc.institution, period: [doc.period_start, doc.period_end], currency: doc.currency },
            metrics,
            checks: flags,
            score
         });
      } catch (err) {
         console.error('income doc note failed', err);
      }
   }

   // Story check (from the same AI reads): a team-only flag + its own named check. Never gates anything.
   if (aiNote?.mismatches.length) {
      flags.push({ code: 'story_mismatch', severity: 'orange', detail: `Doesn't fit across their answers: ${aiNote.mismatches.join(' · ')}` });
   }
   if (aiNote) {
      checks.push({
         key: 'consistent',
         label: 'Story fits across sources',
         status: aiNote.mismatches.length ? 'warn' : 'pass',
         notes: aiNote.mismatches
      });
   }
   const patch = {
      status: 'done',
      tier: step,
      file_hashes: hashes,
      row_keys: keys,
      id_hashes: idHashes,
      doc_type: doc.doc_type,
      extracted: doc,
      metrics,
      flags,
      memo,
      risk,
      score,
      checks,
      ai_note: aiNote ? `${aiNote.direction} (${aiNote.votes.join(', ')}): ${aiNote.note}${aiNote.ask.length ? ` Ask: ${aiNote.ask.join(' ')}` : ''}` : null,
      repay_chance: aiNote?.repayChance ?? null,
      repay_reasons: aiNote?.reasons.length ? aiNote.reasons : null,
      model: MODEL
   };
   const checkLine = checks.map((c) => `${c.status === 'pass' ? '✅' : c.status === 'warn' ? '🟠' : c.status === 'skip' ? '⚪' : '🔴'} ${c.label}`).join('\n');
   // A resend ask still shows the team everything that was read: checks, what the document is, income, flags.
   if (verdict === 'resend' && reason) return askResend(patch, reason, [`Score ${score}/100`, checkLine, memo].join('\n\n'));
   // Small steps ($40 today): every check passed → approved without a team decision.
   const stepAuto = verdict === 'looks_good' && step?.autoApprove === true;
   // Bigger asks: only when every AI opinion says lend and the score is high (income_doc_ai_auto).
   const aiRule = parseAiAutoRule(aiAutoRow?.value);
   const aiAuto = !stepAuto && aiAutoApproves(aiRule, { verdict, votes: aiNote?.votes ?? null, score, askedAmount });
   const autoApprove = stepAuto || aiAuto;
   // The AI's questions, worded for the borrower: they answer on /documents or on Messenger (DOCS), and
   // the answers go back into the opinion (reviewWithAnswers). Not when it approved itself, and not on
   // fraud signs (those are the team's to raise).
   // Skipped when the check has already run long (the opinion's thinking pass can take most of the time).
   // Payslips also get the two fixed proof questions (first, whatever the risk): asking where it came
   // from gives nothing away, and the chat's date is what catches a changed payslip.
   const country = countryOf(user?.market, doc?.currency);
   // Every step, even when it approved itself (George 2026-11-21: payslips at each credit step): the
   // approval doesn't wait on the answers, they reach the team afterwards (reviewWithAnswers).
   const proofQuestions = doc.doc_type === 'payslip' ? payslipProofQuestions(country, { askHistory: !hasHistoryForPayday(doc, otherDocs) }) : [];
   const aiQuestions =
      !autoApprove && risk !== 'red' && aiNote?.ask.length && Date.now() - startedAt < 100_000
         ? await borrowerQuestions(apiKey, aiNote.ask, {
              country,
              document: { type: doc.doc_type, institution: doc.institution, currency: doc.currency, period: [doc.period_start, doc.period_end] },
              rows: doc.transactions.slice(0, 60).map((t, i) => ({ row: `T${i + 1}`, date: t.date, description: t.description, amount: t.amount }))
           })
         : [];
   const questions = [...proofQuestions, ...aiQuestions];
   const decidedBy = stepAuto ? `auto ($${step!.min} step)` : `auto (AI lend x${aiNote?.votes.length ?? 0}, score ${score})`;
   const headline = stepAuto
      ? `✅ Approved automatically ($${step!.min} step)`
      : aiAuto
        ? `✅ Approved automatically: every check passed, AI said lend ${aiNote!.votes.length}/${aiNote!.votes.length}, score ${score} ≥ ${aiRule!.minScore}, $${askedAmount} ≤ $${aiRule!.maxUsd}`
        : VERDICT_LINE[verdict];
   const result = await finish(
      {
         ...patch,
         verdict,
         questions: questions.length ? questions : null,
         ...(autoApprove ? { decision: 'approved', decided_at: new Date().toISOString(), decided_by: decidedBy } : {})
      },
      [`${headline} · score ${score}/100${aiNote ? ` · AI: ${aiNote.direction.toLowerCase()}` : ''}`, aiNote ? opinionText(aiNote) : null, checkLine, memo].filter(Boolean).join('\n\n').slice(0, 3900)
   );
   if (autoApprove) await notifyIncomeDecision(supabase, id);
   // They already sent DOCS on Messenger while this was being read: the bot asks the first question there.
   if (questions.length) await askOnMessengerIfWaiting(supabase, id);
   return result;
};

/**
 * Borrower questions for a send checked before they existed (kyc-cross-check {"income_questions": id}):
 * from the "Ask:" part of its AI note. dry = return them without saving (to read the wording first).
 */
export const backfillBorrowerQuestions = async (supabase: SupabaseClient, id: string, apiKey: string | null | undefined, dry = true) => {
   if (!apiKey) return { ok: false, error: 'no AI key' };
   const { data: row } = await supabase
      .from('income_documents')
      .select('id, user_id, ai_note, extracted, questions, decision, verdict')
      .eq('id', id)
      .maybeSingle();
   if (!row) return { ok: false, error: 'not found' };
   const ask = String(row.ai_note ?? '').split(' Ask: ')[1]?.trim();
   if (!ask) return { ok: true, skipped: 'no questions in the AI note' };
   const { data: user } = await supabase.from('users').select('market').eq('id', row.user_id).maybeSingle();
   const doc = row.extracted as Extracted | null;
   const questions = await borrowerQuestions(apiKey, [ask], {
      country: countryOf(user?.market, doc?.currency),
      document: doc ? { type: doc.doc_type, institution: doc.institution, currency: doc.currency, period: [doc.period_start, doc.period_end] } : null,
      rows: (doc?.transactions ?? []).slice(0, 60).map((t, i) => ({ row: `T${i + 1}`, date: t.date, description: t.description, amount: t.amount }))
   });
   if (!dry && questions.length && !row.questions && !row.decision && row.verdict !== 'resend') {
      await supabase.from('income_documents').update({ questions }).eq('id', id).is('questions', null);
   }
   return { ok: true, dry, questions };
};

/**
 * Every question answered (save_income_doc_answer → kyc-cross-check {"income_answers": id}): the AI
 * opinion again, now with their answers, saved on the row and posted to the team (Telegram reply under
 * the KYC chat + Discord). Runs once per send. Never approves by itself — answers are their word.
 */
export const reviewWithAnswers = async (supabase: SupabaseClient, id: string, apiKey: string | null | undefined) => {
   // Claim it first, so a double call doesn't post twice.
   const { data: claimed } = await supabase
      .from('income_documents')
      .update({ answers_reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .is('answers_reviewed_at', null)
      // Undecided, or approved by itself (a team decision closes the questions).
      .or('decision.is.null,decided_by.like.auto*')
      .select('id, user_id, questions, answers, extracted, metrics, flags, checks, score, ai_note, requested_amount, requested_repay, created_at')
      .maybeSingle();
   if (!claimed) return { ok: true, skipped: 'already reviewed or decided' };
   const questions = (claimed.questions ?? []) as BorrowerQuestion[];
   const pairs = pairAnswers(questions, (claimed.answers ?? []) as BorrowerAnswer[]);
   if (!pairs.length) return { ok: true, skipped: 'no questions' };

   const [{ data: user }, { data: chat }, { data: loan }] = await Promise.all([
      supabase.from('users').select('username, display_name').eq('id', claimed.user_id).maybeSingle(),
      supabase.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle(),
      supabase
         .from('loans')
         .select('loan_amount, total_repayment_amount, due_date')
         .eq('borrower_user_id', claimed.user_id)
         .eq('repayment_status', 'Unpaid')
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle()
   ]);
   const who = personOf(user, claimed.user_id);
   const doc = claimed.extracted as Extracted | null;
   const metrics = claimed.metrics as Metrics | null;

   // The chat screenshot for a payslip (question p2): read its date and hold it against the pay period.
   const photoPath = photoAnswerPath(((claimed.answers ?? []) as BorrowerAnswer[]).find((a) => a.id === 'p2')?.a, claimed.user_id);
   let source: { read: PayslipSourceRead | null; flag: Flag | null } | null = null;
   if (photoPath && apiKey && doc) {
      const read = await readPayslipSource(supabase, apiKey, photoPath, doc);
      const flag = read ? sourceDateFlag(read.sent_date, doc.period_end) : null;
      source = { read, flag };
      if (flag?.severity === 'red') {
         const flags = [...((claimed.flags ?? []) as Flag[]), flag];
         const checks = ((claimed.checks ?? []) as CheckSection[]).map((c) =>
            c.key === 'authentic' ? { ...c, status: 'fail' as const, notes: [...c.notes, flag.detail] } : c
         );
         // Flag only: risk stays as it was, so a borrower already through isn't pulled back to "hold".
         await supabase.from('income_documents').update({ flags, checks }).eq('id', id);
         claimed.flags = flags;
      }
   }

   let ai: AiDirection | null = null;
   if (apiKey && doc && metrics) {
      const amount = claimed.requested_amount != null ? Number(claimed.requested_amount) : loan ? Number(loan.loan_amount) : null;
      const repay = claimed.requested_repay != null ? Number(claimed.requested_repay) : loan ? Number(loan.total_repayment_amount) : null;
      ai = await writeDirection(apiKey, {
         borrower: await borrowerContext(supabase, claimed.user_id),
         earlier_opinions_on_this_borrower: claimed.ai_note ? [{ on: String(claimed.created_at).slice(0, 10), said: claimed.ai_note }] : [],
         loan_usd: amount != null ? { amount, repay: repay ?? amount, due: claimed.requested_amount == null ? (loan?.due_date ?? null) : 'about 30 days after funding' } : null,
         monthly_income_usd: monthlyIncomeUsd(doc, metrics),
         document: { type: doc.doc_type, institution: doc.institution, period: [doc.period_start, doc.period_end], currency: doc.currency },
         metrics,
         checks: claimed.flags,
         score: claimed.score,
         their_answers_to_our_questions: pairs.map(({ question, answer }) => ({ question, answer })),
         ...(source ? { payslip_chat_screenshot: { read: source.read, date_check: source.flag?.detail ?? null } } : {})
      }).catch((err) => {
         console.error('income doc re-read failed', err);
         return null;
      });
   }
   if (ai) {
      await supabase
         .from('income_documents')
         .update({
            ai_note: `${ai.direction} (${ai.votes.join(', ')}, with their answers): ${ai.note}${ai.ask.length ? ` Ask: ${ai.ask.join(' ')}` : ''}`,
            // The re-read with their answers replaces the first prediction (it knows more).
            ...(ai.repayChance != null ? { repay_chance: ai.repayChance, repay_reasons: ai.reasons.length ? ai.reasons : null } : {})
         })
         .eq('id', id);
   }

   const text = [answersText(who, pairs, ai), source ? sourceLine(source.read, source.flag) : null].filter(Boolean).join('\n\n').slice(0, 3900);
   if (chat?.value) {
      await sendTelegramMessage(chat.value, text, { inlineKeyboard: incomeDocKeyboard(id, true) }).catch((err) => console.error('income doc answers post failed', err));
   }
   await postDiscord(
      { embeds: [{ title: `💬 Answers — ${who}`, url: incomeDocUrl(id), description: `${text.slice(0, 3800)}\n${incomeDocUrl(id)}`, color: 0x6b55f7 }] },
      { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
   ).catch(() => undefined);
   return { ok: true, direction: ai?.direction ?? null };
};

const DOCUMENTS_URL = 'https://moodeng.app/documents';
// Approved with no request posted yet: straight back to their loan form (it reopens filled in).
const APPLY_URL = 'https://moodeng.app/request-board?applyLoan=1';

/** What the borrower is told: the team's decision, or an automatic "please resend". Pure. */
export const decisionMessage = (kind: 'approved' | 'declined' | 'resend', reason: string | null, toSend = false) =>
   kind === 'approved'
      ? toSend
         ? { title: 'Proof of income approved ✅', body: 'One more step: your loan request is not sent yet. Tap below to send it.' }
         : { title: 'Proof of income approved ✅', body: 'Thanks! Your document is verified. It helps your loan requests get funded.' }
      : kind === 'resend'
        ? { title: 'Let’s try that again', body: `${reason ?? 'Please send a clearer document.'} Questions? Message us on Facebook.` }
        : {
             title: 'We couldn’t approve your document',
             body: `${reason ? `${reason} ` : ''}You can send a different one any time, or message us on Facebook if you have questions.`
          };

/**
 * Tell the borrower on push, Messenger, Telegram and email (whichever they have): a decision or a
 * resend ask. With `card` (a decision tapped on the Telegram card), say under that card where it
 * reached them — so a push-only send is visible and someone can message them by hand.
 */
export const notifyIncomeDecision = async (supabase: SupabaseClient, id: string, card?: { chat?: string; message?: number }) => {
   const { data: row } = await supabase.from('income_documents').select('id, user_id, decision, decision_reason, verdict, resend_reason, loan_id').eq('id', id).maybeSingle();
   const kind: 'approved' | 'declined' | 'resend' | null = row?.decision ?? (row?.verdict === 'resend' ? 'resend' : null);
   if (!row || !kind) return { ok: false, error: 'nothing to tell' };
   const { data: user } = await supabase
      .from('users')
      .select('id, chat_id, notif_account_activity, messenger_psid, email')
      .eq('id', row.user_id)
      .maybeSingle();
   // Indonesia track: in Bahasa on Telegram, always (instead of the English Telegram copy below).
   const idTrack = await isIdTrackUser(supabase, row.user_id);
   // Approved before any request went out (the form stopped them for this document): the approval
   // doesn't send anything by itself, so say so and link back to their form (2026-11-15: a borrower
   // read "approved" as "sent" and waited).
   let toSend = false;
   if (kind === 'approved' && !row.loan_id && !idTrack) {
      const { count } = await supabase
         .from('loans')
         .select('id', { count: 'exact', head: true })
         .eq('borrower_user_id', row.user_id)
         .eq('loan_status', 'Requested')
         .gt('created_at', new Date(Date.now() - 7 * 86400_000).toISOString());
      toSend = (count ?? 0) === 0;
   }
   const msg = decisionMessage(kind, kind === 'resend' ? (RESEND_TEXT[row.resend_reason as ResendReason] ?? null) : row.decision_reason, toSend);
   const linkUrl = toSend ? APPLY_URL : DOCUMENTS_URL;
   let idSent = false;
   if (idTrack) {
      const { data: idUser } = await supabase.from('users').select('preferred_locale').eq('id', row.user_id).maybeSingle();
      const locale = idLocaleOf(idUser?.preferred_locale);
      const reason =
         kind === 'resend'
            ? idResendReason(row.resend_reason, locale, RESEND_TEXT[row.resend_reason as ResendReason] ?? null)
            : locale === 'en'
              ? row.decision_reason
              : row.decision_reason
                ? `Catatan tim: ${row.decision_reason}`
                : null;
      const status = kind === 'approved' ? await loadIdStatus(supabase, row.user_id) : null;
      idSent = await sendIdTelegram(supabase, row.user_id, kind === 'approved' ? 'income_approved' : kind === 'resend' ? 'income_resend' : 'income_declined', {
         reason,
         next: status?.next ?? null
      });
   }
   const button = toSend ? 'Send my request' : kind === 'approved' ? 'Open Moodeng' : 'Send again';
   const sent: string[] = [];

   try {
      const push = await sendPushToUser(supabase, row.user_id, () => ({ type: 'income_doc_decision', title: msg.title, body: msg.body, url: linkUrl, tag: 'income-doc' }), {
         urgency: 'high'
      });
      if (push.sent > 0) sent.push('push');
   } catch (err) {
      console.error('income decision push failed', err);
   }
   const messenger = await sendMessengerMessage(user?.messenger_psid, {
      text: `${msg.title}\n${msg.body}`,
      card: { title: msg.title, button: { title: button, url: linkUrl } }
   });
   if (messenger.ok) sent.push('Messenger');
   if (idSent) sent.push('Telegram');
   if (user?.chat_id && user.notif_account_activity !== false && !idTrack) {
      try {
         await sendTelegramMessage(user.chat_id, `${msg.title}\n\n${msg.body}`, { inlineKeyboard: [[{ text: button, url: linkUrl }]] });
         sent.push('Telegram');
      } catch (err) {
         console.error('income decision telegram failed', err);
      }
   }
   // Email too: many borrowers have no Messenger ID or Telegram on file, and push alone is easy to miss.
   // sendEmail refuses made-up addresses (phone/Telegram sign-ups), which lands in the catch.
   if (user?.email) {
      try {
         await sendEmail(user.email, msg.title, `${msg.body}\n\n${button}: ${linkUrl}\n\nMoodeng Credit`);
         sent.push('email');
      } catch (err) {
         if (!(err instanceof Error && err.message.includes('placeholder'))) console.error('income decision email failed', err);
      }
   }
   await supabase.from('income_documents').update({ notified_at: new Date().toISOString() }).eq('id', id);
   if (card?.chat && card.message) {
      await sendTelegramMessage(card.chat, reachLine(sent, kind), { replyToMessageId: card.message }).catch((err) =>
         console.error('income decision: reach line failed', err instanceof Error ? err.message : err)
      );
   }
   return { ok: true, sent };
};
