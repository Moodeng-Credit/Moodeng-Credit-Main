import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// One-step ban from the admin panel. In a single call it:
//   1. Bans the account: users.account_status = 'banned' and a 'banned' admin_account_restrictions
//      row carrying the admin's note (the panel's "Admin status" card reads it).
//   2. Revokes KYC (users.is_didit = 'INACTIVE') and adds the user to the internal kyc_blacklist.
//   3. Blocks them in Didit — not called from here: the sync_didit_user_status trigger fires on the
//      account_status change and calls didit-sync-user-status, so every ban path gets it.
//   4. Deletes their open, unfunded loan requests so no lender can fund them. Funded loans are never
//      touched — those still need to be repaid and go through the refund/default flow instead.
//   5. Tells the user by email + Telegram that the account has been closed (unless notify: false).
//   6. Writes one admin_audit_logs row with the full outcome.
//
// Every step runs even if an earlier one fails; failures come back in `errors`.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SUPPORT_TELEGRAM = 'https://t.me/jimmymoodengcredit';

const RESTRICTION_REASONS = new Set(['spam', 'default', 'duplicate', 'abuse', 'manual']);

const escapeHtml = (value: string) =>
   value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const buildBanMessage = (name: string) => {
   const subject = 'Your Moodeng account has been closed';
   const paragraphs = [
      `Hi ${name},`,
      'After a review, we have closed your Moodeng account. You can no longer sign in, request loans, or verify a new account with us.',
      'Any open loan requests on your account have been removed.',
      `If you believe this is a mistake, message us on Telegram: ${SUPPORT_TELEGRAM}`
   ];
   const text = `${paragraphs.join('\n\n')}\n\n— The Moodeng Credit team`;
   const html =
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">` +
      paragraphs
         .map(
            (p) =>
               `<p style="margin:0 0 16px;color:#100733;font-size:15px;line-height:1.55;">${escapeHtml(p).replace(
                  SUPPORT_TELEGRAM,
                  `<a href="${SUPPORT_TELEGRAM}" style="color:#6010d2;">Telegram</a>`
               )}</p>`
         )
         .join('') +
      `<p style="margin:0;color:#100733;font-size:15px;line-height:1.55;">— The Moodeng Credit team</p></div>`;
   return { subject, text, html };
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // ---- Auth: active admin only ------------------------------------------------------------------
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

   // ---- Input ------------------------------------------------------------------------------------
   const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
   const userId = typeof body.userId === 'string' ? body.userId : null;
   const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
   const reason = typeof body.reason === 'string' && RESTRICTION_REASONS.has(body.reason) ? body.reason : 'abuse';
   const notify = body.notify !== false;
   if (!userId) return json({ error: 'userId is required' }, 400);
   if (!note) return json({ error: 'A ban note is required' }, 400);
   if (userId === callerId) return json({ error: "You can't ban your own account" }, 400);

   const { data: target } = await supabase
      .from('users')
      .select('id, username, display_name, email, chat_id, wallet_address')
      .eq('id', userId)
      .maybeSingle();
   if (!target) return json({ error: 'User not found' }, 404);

   const { data: targetAdmin } = await supabase.from('admin_users').select('user_id').eq('user_id', userId).eq('active', true).maybeSingle();
   if (targetAdmin) return json({ error: 'That user is an active admin — remove their admin role first' }, 409);

   const errors: string[] = [];
   const nowIso = new Date().toISOString();

   // ---- 1. Ban + restriction record ----------------------------------------------------------------
   const { error: restrictionError } = await supabase.from('admin_account_restrictions').upsert(
      {
         user_id: userId,
         status: 'banned',
         reason,
         risk_level: 'high',
         admin_note: note,
         evidence_summary: `Banned from the admin panel on ${nowIso.slice(0, 10)}. ${note}`.slice(0, 1000),
         restricted_at: nowIso,
         unrestricted_at: null,
         updated_by: callerId,
         updated_at: nowIso
      },
      { onConflict: 'user_id' }
   );
   if (restrictionError) errors.push(`restriction: ${restrictionError.message}`);

   // Set explicitly too, so the ban lands even if the restriction upsert failed. This update is what
   // fires the Didit BLOCKED sync trigger.
   const { error: banError } = await supabase.from('users').update({ account_status: 'banned', is_didit: 'INACTIVE' }).eq('id', userId);
   if (banError) errors.push(`ban: ${banError.message}`);

   // ---- 2. Internal KYC blacklist ----------------------------------------------------------------
   const { error: blacklistError } = await supabase.from('kyc_blacklist').upsert(
      {
         user_id: userId,
         email: target.email || null,
         wallet_address: target.wallet_address || null,
         reason: note,
         source: 'admin_ban',
         didit_pushed: false,
         created_by: callerId
      },
      { onConflict: 'user_id' }
   );
   if (blacklistError) errors.push(`kyc_blacklist: ${blacklistError.message}`);

   // ---- 4. Delete open, unfunded requests ----------------------------------------------------------
   const { data: openRequests, error: openError } = await supabase
      .from('loans')
      .select('id, tracking_id, loan_amount')
      .eq('borrower_user_id', userId)
      .eq('loan_status', 'Requested')
      .is('lender_user_id', null)
      .is('funded_at', null);
   if (openError) errors.push(`requests(lookup): ${openError.message}`);

   const removedRequests: { tracking_id: string | null; loan_amount: unknown }[] = [];
   for (const loan of openRequests ?? []) {
      await supabase.from('loan_request_delete_events').insert({ loan_id: loan.id, borrower_user_id: userId });
      const { error: deleteError } = await supabase
         .from('loans')
         .delete()
         .eq('id', loan.id)
         .eq('loan_status', 'Requested')
         .is('lender_user_id', null);
      if (deleteError) errors.push(`requests(delete ${loan.tracking_id}): ${deleteError.message}`);
      else removedRequests.push({ tracking_id: loan.tracking_id, loan_amount: loan.loan_amount });
   }

   // ---- 5. Notify the user -----------------------------------------------------------------------
   let emailSent = false;
   let telegramSent = false;
   if (notify) {
      const name = (target.display_name || target.username || 'there').toString().trim();
      const { subject, text, html } = buildBanMessage(name);

      if (target.email?.trim()) {
         try {
            await sendEmail(target.email.trim(), subject, text, html);
            emailSent = true;
         } catch (e) {
            errors.push(`email: ${e instanceof Error ? e.message : String(e)}`);
         }
      }

      if (target.chat_id) {
         try {
            await sendTelegramMessage(target.chat_id, `${subject}\n\n${text}`, {
               inlineKeyboard: [[{ text: 'Contact Support', url: SUPPORT_TELEGRAM }]]
            });
            telegramSent = true;
         } catch (e) {
            errors.push(`telegram: ${e instanceof Error ? e.message : String(e)}`);
         }
      }
   }

   // ---- 6. Audit ---------------------------------------------------------------------------------
   await supabase.from('admin_audit_logs').insert({
      actor_user_id: callerId,
      action: 'account_banned',
      target_table: 'users',
      target_id: userId,
      target_user_id: userId,
      metadata: {
         username: target.username,
         note,
         reason,
         removed_requests: removedRequests,
         notify,
         email_sent: emailSent,
         telegram_sent: telegramSent,
         errors,
         source: 'live_admin_panel'
      }
   });

   return json({
      ok: !banError,
      banned: !banError,
      removedRequests: removedRequests.length,
      emailSent,
      telegramSent,
      errors
   });
});
