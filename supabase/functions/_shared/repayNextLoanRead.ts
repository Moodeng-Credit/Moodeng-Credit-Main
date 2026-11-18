import { sendTelegramMessage } from './telegram.ts';
import { alertDeepSeekFailure } from './deepseekAlert.ts';

// "Ready for a bigger loan?" read, posted as a reply under each "✅ Loan repaid" card in the team
// Telegram group. DeepSeek gets the borrower's call sheet (+ the Zoom summary if there is one), their
// income, how early they paid compared with the loan's term, the size of the loan they can take next,
// and how others on the same referral code paid — and says whether they look ready for that next loan.
// Advice only: nothing is approved or blocked by it.
//
// Off switch: telegram_bot_settings key 'repay_next_loan_read' = 'off'. Never throws.

type SupabaseClient = any;

const MODEL = 'deepseek-v4-pro';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type Loan = {
   id: string;
   tracking_id?: string | null;
   borrower_user_id?: string | null;
   loan_amount?: number | string | null;
   repaid_amount?: number | string | null;
   total_repayment_amount?: number | string | null;
   funded_at?: string | null;
   due_date?: string | null;
   repaid_at?: string | null;
   updated_at?: string | null;
   reason?: string | null;
   referral_code_id?: string | null;
};

type Read = {
   verdict?: string;
   timing?: string;
   afford?: string;
   reasons?: unknown;
   ask_on_messenger?: string;
};

const num = (v: unknown) => {
   const n = Number(v);
   return Number.isFinite(n) ? n : 0;
};
const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

const describeGap = (ms: number) => {
   const hours = ms / HOUR_MS;
   if (hours < 48) return `${Math.max(1, Math.round(hours))}h`;
   return `${Math.round(ms / DAY_MS)} days`;
};

/** How the repayment sat inside the loan's term — computed here so DeepSeek doesn't do date maths. */
export const describeTiming = (loan: Loan, now = new Date()) => {
   const funded = loan.funded_at ? new Date(loan.funded_at).getTime() : NaN;
   const due = loan.due_date ? new Date(loan.due_date).getTime() : NaN;
   const paid = new Date(loan.repaid_at ?? loan.updated_at ?? now.toISOString()).getTime();
   if (!Number.isFinite(funded) || !Number.isFinite(due) || due <= funded) {
      return { label: 'unknown', line: 'Timing unknown (no funding or due date).', heldMs: null as number | null, share: null as number | null };
   }
   const heldMs = Math.max(0, paid - funded);
   const share = heldMs / (due - funded);
   const early = due - paid;
   // End of the borrower's due day counts as on time (#1414): a day of grace.
   const label =
      early < -DAY_MS ? 'late' : heldMs < 3 * DAY_MS ? 'very_early' : share >= 0.6 || early <= 7 * DAY_MS ? 'near_on_time' : 'early';
   const line =
      label === 'late'
         ? `Paid ${describeGap(-early)} late.`
         : `Paid ${describeGap(heldMs)} after funding, ${describeGap(Math.max(0, early))} before due (used ${Math.round(share * 100)}% of the term).`;
   return { label, line, heldMs, share };
};

const SYSTEM_PROMPT = `You help a small micro-lender in the Philippines decide if a borrower who just repaid is ready for a bigger next loan. Loans are small ($15-$140 USDC, about 58 PHP per USD), 10% interest, usually 1 month. Each full repayment raises the limit.

The known scam: a group of people (often recruited by one person via the same referral code) take the smallest loan and repay it within a day or two, just to climb to bigger limits, then stop paying. Real borrowers who need money for a business or bills usually hold it for a while and pay near the due date. Repaying early is NOT bad by itself — weigh it with the rest: does the call sheet story make sense for holding the money that briefly (e.g. stock bought and sold fast), do others on the same referral code show the same fast pattern, does the income cover the next loan.

Judge:
1. timing: "suspicious_early" | "early_ok" | "on_time" | "late"
2. afford: can their monthly income (from the call sheet notes first, the sign-up form second) cover the NEXT loan's repayment? "yes" | "tight" | "no" | "unknown"
3. verdict: "ready" (fine to lend the next amount), "check" (talk to them first), "hold" (don't raise yet)

Reply in JSON only:
{"verdict": "...", "timing": "...", "afford": "...", "reasons": ["max 3 short plain-English reasons, each under 18 words, citing the actual facts"], "ask_on_messenger": "one short question the team could ask them, or empty"}`;

const loadContext = async (svc: SupabaseClient, loan: Loan) => {
   const uid = loan.borrower_user_id!;
   const [userRes, sheetRes, transcriptRes, loansRes, capRes, docRes] = await Promise.all([
      svc
         .from('users')
         .select('username, created_at, profession, income_type, income_description, monthly_income, monthly_expenses, other_income, payday_type, cs, is_didit, is_world_id, redeemed_referral_code_id')
         .eq('id', uid)
         .maybeSingle(),
      svc.from('call_screenings').select('answers, notes, red_flags, score, call_starts_at').eq('user_id', uid).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      svc.from('call_transcripts').select('summary, risk_level').eq('user_id', uid).not('summary', 'is', null).order('call_started_at', { ascending: false }).limit(1).maybeSingle(),
      svc.from('loans').select('id, loan_amount, funded_at, due_date, repaid_at, repayment_status, loan_status').eq('borrower_user_id', uid).not('funded_at', 'is', null).order('funded_at'),
      svc.from('borrower_loan_caps').select('cap_usd, note').eq('user_id', uid).maybeSingle(),
      svc.from('income_documents').select('verdict, decision, score').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle()
   ]);
   const user = userRes.data ?? {};

   // Next loan size = the credit-limit rule the app uses (cs clamped to $15–$140 once ID-verified), held to any team cap.
   const verified = String(user.is_didit) === 'ACTIVE' || String(user.is_world_id) === 'ACTIVE';
   const limit = Math.min(Math.max(num(user.cs), 15), 140);
   const cap = capRes.data?.cap_usd != null ? num(capRes.data.cap_usd) : null;
   const nextAmount = cap != null ? Math.min(limit, cap) : limit;

   // Others who joined on the same referral code: how fast did they pay back?
   let siblings: { borrowers: number; loans: number; repaidWithin3Days: number; unpaid: number; lateOrDefaulted: number } | null = null;
   const codeId = user.redeemed_referral_code_id ?? loan.referral_code_id;
   if (codeId) {
      const { data: sib } = await svc.from('users').select('id').eq('redeemed_referral_code_id', codeId).neq('id', uid).limit(200);
      const ids = (sib ?? []).map((r: { id: string }) => r.id);
      if (ids.length) {
         const { data: sl } = await svc.from('loans').select('funded_at, due_date, repaid_at, repayment_status').in('borrower_user_id', ids).not('funded_at', 'is', null);
         const rows = (sl ?? []) as Array<{ funded_at: string; due_date: string | null; repaid_at: string | null; repayment_status: string | null }>;
         const now = Date.now();
         siblings = {
            borrowers: ids.length,
            loans: rows.length,
            repaidWithin3Days: rows.filter((r) => r.repaid_at && new Date(r.repaid_at).getTime() - new Date(r.funded_at).getTime() < 3 * DAY_MS).length,
            unpaid: rows.filter((r) => r.repayment_status !== 'Paid').length,
            lateOrDefaulted: rows.filter((r) => r.repayment_status !== 'Paid' && r.due_date && new Date(r.due_date).getTime() + DAY_MS < now).length
         };
      }
   }

   return {
      user,
      sheet: sheetRes.data ?? null,
      transcript: transcriptRes.data ?? null,
      history: (loansRes.data ?? []) as Array<Record<string, unknown>>,
      doc: docRes.data ?? null,
      verified,
      nextAmount,
      cap,
      siblings
   };
};

const askDeepSeek = async (apiKey: string, userContent: string): Promise<Read | null> => {
   const ctrl = new AbortController();
   const timer = setTimeout(() => ctrl.abort(), 60_000);
   try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
         method: 'POST',
         signal: ctrl.signal,
         headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
            model: MODEL,
            thinking: { type: 'disabled' },
            temperature: 0.2,
            max_tokens: 600,
            response_format: { type: 'json_object' },
            messages: [
               { role: 'system', content: SYSTEM_PROMPT },
               { role: 'user', content: userContent }
            ]
         })
      });
      if (!res.ok) {
         await alertDeepSeekFailure('repay-next-loan-read', res.status);
         return null;
      }
      const body = await res.json();
      return JSON.parse(body?.choices?.[0]?.message?.content ?? '{}') as Read;
   } finally {
      clearTimeout(timer);
   }
};

const VERDICT: Record<string, string> = { ready: '✅ Ready for next loan', check: '🟡 Check with them first', hold: '🛑 Hold — don\'t raise yet' };
const TIMING: Record<string, string> = { suspicious_early: '⚠️ suspiciously early', early_ok: 'early, looks fine', on_time: 'on time', late: 'late' };
const AFFORD: Record<string, string> = { yes: 'covers it', tight: 'tight', no: 'doesn\'t cover it', unknown: 'unknown' };

export const buildNextLoanReadText = (args: {
   username: string;
   loanAmount: number;
   nextAmount: number;
   verified: boolean;
   cap: number | null;
   timingLine: string;
   hasSheet: boolean;
   siblingsLine: string;
   read: Read;
}) => {
   const { read } = args;
   const reasons = Array.isArray(read.reasons) ? read.reasons.filter((r) => typeof r === 'string' && r.trim()).slice(0, 3) : [];
   const nextLine = args.verified
      ? `Next loan: up to ${usd(args.nextAmount)} (this one ${usd(args.loanAmount)})${args.cap != null ? ` · team cap ${usd(args.cap)}` : ''}`
      : `Next loan: ID not verified, limit stays ${usd(args.loanAmount)}`;
   return [
      `🤖 Next-loan read · ${args.username}`,
      VERDICT[String(read.verdict)] ?? `Verdict: ${read.verdict ?? 'unclear'}`,
      nextLine,
      `Timing: ${args.timingLine} → ${TIMING[String(read.timing)] ?? read.timing ?? '?'}`,
      `Income vs next repayment: ${AFFORD[String(read.afford)] ?? read.afford ?? '?'}`,
      args.siblingsLine,
      args.hasSheet ? '' : '⚠️ No call sheet on file',
      ...reasons.map((r) => `• ${r}`),
      read.ask_on_messenger?.trim() ? `Ask: ${read.ask_on_messenger.trim()}` : '',
      'AI advice only — nothing was changed.'
   ]
      .filter(Boolean)
      .join('\n');
};

/** Post the read as a reply to the "Loan repaid" card. Never throws. */
export const postRepayNextLoanRead = async (
   svc: SupabaseClient,
   loan: Loan,
   chatId: string | number,
   replyToMessageId?: number
): Promise<boolean> => {
   try {
      if (!loan.borrower_user_id) return false;
      const { data: toggle } = await svc.from('telegram_bot_settings').select('value').eq('key', 'repay_next_loan_read').maybeSingle();
      if (String(toggle?.value ?? '').trim().toLowerCase() === 'off') return false;
      const apiKey = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
      if (!apiKey) return false;

      const ctx = await loadContext(svc, loan);
      const timing = describeTiming(loan);
      const loanAmount = num(loan.loan_amount);
      const s = ctx.siblings;
      const siblingsLine =
         s && s.loans
            ? `Same referral code: ${s.borrowers} others, ${s.loans} loans — ${s.repaidWithin3Days} repaid within 3 days, ${s.unpaid} unpaid${s.lateOrDefaulted ? ` (${s.lateOrDefaulted} past due)` : ''}`
            : '';

      const content = [
         `THIS LOAN: ${usd(loanAmount)} borrowed, repaid ${usd(num(loan.repaid_amount ?? loan.total_repayment_amount))}. Reason given: ${loan.reason ?? '—'}`,
         `TIMING: ${timing.line} (label: ${timing.label})`,
         `NEXT LOAN: ${ctx.verified ? `up to ${usd(ctx.nextAmount)}, repay about ${usd(Math.round(ctx.nextAmount * 1.1 * 100) / 100)}` : 'not ID-verified, no increase'}`,
         `LOAN HISTORY (oldest first): ${JSON.stringify(ctx.history)}`,
         `SIGN-UP FORM: ${JSON.stringify(ctx.user)}`,
         `HOST CALL SHEET: ${ctx.sheet ? JSON.stringify(ctx.sheet) : 'none'}`,
         `ZOOM CALL SUMMARY: ${ctx.transcript ? JSON.stringify(ctx.transcript) : 'none'}`,
         `PROOF OF INCOME: ${ctx.doc ? JSON.stringify(ctx.doc) : 'none'}`,
         `SAME REFERRAL CODE: ${s ? JSON.stringify(s) : 'no referral code'}`
      ].join('\n\n');

      const read = await askDeepSeek(apiKey, content);
      if (!read) return false;

      const text = buildNextLoanReadText({
         username: String(ctx.user.username ?? 'borrower'),
         loanAmount,
         nextAmount: ctx.nextAmount,
         verified: ctx.verified,
         cap: ctx.cap,
         timingLine: timing.line,
         hasSheet: Boolean(ctx.sheet),
         siblingsLine,
         read
      });
      await sendTelegramMessage(chatId, text, { replyToMessageId });
      return true;
   } catch (err) {
      console.error('repayNextLoanRead failed for', loan.id, err instanceof Error ? err.message : err);
      return false;
   }
};
