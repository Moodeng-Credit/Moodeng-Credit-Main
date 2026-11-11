import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from './discord.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { fileMarkers, gcashRefIssues, type ImageInfo, imageInfo, isAiSize, rowKeys, rowOverlap } from './fileForensics.ts';
import { sendTelegramMessage } from './telegram.ts';
import { idLocaleOf, idResendReason, isIdTrackUser, loadIdStatus, notifyIdNextStep, sendIdTelegram } from './idTrack.ts';

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
const MODEL = 'deepseek-flash';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const ADMIN_URL = 'https://moodeng.app/admin/income-docs';
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
   doc_type: 'gcash_history' | 'maya_history' | 'bank_statement' | 'payslip' | 'remittance' | 'business_permit' | 'other';
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
   visual_anomalies: []
};

const SYSTEM = `You read proof-of-income documents for a small lender in the Philippines, Indonesia and Thailand: GCash, Maya, DANA, OVO or PromptPay/bank-app transaction history (PDF export or app screenshots), bank statements (often bilingual, e.g. Thai + English — read the English labels and the numbers), payslips, remittance receipts, business permits. Several files from one person are usually screenshots of the SAME history: read them as one document, merge the rows, and drop rows that appear twice because screenshots overlap.

Copy what the document says. Never guess or fill in a number that is not printed.
- transactions: every row, oldest first. amount is positive for money in, negative for money out. balance is the running balance printed on that row, or null. date as YYYY-MM-DD.
- source_text: the exact characters printed for that row or field, so a person can find it. Include the reference number (e.g. "Ref No. 1234 567 890123") when the row shows one. page: 1-based, counting files in the order given (a screenshot is one page).
- fields: other key facts printed (account number last 4 digits only, employer, pay period, permit number, address). Never copy a full account or ID number.
- period_start / period_end: the statement or pay period as printed, or the first and last transaction dates, YYYY-MM-DD.
- visual_anomalies: only things you can actually see that suggest editing: mixed fonts or sizes within one column, misaligned digits, numbers pasted over a different background, blurred amounts next to sharp text, totals that do not match the rows, a layout that does not match the institution's real format. Empty if none.
- If you cannot read it (blank, not a financial document, password-protected, too blurry), set readable false, say why in unreadable_reason, and leave the lists empty.
- doc_type is one of: gcash_history, maya_history, bank_statement, payslip, remittance, business_permit, other. payslip is null unless it is a payslip, else {"employer", "gross_pay", "total_deductions", "net_pay"} (numbers or null).

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
   if (doc.opening_balance != null && doc.closing_balance != null && tx.length) {
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

   // --- Identity ----------------------------------------------------------------------------------
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
   if (!tx.length && !p?.net_pay && doc.doc_type !== 'business_permit') {
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
export const scoreOf = (doc: Extracted, metrics: Metrics, flags: Flag[]) => {
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

export const riskOf = (flags: Flag[]): 'green' | 'orange' | 'red' =>
   flags.some((f) => f.severity === 'red') ? 'red' : flags.some((f) => f.severity === 'orange') ? 'orange' : 'green';

// ---- Verdict (Didit-style) ---------------------------------------------------------------------
// Every send ends with one verdict, plus a list of named checks that each pass, warn or fail:
//   resend        a problem the borrower can fix (blurry, locked PDF, wrong document, too old, too
//                 short, no money in). They're told right away what to send instead; no team decision.
//   needs_review  anything that could be a fake, someone else's document or a repayment risk. Never
//                 explained to the borrower — the team decides.
//   looks_good    every check passed. Still the team's call (no auto-approve).

export type Verdict = 'resend' | 'needs_review' | 'looks_good';
export type ResendReason = 'password_protected' | 'scanned_pdf' | 'unsupported_file' | 'unreadable' | 'not_financial' | 'old_document' | 'short_history' | 'no_income';

/** What the borrower is told to fix, in their words. */
export const RESEND_TEXT: Record<ResendReason, string> = {
   password_protected: 'Your PDF is locked with a password, so we can’t open it. Please send screenshots of your history instead.',
   scanned_pdf: 'We couldn’t read your PDF. Please send screenshots of your history instead.',
   unsupported_file: 'We couldn’t open that photo type. Please send a screenshot or a JPG/PNG photo instead.',
   unreadable: 'We couldn’t read it clearly. Please retake it in good light with all 4 corners showing and the numbers sharp.',
   not_financial: 'This doesn’t look like a GCash or Maya history, bank statement or payslip. Please send one of those.',
   old_document: 'This is more than 2 months old. Please send your latest one.',
   short_history: 'This doesn’t show enough history for the amount you’re asking. Please send your last 2–3 months.',
   no_income: 'We couldn’t see money coming in. Please send a history or statement that shows the money you receive.'
};

export type CheckSection = { key: string; label: string; status: 'pass' | 'warn' | 'fail' | 'skip'; notes: string[] };

// Which flag belongs to which named check. Anything that could mean a fake is in FAKE_SECTIONS.
const SECTIONS: Array<{ key: string; label: string; codes: string[] }> = [
   { key: 'authentic', label: 'Not edited', codes: ['balance_math', 'running_balance', 'payslip_math', 'made_in_editor', 'edited_after_creation', 'visual_anomaly', 'edited_image'] },
   { key: 'not_ai', label: 'Not AI-made', codes: ['ai_label', 'ai_generator', 'ai_image_size', 'gcash_ref_repeated', 'gcash_ref_format'] },
   { key: 'identity', label: 'Name matches ID', codes: ['name_mismatch'] },
   { key: 'unique', label: 'Not used by another account', codes: ['same_file_other_account', 'same_rows_other_account'] },
   { key: 'recent', label: 'Recent and 2+ months', codes: ['old_document', 'short_history'] },
   { key: 'income', label: 'Regular income', codes: ['no_income_rows', 'no_regular_income', 'income_below_stated', 'one_big_deposit'] },
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
           : read.ok
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
   const serious = flags.filter((f) => f.severity !== 'info');
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
const deepseekJson = async <T>(apiKey: string, system: string, content: string | ChatPart[], maxTokens: number): Promise<T> => {
   for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(DEEPSEEK_URL, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
         body: JSON.stringify({
            model: MODEL,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
            messages: [
               { role: 'system', content: system },
               { role: 'user', content }
            ]
         })
      });
      if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
      const choice = body.choices?.[0];
      if (choice?.finish_reason === 'length') throw new Error('document too long to read in one pass');
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
const DOC_TYPES = new Set(['gcash_history', 'maya_history', 'bank_statement', 'payslip', 'remittance', 'business_permit', 'other']);

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
      visual_anomalies: arr<unknown>(raw.visual_anomalies).map(String).filter(Boolean)
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

const extract = async (apiKey: string, files: LoadedFile[]): Promise<Extracted> => {
   const parts: ChatPart[] = [];
   const unreadable: string[] = [];
   let page = 0;
   for (const f of files) {
      if (f.mime === 'application/pdf') {
         const pages = await pdfText(f.bytes).catch(() => [] as string[]);
         if (pages.some((t) => t.length > 40)) {
            for (const t of pages) parts.push({ type: 'text', text: `--- page ${++page} (from ${f.name}, PDF text) ---\n${t}` });
            continue;
         }
         // No text: a scan. Read the page photos inside it instead.
         const scans = pdfJpegs(f.bytes);
         if (!scans.length) {
            unreadable.push(f.name);
            continue;
         }
         for (const jpeg of scans) {
            parts.push({ type: 'text', text: `--- page ${++page} (from ${f.name}, scanned page) ---` });
            parts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${toBase64(jpeg)}`, detail: 'high' } });
         }
      } else {
         parts.push({ type: 'text', text: `--- page ${++page} (${f.name}, image) ---` });
         parts.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${toBase64(f.bytes)}`, detail: 'high' } });
      }
   }
   // Only throw when nothing at all could be read; one bad PDF shouldn't sink the others.
   if (!page) throw new Error(`${unreadable.join(', ')} is a scanned PDF with no text — ask for screenshots`);
   parts.push({ type: 'text', text: `Read these ${page} page(s) as one person's proof of income. Reply in json.` });
   return normalizeExtracted(await deepseekJson<Record<string, unknown>>(apiKey, SYSTEM, parts, 16000));
};

/** Text-only second opinion from the numbers + checks (no images, so it's cheap). */
const writeNote = async (apiKey: string, input: Record<string, unknown>) => {
   const out = await deepseekJson<{ verdict?: string; note?: string }>(
      apiKey,
      'You help a small lender decide on loans of $20–$150 to Filipino and Indonesian borrowers, repaid in one payment within about a month. Their target is 90% repaid on time. From the document summary, numbers and checks, write at most 3 short plain sentences: can they repay this amount from what comes in, what to ask them on the call, and any red flag. Cite rows like [T3] when you mention a number. Do not invent numbers. Reply with only a json object: {"verdict": "lend" | "maybe" | "decline", "note": "..."}',
      JSON.stringify(input),
      1500
   );
   const verdict = ['lend', 'maybe', 'decline'].includes(String(out.verdict)) ? String(out.verdict) : 'maybe';
   return out.note ? { verdict, note: String(out.note) } : null;
};

const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
   [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

const personOf = (user: { username?: string | null; display_name?: string | null } | null, id: string) =>
   user?.display_name?.trim() || (user?.username ? `@${user.username}` : id.slice(0, 8));

/** One send end to end: ping the team, read it, check it, save the result, reply under the ping. */
export const analyseIncomeDocument = async (supabase: SupabaseClient, id: string, apiKey: string | null | undefined) => {
   const { data: row, error: rowError } = await supabase
      .from('income_documents')
      .select('id, user_id, files, note, status, requested_amount, requested_repay')
      .eq('id', id)
      .maybeSingle();
   if (rowError || !row) return { ok: false, error: rowError?.message ?? 'not found' };
   if (row.status !== 'pending') return { ok: true, skipped: row.status };

   const files = (row.files ?? []) as Array<{ path: string; name?: string; mime?: string }>;
   const [{ data: user }, { data: kyc }, { data: loan }, { data: chat }, { data: stepsRow }] = await Promise.all([
      supabase.from('users').select('username, display_name, monthly_income').eq('id', row.user_id).maybeSingle(),
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
      supabase.from('telegram_bot_settings').select('value').eq('key', 'income_doc_tiers').maybeSingle()
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
   const ping = [`📄 Proof of income from ${who}`, `${files.length} file${files.length === 1 ? '' : 's'}${row.note ? ` · "${row.note}"` : ''}`, loanLine].join('\n');
   let pingId: number | undefined;
   if (chat?.value) {
      try {
         const sent = (await sendTelegramMessage(chat.value, ping, { inlineKeyboard: [[{ text: '👀 Review', url: ADMIN_URL }]] })) as { message_id?: number } | undefined;
         pingId = sent?.message_id;
      } catch (err) {
         console.error('income doc ping failed', err);
      }
   }
   await postDiscord({ embeds: [{ title: `📄 Proof of income — ${who}`, description: `${ping.split('\n').slice(1).join('\n')}\n${ADMIN_URL}`, color: 0x6b55f7 }] }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }).catch(() => undefined);
   // The result (read OK, couldn't read, resend asked…) goes to both places the ping went.
   const reply = async (text: string) => {
      if (chat?.value) await sendTelegramMessage(chat.value, text, { replyToMessageId: pingId }).catch(() => undefined);
      await postDiscord(
         { embeds: [{ title: `📄 Result — ${who}`, description: `${text.slice(0, 3900)}\n${ADMIN_URL}`, color: 0x6b55f7 }] },
         { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
      ).catch(() => undefined);
   };

   const finish = async (patch: Record<string, unknown>, replyText?: string) => {
      await supabase.from('income_documents').update({ ...patch, analyzed_at: new Date().toISOString() }).eq('id', id);
      if (replyText) await reply(replyText);
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
         `${fraud.length ? '🚨 Fraud signs · ' : ''}${VERDICT_LINE.resend}: ${RESEND_TEXT[reason]}\n(${teamNote})`
      );
      await notifyIncomeDecision(supabase, id);
      if (fraud.length) {
         const alert = `🚨 Possible fraud: ${who} sent this as proof of income\n${fraud.map((f) => `• ${f.detail}`).join('\n')}\n${loanLine}`;
         const { data: fraudChat } = await supabase.from('telegram_bot_settings').select('value').eq('key', 'fraud_alert_chat_id').maybeSingle();
         if (fraudChat?.value) {
            await sendTelegramMessage(fraudChat.value, alert, { inlineKeyboard: [[{ text: '👀 Review', url: ADMIN_URL }]] }).catch(() => undefined);
         }
         await postDiscord(
            { embeds: [{ title: `🚨 Possible fraud — ${who}`, description: `${alert.split('\n').slice(1).join('\n')}\n${ADMIN_URL}`, color: 0xe74c3c }] },
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
   let locked = false;
   let unsupported = false;
   for (const f of files) {
      const { data: blob, error } = await supabase.storage.from('income-docs').download(f.path);
      if (error || !blob) return toTeam({ status: 'failed', error: `download failed: ${f.path}` }, 'couldn’t open the files');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      hashes.push(await sha256(bytes));
      facts.push({ name: f.name ?? `file ${facts.length + 1}`, image: imageInfo(bytes), markers: fileMarkers(bytes) });
      const mime = f.mime && (f.mime === 'application/pdf' || IMAGE_TYPES.has(f.mime)) ? f.mime : blob.type;
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
   if (!doc.readable) {
      const note = `unreadable: ${doc.unreadable_reason ?? 'no reason given'}`;
      const patch = unreadablePatch(note, { doc_type: doc.doc_type, extracted: doc, model: MODEL });
      // Not a financial document: ask for a real one (AI tags are still listed for the team).
      if (doc.doc_type === 'other') return askResend(patch, 'not_financial', fileWarnings ? `${note}\n${fileWarnings}` : note);
      if (fileWarnings) return finish({ ...patch, verdict: 'needs_review' }, `${VERDICT_LINE.needs_review}: ${note}\n${fileWarnings}`);
      return askResend(patch, 'unreadable', note);
   }

   const keys = rowKeys(doc.transactions);
   const [{ data: dupes }, { data: sameRows }] = await Promise.all([
      supabase.from('income_documents').select('user_id').overlaps('file_hashes', hashes).neq('user_id', row.user_id),
      keys.length >= 5
         ? supabase.from('income_documents').select('user_id, row_keys').overlaps('row_keys', keys).neq('user_id', row.user_id).limit(20)
         : Promise.resolve({ data: [] as Array<{ user_id: string; row_keys: string[] }> })
   ]);
   const loanCtx: LoanContext | null =
      askedAmount != null ? { amount: askedAmount, total_repayment: askedRepay ?? askedAmount, due_date: row.requested_amount == null ? (loan?.due_date ?? null) : null } : null;
   const metrics = computeMetrics(doc);
   const flags = runChecks(doc, metrics, {
      pdfs,
      step,
      files: facts,
      rowMatches: (sameRows ?? []).map((r) => ({ user_id: r.user_id, share: rowOverlap(keys, r.row_keys ?? []) })),
      duplicateOf: dupes ?? [],
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

   let aiNote: { verdict: string; note: string } | null = null;
   if (verdict !== 'resend') {
      try {
         aiNote = await writeNote(apiKey, {
            loan: loanCtx,
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

   const patch = {
      status: 'done',
      tier: step,
      file_hashes: hashes,
      row_keys: keys,
      doc_type: doc.doc_type,
      extracted: doc,
      metrics,
      flags,
      memo,
      risk,
      score,
      checks,
      ai_note: aiNote ? `${aiNote.verdict.toUpperCase()}: ${aiNote.note}` : null,
      model: MODEL
   };
   if (verdict === 'resend' && reason) return askResend(patch, reason, `score ${score}/100`);
   const checkLine = checks.map((c) => `${c.status === 'pass' ? '✅' : c.status === 'warn' ? '🟠' : '🔴'} ${c.label}`).join('\n');
   // Small steps ($40 today): every check passed → approved without a team decision.
   const autoApprove = verdict === 'looks_good' && step?.autoApprove === true;
   const headline = autoApprove ? `✅ Approved automatically ($${step!.min} step)` : VERDICT_LINE[verdict];
   const result = await finish(
      {
         ...patch,
         verdict,
         ...(autoApprove ? { decision: 'approved', decided_at: new Date().toISOString(), decided_by: `auto ($${step!.min} step)` } : {})
      },
      [`${headline} · score ${score}/100${aiNote ? ` · AI says ${aiNote.verdict}` : ''}`, checkLine, memo, aiNote?.note].filter(Boolean).join('\n\n').slice(0, 3900)
   );
   if (autoApprove) await notifyIncomeDecision(supabase, id);
   return result;
};

const DOCUMENTS_URL = 'https://moodeng.app/documents';

/** What the borrower is told: the team's decision, or an automatic "please resend". Pure. */
export const decisionMessage = (kind: 'approved' | 'declined' | 'resend', reason: string | null) =>
   kind === 'approved'
      ? { title: 'Proof of income approved ✅', body: 'Thanks! Your document is verified. It helps your loan requests get funded.' }
      : kind === 'resend'
        ? { title: 'Let’s try that again', body: `${reason ?? 'Please send a clearer document.'} Questions? Message us on Facebook.` }
        : {
             title: 'We couldn’t approve your document',
             body: `${reason ? `${reason} ` : ''}You can send a different one any time, or message us on Facebook if you have questions.`
          };

/** Tell the borrower on push, Messenger and Telegram (whichever they have): a decision or a resend ask. */
export const notifyIncomeDecision = async (supabase: SupabaseClient, id: string) => {
   const { data: row } = await supabase.from('income_documents').select('id, user_id, decision, decision_reason, verdict, resend_reason').eq('id', id).maybeSingle();
   const kind: 'approved' | 'declined' | 'resend' | null = row?.decision ?? (row?.verdict === 'resend' ? 'resend' : null);
   if (!row || !kind) return { ok: false, error: 'nothing to tell' };
   const { data: user } = await supabase
      .from('users')
      .select('id, chat_id, notif_account_activity, messenger_psid')
      .eq('id', row.user_id)
      .maybeSingle();
   const msg = decisionMessage(kind, kind === 'resend' ? (RESEND_TEXT[row.resend_reason as ResendReason] ?? null) : row.decision_reason);
   // Indonesia track: in Bahasa on Telegram, always (instead of the English Telegram copy below).
   const idTrack = await isIdTrackUser(supabase, row.user_id);
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
   const button = kind === 'approved' ? 'Open Moodeng' : 'Send again';
   const sent: string[] = [];

   try {
      await sendPushToUser(supabase, row.user_id, () => ({ type: 'income_doc_decision', title: msg.title, body: msg.body, url: DOCUMENTS_URL, tag: 'income-doc' }), {
         urgency: 'high'
      });
      sent.push('push');
   } catch (err) {
      console.error('income decision push failed', err);
   }
   const messenger = await sendMessengerMessage(user?.messenger_psid, {
      text: `${msg.title}\n${msg.body}`,
      card: { title: msg.title, button: { title: button, url: DOCUMENTS_URL } }
   });
   if (messenger.ok) sent.push('Messenger');
   if (idSent) sent.push('Telegram');
   if (user?.chat_id && user.notif_account_activity !== false && !idTrack) {
      try {
         await sendTelegramMessage(user.chat_id, `${msg.title}\n\n${msg.body}`, { inlineKeyboard: [[{ text: button, url: DOCUMENTS_URL }]] });
         sent.push('Telegram');
      } catch (err) {
         console.error('income decision telegram failed', err);
      }
   }
   await supabase.from('income_documents').update({ notified_at: new Date().toISOString() }).eq('id', id);
   return { ok: true, sent };
};
