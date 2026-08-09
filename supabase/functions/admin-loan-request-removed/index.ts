import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notification-secret',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SUPPORT_TELEGRAM = 'https://t.me/jimmymoodengcredit';

const siteUrl = () => {
   const configured = Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL');
   const url = configured && /^https?:\/\//.test(configured) ? configured : 'https://dashboard.moodeng.app';
   return url.replace(/\/$/, '');
};

const money = (value: unknown) => `$${Number(value || 0).toFixed(2)} USDC`;

const escapeHtml = (value: string) =>
   value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Preset removal reasons. The admin picks one of these `code`s in the panel; `copy` is what the
 * borrower reads. Keep the copy non-accusatory — a removed request is not an accusation, and most
 * borrowers who trip these just misunderstood what the product is for.
 */
const REASONS = {
   speculative_investment: {
      label: 'Speculative / investment use',
      subject: 'About your Moodeng loan request',
      copy:
         "Moodeng loans can't be used to buy or trade crypto, stocks, or other investments. " +
         'We keep it that way on purpose: our loans exist to help you build a credit history and to cover ' +
         'real-life needs — medical bills, transport, family costs, or bridging a gap before payday.'
   },
   prohibited_use: {
      label: 'Prohibited use (gambling, lending on, etc.)',
      subject: 'About your Moodeng loan request',
      copy:
         'The purpose given for this request falls outside what Moodeng loans can be used for. ' +
         'Our loans are for everyday needs and emergencies, and for building your credit history.'
   },
   unclear_reason: {
      label: 'Reason unclear or incomplete',
      subject: 'About your Moodeng loan request',
      copy:
         "We couldn't tell from the reason given what the money was needed for. " +
         'Lenders on Moodeng read that reason before they fund, so a clear, specific one makes a real difference.'
   },
   duplicate_request: {
      label: 'Duplicate of an open request',
      subject: 'About your Moodeng loan request',
      copy: 'This request duplicated another one you already have open, so we removed the duplicate to keep your account tidy.'
   },
   not_eligible_yet: {
      label: 'Not eligible yet',
      subject: 'About your Moodeng loan request',
      copy:
         "Your account isn't eligible for this request just yet. This is usually about verification or credit " +
         'stage rather than anything you did wrong, and it changes as your account matures.'
   },
   needs_verification: {
      label: 'Needs verification before we can list it',
      subject: 'About your Moodeng loan request',
      copy:
         'We need to finish verifying a few details on your account before this request can be listed to lenders. ' +
         'Nothing is wrong with your account — we just want to get this right before lenders see it.'
   },
   test_request: {
      label: 'Test / non-genuine request',
      subject: 'About your Moodeng loan request',
      copy:
         'This looked like a test rather than a genuine request, so we removed it. ' +
         'No problem at all if you were just trying the app out.'
   },
   other: {
      label: 'Other (write your own message)',
      subject: 'About your Moodeng loan request',
      copy: ''
   }
} as const;

type ReasonCode = keyof typeof REASONS;

const isReasonCode = (value: unknown): value is ReasonCode =>
   typeof value === 'string' && Object.prototype.hasOwnProperty.call(REASONS, value);

const buildMessage = (opts: {
   name: string;
   trackingId: string | null;
   amount: unknown;
   reasonCode: ReasonCode;
   personalMessage: string | null;
   canReapply: boolean;
}) => {
   const { name, trackingId, amount, reasonCode, personalMessage, canReapply } = opts;
   const reason = REASONS[reasonCode];
   const loanLabel = trackingId ? `loan request ${trackingId}` : 'recent loan request';
   const amountLabel = Number(amount || 0) > 0 ? ` for ${money(amount)}` : '';

   const paragraphs = [
      `Hi ${name},`,
      `We've removed your ${loanLabel}${amountLabel}.`,
      ...(reason.copy ? [reason.copy] : []),
      ...(personalMessage ? [`A note from the team: ${personalMessage}`] : []),
      canReapply
         ? 'Your account is still active and in good standing. You can submit a new request whenever you like — just describe what the money is actually for, and it will be reviewed as normal.'
         : 'Your account is still active. Please get in touch with us before submitting another request.',
      `If you have questions, reply to this email or message us on Telegram: ${SUPPORT_TELEGRAM}`
   ];

   const text = `${paragraphs.join('\n\n')}\n\n— The Moodeng Credit team`;

   const htmlParagraphs = paragraphs
      .map(
         (p) =>
            `<p style="margin:0 0 16px;color:#100733;font-size:15px;line-height:1.55;">${escapeHtml(p).replace(
               SUPPORT_TELEGRAM,
               `<a href="${SUPPORT_TELEGRAM}" style="color:#6010d2;">Telegram</a>`
            )}</p>`
      )
      .join('');

   const html =
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">` +
      htmlParagraphs +
      `<p style="margin:24px 0 16px;"><a href="${siteUrl()}/dashboard" style="display:inline-block;background:#6010d2;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:15px;">Open your dashboard</a></p>` +
      `<p style="margin:0;color:#100733;font-size:15px;line-height:1.55;">— The Moodeng Credit team</p></div>`;

   return { subject: reason.subject, text, html };
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const body = await req.json().catch(() => ({} as Record<string, unknown>));

   // ---- Auth: an admin session, or the internal secret for system/cron callers -------------------
   let actorUserId: string | null = null;
   const internalSecret = req.headers.get('x-notification-secret')?.trim() ?? null;
   let internalAuthorized = false;

   if (internalSecret) {
      const { data, error } = await supabase.rpc('verify_internal_notification_secret', { candidate: internalSecret });
      if (error) return json({ error: `Secret check failed: ${error.message}` }, 500);
      internalAuthorized = data === true;
      if (!internalAuthorized) return json({ error: 'Unauthorized' }, 401);
   }

   if (!internalAuthorized) {
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

      actorUserId = callerId;
   }

   // ---- Input ------------------------------------------------------------------------------------
   const reasonCode = body.reasonCode;
   if (!isReasonCode(reasonCode)) {
      return json({ error: 'Invalid reasonCode', validReasonCodes: Object.keys(REASONS) }, 400);
   }

   const rawMessage = typeof body.personalMessage === 'string' ? body.personalMessage.trim() : '';
   const personalMessage = rawMessage ? rawMessage.slice(0, 1000) : null;
   if (reasonCode === 'other' && !personalMessage) {
      return json({ error: 'personalMessage is required when reasonCode is "other"' }, 400);
   }

   const canReapply = body.canReapply === undefined ? true : Boolean(body.canReapply);
   const dryRun = Boolean(body.dryRun);
   const channels = (body.channels ?? {}) as { email?: boolean; telegram?: boolean };
   const wantEmail = channels.email !== false;
   const wantTelegram = channels.telegram !== false;

   const loanId = typeof body.loanId === 'string' ? body.loanId : null;
   let borrowerUserId = typeof body.borrowerUserId === 'string' ? body.borrowerUserId : null;
   let trackingId = typeof body.trackingId === 'string' ? body.trackingId : null;
   let loanAmount: unknown = body.loanAmount ?? null;

   // ---- Remove the request (if it still exists) ---------------------------------------------------
   let removed = false;
   let alreadyRemoved = false;

   if (loanId) {
      const { data: loan, error: loanError } = await supabase
         .from('loans')
         .select('id, tracking_id, borrower_user_id, lender_user_id, loan_amount, loan_status')
         .eq('id', loanId)
         .maybeSingle();
      if (loanError) return json({ error: `Loan lookup failed: ${loanError.message}` }, 500);

      if (loan) {
         if (loan.loan_status !== 'Requested' || loan.lender_user_id) {
            return json({ error: 'Loan is already funded or no longer a pending request; refusing to remove it.' }, 409);
         }

         borrowerUserId = borrowerUserId ?? loan.borrower_user_id;
         trackingId = trackingId ?? loan.tracking_id;
         loanAmount = loanAmount ?? loan.loan_amount;

         if (!dryRun) {
            await supabase
               .from('loan_request_delete_events')
               .insert({ loan_id: loan.id, borrower_user_id: loan.borrower_user_id });

            const { error: deleteError } = await supabase
               .from('loans')
               .delete()
               .eq('id', loan.id)
               .eq('loan_status', 'Requested')
               .is('lender_user_id', null);
            if (deleteError) return json({ error: `Delete failed: ${deleteError.message}` }, 500);

            removed = true;
         }
      } else {
         alreadyRemoved = true;
      }
   }

   if (!borrowerUserId) {
      return json({ error: 'Missing borrowerUserId (required when the loan row no longer exists)' }, 400);
   }

   const { data: borrower } = await supabase
      .from('users')
      .select('id, username, display_name, email, chat_id')
      .eq('id', borrowerUserId)
      .maybeSingle();
   if (!borrower) return json({ error: 'Borrower not found' }, 404);

   const name = (borrower.display_name || borrower.username || 'there').toString().trim();
   const { subject, text, html } = buildMessage({ name, trackingId, amount: loanAmount, reasonCode, personalMessage, canReapply });

   if (dryRun) {
      return json({ dryRun: true, removed: false, wouldRemove: Boolean(loanId) && !alreadyRemoved, preview: { subject, text } });
   }

   // ---- Notify ------------------------------------------------------------------------------------
   let emailSent = false;
   let telegramSent = false;
   const errors: string[] = [];

   if (wantEmail && borrower.email?.trim()) {
      try {
         await sendEmail(borrower.email.trim(), subject, text, html);
         emailSent = true;
      } catch (e) {
         errors.push(`email: ${e instanceof Error ? e.message : String(e)}`);
      }
   }

   if (wantTelegram && borrower.chat_id) {
      try {
         const { data: setting } = await supabase
            .from('telegram_bot_settings')
            .select('value')
            .eq('key', 'borrower_notifications_enabled')
            .maybeSingle();

         if (setting?.value === 'true') {
            await sendTelegramMessage(borrower.chat_id, `${subject}\n\n${text}`, {
               inlineKeyboard: [[{ text: 'Contact Support', url: SUPPORT_TELEGRAM }]]
            });
            telegramSent = true;
         }
      } catch (e) {
         errors.push(`telegram: ${e instanceof Error ? e.message : String(e)}`);
      }
   }

   await supabase.from('admin_audit_logs').insert({
      actor_user_id: actorUserId,
      action: 'loan_request_removed',
      target_table: 'loans',
      target_id: loanId,
      target_user_id: borrowerUserId,
      metadata: {
         tracking_id: trackingId,
         loan_amount: loanAmount,
         reason_code: reasonCode,
         reason_label: REASONS[reasonCode].label,
         personal_message: personalMessage,
         can_reapply: canReapply,
         removed_now: removed,
         already_removed: alreadyRemoved,
         email_sent: emailSent,
         telegram_sent: telegramSent,
         via: actorUserId ? 'admin' : 'internal',
         errors
      }
   });

   return json({ removed, alreadyRemoved, emailSent, telegramSent, subject, errors });
});
