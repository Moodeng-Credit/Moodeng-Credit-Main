import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// Admin-triggered borrower notifications for the /admin "Coming due" + "Loan extensions" tabs.
//   kind='extension' — a loan's due date was pushed out (admin_extend_loan already ran).
//   kind='nudge'     — a reminder that a loan is coming due / overdue.
// Borrowers get email + Telegram (lenders are intentionally NOT notified). A team Telegram
// channel (George + Emma) gets a heads-up copy so the team can follow up.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SUPPORT_EMAIL = 'support@moodengcredit.com';
const SUPPORT_TELEGRAM = 'https://t.me/jimmymoodengcredit';

const siteUrl = () => {
   const configured = Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL');
   const url = configured && /^https?:\/\//.test(configured) ? configured : 'https://dashboard.moodeng.app';
   return url.replace(/\/$/, '');
};

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;
const shortDate = (iso: string | null) => {
   if (!iso) return '—';
   const d = new Date(iso);
   return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
const dayWord = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // --- Verify the caller is an active Moodeng admin (mirrors app_private.is_moodeng_admin) ---
   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);

   const { data: userData, error: userError } = await supabase.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);

   const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);

   const body = await req.json().catch(() => ({}));
   const kind: 'extension' | 'nudge' = body.kind;
   const loanId: string | undefined = body.loanId;
   if (kind !== 'extension' && kind !== 'nudge') return json({ error: 'Invalid kind' }, 400);
   if (!loanId) return json({ error: 'Missing loanId' }, 400);

   const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select('id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date')
      .eq('id', loanId)
      .maybeSingle();
   if (loanError || !loan) return json({ error: 'Loan not found' }, 404);

   const borrowerId = loan.borrower_user_id;
   if (!borrowerId) return json({ error: 'Loan has no borrower' }, 400);

   const { data: borrower } = await supabase
      .from('users')
      .select('id, username, email, chat_id')
      .eq('id', borrowerId)
      .maybeSingle();

   const outstanding = Math.max(0, Number(loan.total_repayment_amount || 0) - Number(loan.repaid_amount || 0));
   const dueLabel = shortDate(loan.due_date);
   const repayUrl = `${siteUrl()}/repay`;

   // --- Compose borrower copy ---
   let subject: string;
   let intro: string;
   if (kind === 'extension') {
      const prev = shortDate(body.previousDueDate ?? null);
      const days = Number(body.daysExtended || 0);
      const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
      subject = 'Your Moodeng loan due date has been extended';
      intro =
         `Good news — we've extended your loan ${loan.tracking_id}. ` +
         `Your new due date is ${dueLabel}${prev !== '—' ? ` (moved from ${prev}` : ''}${days > 0 ? `, ${dayWord(days)} more` : ''}${prev !== '—' ? ')' : ''}.` +
         (reason ? `\n\nNote: ${reason}` : '') +
         `\n\nYou still owe ${money(outstanding)}.`;
   } else {
      const overdue = loan.due_date ? new Date(loan.due_date).getTime() < Date.now() : false;
      subject = overdue ? 'Your Moodeng loan is overdue' : 'Your Moodeng loan is coming due';
      intro = overdue
         ? `This is a reminder that your loan ${loan.tracking_id} was due on ${dueLabel} and still has ${money(outstanding)} outstanding. Please repay as soon as you can.`
         : `This is a friendly reminder that your loan ${loan.tracking_id} is due on ${dueLabel}, with ${money(outstanding)} outstanding. Please make sure you're ready to repay on time.`;
   }

   const helpLine = `If you're having any trouble repaying, please reach out — we're here to help. Email ${SUPPORT_EMAIL} or message us on Telegram at ${SUPPORT_TELEGRAM}.`;
   const emailText = `Hi ${borrower?.username ?? 'there'},\n\n${intro}\n\n${helpLine}\n\nRepay here: ${repayUrl}\n\n— The Moodeng Credit team`;
   const emailHtml =
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">` +
      `<p>Hi ${borrower?.username ?? 'there'},</p>` +
      `<p>${intro.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` +
      `<p><a href="${repayUrl}" style="display:inline-block;background:#8336f0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700">Repay now</a></p>` +
      `<p>${helpLine.replace(SUPPORT_EMAIL, `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`).replace(SUPPORT_TELEGRAM, `<a href="${SUPPORT_TELEGRAM}">Telegram</a>`)}</p>` +
      `<p>— The Moodeng Credit team</p></div>`;

   const telegramText = `${subject}\n\n${intro}\n\n${helpLine}`;

   let borrowerEmailSent = false;
   let borrowerTelegramSent = false;
   const errors: string[] = [];

   if (borrower?.email?.trim()) {
      try {
         await sendEmail(borrower.email.trim(), subject, emailText, emailHtml);
         borrowerEmailSent = true;
      } catch (e) {
         errors.push(`email: ${e instanceof Error ? e.message : String(e)}`);
      }
   }

   if (borrower?.chat_id) {
      try {
         await sendTelegramMessage(borrower.chat_id, telegramText, {
            inlineKeyboard: [[{ text: 'Open Repay', url: repayUrl }]]
         });
         borrowerTelegramSent = true;
      } catch (e) {
         errors.push(`telegram: ${e instanceof Error ? e.message : String(e)}`);
      }
   }

   // --- Team channel heads-up (George + Emma). No-op if the channel isn't configured yet. ---
   let teamNotified = false;
   const teamChatId = Deno.env.get('TEAM_TELEGRAM_CHAT_ID');
   if (teamChatId) {
      const who = borrower?.username ?? borrowerId;
      const teamText =
         kind === 'extension'
            ? `📅 Loan extended\n${loan.tracking_id} · ${who}\nNew due date: ${dueLabel}${body.daysExtended ? ` (+${dayWord(Number(body.daysExtended))})` : ''}\nOutstanding: ${money(outstanding)}${body.reason ? `\nReason: ${String(body.reason).trim()}` : ''}\nBorrower notified: ${[borrowerEmailSent ? 'email' : null, borrowerTelegramSent ? 'telegram' : null].filter(Boolean).join(' + ') || 'none'}`
            : `🔔 Nudge sent\n${loan.tracking_id} · ${who}\nDue: ${dueLabel} · Outstanding: ${money(outstanding)}\nBorrower notified: ${[borrowerEmailSent ? 'email' : null, borrowerTelegramSent ? 'telegram' : null].filter(Boolean).join(' + ') || 'none'}`;
      try {
         const threadId = Deno.env.get('TEAM_TELEGRAM_THREAD_ID');
         await sendTelegramMessage(teamChatId, teamText, threadId ? { messageThreadId: Number(threadId) } : {});
         teamNotified = true;
      } catch (e) {
         errors.push(`team: ${e instanceof Error ? e.message : String(e)}`);
      }
   }

   return json({
      borrowerEmailSent,
      borrowerTelegramSent,
      teamNotified,
      teamConfigured: Boolean(teamChatId),
      errors
   });
});
