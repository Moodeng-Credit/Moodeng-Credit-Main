import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = ReturnType<typeof createClient>;

// Whether borrower Telegram notifications are globally enabled (admin toggle).
// Inlined from borrowerNotificationDelivery.ts so this function doesn't drag in
// the loan-notification builder graph it would otherwise pull through.
const getBorrowerTelegramNotificationsEnabled = async (supabase: SupabaseClient) => {
   const { data } = await supabase
      .from('telegram_bot_settings')
      .select('value')
      .eq('key', 'borrower_notifications_enabled')
      .maybeSingle();
   return data?.value === 'true';
};

const formatAmount = (amount: number) =>
   Number.isFinite(amount) ? amount.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(amount);

const shortRef = (hash: string) => (hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash);

const escapeHtml = (value: string) =>
   value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const siteUrl = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
const heroImageUrl = `${siteUrl}/hippos/hippo-purple-envelope-email.png`;
const telegramUrl = 'https://t.me/jimmymoodengcredit';
const facebookUrl = 'https://www.facebook.com/profile.php?id=61589106561061';

// Same palette and type scale as the branded loan emails in _shared/loanNotifications.ts.
const fontFamily = "-apple-system,BlinkMacSystemFont,'SF Pro','SF Pro Display','SF Pro Text','Segoe UI',Roboto,Arial,sans-serif";
const monoFamily = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const detailRow = (icon: string, label: string, value: string, tone: 'default' | 'good', first = false) => {
   const colors = tone === 'good' ? { bg: '#d9f7e5', color: '#148240' } : { bg: '#f5ecff', color: '#6010d2' };
   const borderTop = first ? '' : 'border-top:1px solid #e4d8f0;';
   return `<tr>
                  <td style="${borderTop}padding:9px 0;width:32px;vertical-align:middle;">
                    <span style="display:inline-block;width:24px;height:24px;border-radius:999px;background:${colors.bg};color:${colors.color};font-size:12px;line-height:24px;font-weight:590;text-align:center;">${icon}</span>
                  </td>
                  <td style="${borderTop}padding:9px 8px 9px 0;color:#100733;font-size:14px;line-height:19px;font-weight:500;">${label}</td>
                  <td style="${borderTop}padding:9px 0;color:${tone === 'good' ? colors.color : '#1c053d'};font-size:14px;line-height:19px;font-weight:500;text-align:right;">${value}</td>
                </tr>`;
};

const buildEmail = (amount: number, exchange: string, txHash: string, username?: string | null) => {
   const amt = formatAmount(amount);
   const name = username?.trim() || 'there';
   const subject = `Your ${amt} USDC withdrawal is on its way`;
   const text =
      `Hi ${name},\n\n` +
      `Your withdrawal of ${amt} USDC to ${exchange} has been sent and is on its way. ` +
      `It usually arrives within a few minutes.\n\n` +
      `If it hasn't arrived, contact support with this reference: ${txHash}\n\n` +
      `Telegram: ${telegramUrl}\nMoodeng Credit`;
   const html = `<div style="margin:0;padding:0;background:#f9f8fa;font-family:${fontFamily};color:#100733;-webkit-font-smoothing:antialiased;">
  <style>
    @media only screen and (max-width:480px) {
      .moodeng-shell { padding:8px !important; }
      .moodeng-body { padding:16px !important; }
      .moodeng-hero-img { width:104px !important; max-width:104px !important; }
    }
  </style>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9f8fa;">
    <tr>
      <td align="center" class="moodeng-shell" style="padding:16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:430px;border-collapse:separate;border-spacing:0;background:#fdfcfd;border:1px solid #e4d8f0;border-radius:14px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:16px;background:#1c053d;background:linear-gradient(135deg,#1c053d 0%,#170443 52%,#100229 100%);color:#fdfcfd;">
              <div style="font-size:20px;line-height:24px;font-weight:590;text-align:center;">Moodeng Credit</div>
            </td>
          </tr>
          <tr>
            <td class="moodeng-body" style="padding:20px 18px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:0 10px 14px 0;vertical-align:top;">
                    <span style="display:inline-block;margin:0 0 10px;padding:3px 10px;border-radius:999px;background:#d9f7e5;color:#148240;font-size:12px;line-height:18px;font-weight:590;">&#10003; Sent</span>
                    <p style="margin:0 0 4px;color:#5d24e8;font-size:16px;line-height:20px;font-weight:500;">Hi ${escapeHtml(name)},</p>
                    <h1 style="margin:0 0 6px;color:#1c053d;font-size:24px;line-height:28px;font-weight:590;">Your withdrawal is on its way</h1>
                    <p style="margin:0;color:#33294c;font-size:14px;line-height:20px;">It usually arrives within a few minutes.</p>
                  </td>
                  <td align="right" style="padding:0 0 14px;vertical-align:top;width:116px;">
                    <img class="moodeng-hero-img" src="${escapeHtml(heroImageUrl)}" alt="Moodeng mascot" width="116" style="display:block;width:116px;max-width:116px;height:auto;border:0;" />
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 10px;border-collapse:separate;border-spacing:0;border:1px solid #e4d8f0;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 14px;color:#33294c;font-size:14px;line-height:28px;font-weight:500;">Amount <span style="float:right;color:#1c053d;font-size:22px;line-height:28px;font-weight:590;">${amt}</span></td>
                  <td align="center" style="width:68px;padding:0 8px;background:#2775ca;color:#fdfcfd;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;">USDC</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 10px;border-collapse:separate;border-spacing:0;border:1px solid #e4d8f0;border-radius:12px;background:#fdfcfd;padding:0 12px;">
                ${detailRow('&rarr;', 'Sent to', escapeHtml(exchange), 'default', true)}
                ${detailRow('&#10003;', 'Status', 'On its way', 'good')}
                ${detailRow('&#9719;', 'Arrives', 'Within a few minutes', 'default')}
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0;border-collapse:separate;border-spacing:0;border:1px solid #e4d8f0;border-radius:12px;background:#fbf8ff;">
                <tr>
                  <td style="padding:12px 14px;">
                    <p style="margin:0 0 6px;color:#100733;font-size:14px;line-height:18px;font-weight:590;">Hasn't arrived?</p>
                    <p style="margin:0 0 8px;color:#33294c;font-size:13px;line-height:18px;">Message us with this reference and we'll track it down:</p>
                    <div style="padding:8px 10px;border:1px dashed #cbb5ec;border-radius:8px;background:#fdfcfd;color:#33294c;font-family:${monoFamily};font-size:12px;line-height:17px;word-break:break-all;">${escapeHtml(txHash)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px 4px;background:#f3e8ff;border-top:1px solid #e4d8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding-right:5px;width:50%;">
                    <a href="${telegramUrl}" style="display:block;border-radius:12px;background:#6010d2;color:#fdfcfd;text-align:center;text-decoration:none;font-size:14px;line-height:18px;font-weight:590;padding:11px 8px;">Chat on Telegram</a>
                  </td>
                  <td style="padding-left:5px;width:50%;">
                    <a href="${facebookUrl}" style="display:block;border:1px solid #6010d2;border-radius:12px;background:#fdfcfd;color:#6010d2;text-align:center;text-decoration:none;font-size:14px;line-height:18px;font-weight:590;padding:10px 8px;">Facebook</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 16px 14px;background:#f3e8ff;color:#786790;font-size:12px;line-height:16px;text-align:center;">
              Thanks for choosing Moodeng Credit. <span style="color:#8336f0;">&hearts;</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
   return { subject, text, html };
};

const buildTelegram = (amount: number, exchange: string, txHash: string) =>
   `✅ Your ${formatAmount(amount)} USDC withdrawal to ${exchange} is on its way — it usually arrives within a few minutes.\n\n` +
   `Reference: ${shortRef(txHash)}`;

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const { withdrawalId } = await req.json().catch(() => ({}));

   if (!withdrawalId) {
      return new Response(JSON.stringify({ error: 'withdrawalId is required' }), { status: 400, headers: corsHeaders });
   }

   const supabase: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
   );

   const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawals')
      .select('id, borrower_user_id, amount, exchange, tx_hash, notified_at')
      .eq('id', withdrawalId)
      .maybeSingle();

   if (withdrawalError) {
      return new Response(JSON.stringify({ error: withdrawalError.message }), { status: 500, headers: corsHeaders });
   }

   if (!withdrawal) {
      return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404, headers: corsHeaders });
   }

   // Dedup: only notify once per withdrawal, even if the client retries the invoke.
   if (withdrawal.notified_at) {
      return new Response(JSON.stringify({ message: 'Notification already sent' }), { status: 200, headers: corsHeaders });
   }

   const { data: borrower, error: borrowerError } = await supabase
      .from('users')
      .select('id, email, username, chat_id, notif_transaction_activity')
      .eq('id', withdrawal.borrower_user_id)
      .maybeSingle();

   if (borrowerError) {
      return new Response(JSON.stringify({ error: borrowerError.message }), { status: 500, headers: corsHeaders });
   }

   // Respect the borrower's money-movement notification preference.
   if (borrower?.notif_transaction_activity === false) {
      await supabase.from('withdrawals').update({ notified_at: new Date().toISOString() }).eq('id', withdrawal.id);
      return new Response(JSON.stringify({ message: 'Notifications disabled for user' }), { status: 200, headers: corsHeaders });
   }

   if (!borrower?.email && !borrower?.chat_id) {
      return new Response(JSON.stringify({ error: 'Borrower notification target not found' }), { status: 404, headers: corsHeaders });
   }

   const amount = Number(withdrawal.amount);
   let emailSent = false;
   let telegramSent = false;

   // Route by whatever channel the borrower actually has — email if they signed
   // up with email, Telegram if they connected it (most borrowers have one).
   if (borrower.email) {
      try {
         const { subject, text, html } = buildEmail(amount, withdrawal.exchange, withdrawal.tx_hash, borrower.username);
         await sendEmail(borrower.email, subject, text, html);
         emailSent = true;
      } catch (err) {
         console.error('Withdrawal email failed:', err instanceof Error ? err.message : err);
      }
   }

   if (borrower.chat_id) {
      try {
         const telegramEnabled = await getBorrowerTelegramNotificationsEnabled(supabase);
         if (telegramEnabled) {
            await sendTelegramMessage(borrower.chat_id, buildTelegram(amount, withdrawal.exchange, withdrawal.tx_hash));
            telegramSent = true;
         }
      } catch (err) {
         console.error('Withdrawal Telegram failed:', err instanceof Error ? err.message : err);
      }
   }

   if (!emailSent && !telegramSent) {
      return new Response(JSON.stringify({ error: 'No notification could be delivered' }), { status: 502, headers: corsHeaders });
   }

   await supabase.from('withdrawals').update({ notified_at: new Date().toISOString() }).eq('id', withdrawal.id);

   return new Response(JSON.stringify({ message: 'Notification sent', emailSent, telegramSent }), {
      status: 200,
      headers: corsHeaders
   });
});
