import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// Tells the team a borrower has claimed a GrabFood voucher, so someone buys and sends it.
// Called by the AFTER INSERT trigger on public.voucher_claims (migration 20260924200000).
//
// Channels:
//   - Telegram: the private team group (telegram_bot_settings.team_group_chat_id, falling back to
//     TEAM_TELEGRAM_CHAT_ID) — the people who fulfil vouchers. Not the lender or support group.
//   - Discord: DISCORD_REWARDS_WEBHOOK_URL for a dedicated rewards channel; until that secret is
//     set it falls back to #repayments (DISCORD_REPAY_WEBHOOK_URL — a voucher is earned by an
//     on-time repayment), then the shared team channel.
// The mobile number is partly masked in both; the full details are in admin → Referrals.
// Best-effort: the claim is already saved, so a failed ping never errors the caller.

const REWARD_LABEL: Record<string, string> = {
   first_on_time_repayment: 'First on-time repayment',
   referral_inviter: 'Referral — inviter (friend repaid on time)',
   referral_invitee: 'Referral — invited friend repaid on time'
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const getRequestSecret = (req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null;
   return bearerToken ?? req.headers.get('x-notification-secret');
};

// Same internal-only check as loan-request-lender-suggestions: the service key directly, or the
// DB-stored internal secret verifier.
const isAuthorized = async (supabase: SupabaseClient, req: Request): Promise<boolean> => {
   const requestSecret = getRequestSecret(req);
   if (!requestSecret) return false;
   const expectedSecret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expectedSecret && requestSecret === expectedSecret) return true;
   const { data, error } = await supabase.rpc('verify_internal_notification_secret', { candidate: requestSecret });
   return !error && data === true;
};

export const maskMobile = (mobile: string): string => {
   const digits = mobile.replace(/\D/g, '');
   if (digits.length < 7) return '•••';
   return `${digits.slice(0, 4)}•••${digits.slice(-4)}`;
};

const getTeamChatId = async (supabase: SupabaseClient): Promise<string | null> => {
   const { data } = await supabase.from('telegram_bot_settings').select('value').eq('key', 'team_group_chat_id').maybeSingle();
   return (data?.value as string | undefined) || Deno.env.get('TEAM_TELEGRAM_CHAT_ID') || null;
};

const adminUrl = () => {
   const siteUrl = Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app';
   return `${siteUrl.replace(/\/$/, '')}/admin/referrals`;
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);

   const body = await req.json().catch(() => ({}) as Record<string, unknown>);
   const claimId = typeof body.claimId === 'string' ? body.claimId : null;
   if (!claimId) return json({ error: 'claimId is required' }, 400);

   const { data: claim, error } = await supabase
      .from('voucher_claims')
      .select('id, user_id, reward, amount_php, full_name, mobile, email, status, created_at')
      .eq('id', claimId)
      .maybeSingle();
   if (error) return json({ error: error.message }, 500);
   if (!claim) return json({ error: 'Claim not found' }, 404);

   const { data: user } = await supabase.from('users').select('username').eq('id', claim.user_id).maybeSingle();
   const { count: pendingCount } = await supabase
      .from('voucher_claims')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

   const amount = `₱${Number(claim.amount_php).toLocaleString('en-PH')}`;
   const reward = REWARD_LABEL[claim.reward as string] ?? String(claim.reward);
   const who = user?.username ? `@${user.username}` : claim.user_id;
   const lines = [
      `🎁 New GrabFood voucher claim — ${amount}`,
      '',
      `Reward: ${reward}`,
      `Borrower: ${claim.full_name} (${who})`,
      `GCash mobile: ${maskMobile(claim.mobile as string)}`,
      `Pending claims: ${pendingCount ?? 1}`,
      '',
      `Send the voucher, then mark it sent: ${adminUrl()}`
   ];
   const text = lines.join('\n');

   const results = { telegram: false, discord: false };

   const chatId = await getTeamChatId(supabase);
   if (chatId) {
      try {
         await sendTelegramMessage(chatId, text, { inlineKeyboard: [[{ text: '🎁 Open voucher claims', url: adminUrl() }]] });
         results.telegram = true;
      } catch (err) {
         console.error('[voucher-claim-notification] telegram failed:', err instanceof Error ? err.message : err);
      }
   }

   results.discord = await postDiscord(
      {
         embeds: [
            {
               title: `🎁 GrabFood voucher claim — ${amount}`,
               description: `Send the voucher, then mark it sent in [admin → Referrals](${adminUrl()}).`,
               color: 0xffce1b,
               fields: [
                  { name: 'Reward', value: reward },
                  { name: 'Borrower', value: `${claim.full_name} (${who})`, inline: true },
                  { name: 'GCash mobile', value: maskMobile(claim.mobile as string), inline: true },
                  { name: 'Pending claims', value: String(pendingCount ?? 1), inline: true }
               ],
               timestamp: claim.created_at as string
            }
         ]
      },
      { prefer: ['DISCORD_REWARDS_WEBHOOK_URL', 'DISCORD_REPAY_WEBHOOK_URL'] }
   );

   return json({ ok: true, ...results });
});
