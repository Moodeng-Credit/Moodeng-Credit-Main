// Team Telegram alert for loan requests a borrower started but never sent (2026-11-15).
//
// The request board mirrors an in-progress request into public.loan_request_drafts (see
// src/lib/loanRequestDraftSync.ts). Every 15 minutes loan-weekly-digest {event:'unsent_requests'}
// posts one card per request that's been sitting untouched for UNSENT_IDLE_MINUTES, then stamps
// alerted_at so each request is posted once. Chat: telegram_bot_settings.unsent_requests_chat_id,
// falling back to kyc_alert_chat_id (the admin channel that already gets new loan requests).
// Pure: no Deno or network imports, so it can be unit-tested.

export const UNSENT_IDLE_MINUTES = 30;
// Older than this when first seen (e.g. the first run after launch): too stale to ping about.
export const UNSENT_MAX_AGE_HOURS = 72;
export const UNSENT_ADMIN_URL = 'https://moodeng.app/admin/requests';

// Same keys and words as src/lib/loanRequestDraftSync.ts (LOAN_REQUEST_STOP_STEP_LABEL).
const STOP_STEP_LABEL: Record<string, string> = {
   terms: 'Amount & terms',
   referral: 'Referral code',
   access_gated: 'Waiting on access (not approved / connect)',
   social: 'Facebook / social',
   contacts: 'Messenger & WhatsApp',
   bio1: 'About you',
   bio2: 'Repayment context',
   job: 'Your job',
   videocall: 'Meet the team (call)',
   income: 'Proof of income (saw the ask)',
   left_for_documents: 'Left to send proof of income',
   left_for_id_check: 'Left for the ID check'
};

export interface UnsentDraftForAlert {
   amount: number | string | null;
   repay: number | string | null;
   reason: string | null;
   due_date: string | null;
   stopped_at: string | null;
   started_at: string;
   updated_at: string;
   user: { username: string | null; display_name: string | null } | null;
}

const money = (n: number | string | null) => {
   const v = n === null || n === undefined || n === '' ? NaN : Number(n);
   return Number.isFinite(v) ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—';
};

const bkk = (iso: string) =>
   `${new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;

const dueLabel = (value: string | null) => {
   const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
   if (!m) return value || '—';
   return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
};

export const stopStepLabel = (step: string | null) => (step ? STOP_STEP_LABEL[step] ?? step : 'Unknown');

/** The card text (plain, no parse mode, so a reason with * or _ can't break it). */
export function buildUnsentRequestMessage(d: UnsentDraftForAlert): string {
   const name = d.user?.display_name?.trim();
   const handle = d.user?.username ? `@${d.user.username}` : null;
   const who = name && handle ? `${name} (${handle})` : name || handle || 'Unknown borrower';
   const reason = d.reason?.trim();
   return [
      '📝 Loan request started, not sent',
      who,
      `${money(d.amount)} → repay ${money(d.repay)} · due ${dueLabel(d.due_date)}`,
      ...(reason ? [`Reason: “${reason.length > 300 ? `${reason.slice(0, 300)}…` : reason}”`] : []),
      `Stopped at: ${stopStepLabel(d.stopped_at)}`,
      `Last change ${bkk(d.updated_at)} · started ${bkk(d.started_at)} (Bangkok)`
   ].join('\n');
}
