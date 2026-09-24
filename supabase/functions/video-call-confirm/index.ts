import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import { getAdminChatId } from '../_shared/loanAccess.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import { formatCallTime } from '../_shared/videoCall.ts';

// Target of the "✅ I'll be there" button in the Messenger booking confirmation / reminders.
//
// GET ?t=<token>. verify_jwt is OFF (config.toml) because the tap comes from Messenger's in-app
// browser with no Supabase session; the per-booking random token (users.video_call_confirm_token,
// reset on every new booking) is the only credential, and all it can do is stamp
// video_call_confirmed_at. Always answers with a redirect into the app, never an error page.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE_URL = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');

const redirect = (result: 'yes' | 'expired') =>
   new Response(null, { status: 302, headers: { Location: `${SITE_URL}/request-board?callConfirmed=${result}` } });

serve(async (req) => {
   const token = new URL(req.url).searchParams.get('t')?.trim() ?? '';
   if (!/^[0-9a-f]{32}$/i.test(token) || !SUPABASE_URL || !SERVICE_KEY) return redirect('expired');

   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   const { data: user, error } = await svc
      .from('users')
      .select('id, username, display_name, email, video_call_starts_at, video_call_timezone, video_call_confirmed_at')
      .eq('video_call_confirm_token', token)
      .maybeSingle();
   if (error || !user?.video_call_starts_at) return redirect('expired');

   // A token for a call that's long over is stale — don't stamp it.
   if (Date.parse(user.video_call_starts_at) < Date.now() - 60 * 60 * 1000) return redirect('expired');

   // First tap only: stamp + tell the team. Repeat taps just land back in the app.
   if (!user.video_call_confirmed_at) {
      const { error: updateError } = await svc
         .from('users')
         .update({ video_call_confirmed_at: new Date().toISOString() })
         .eq('id', user.id)
         .is('video_call_confirmed_at', null);
      if (updateError) {
         console.error('video-call-confirm: update failed', updateError.message);
         return redirect('expired');
      }

      const who = [user.display_name, user.username ? `@${user.username}` : null, user.email].filter(Boolean).join(' · ') || user.id;
      const text = `✅ ${who} confirmed they'll attend their call — ${formatCallTime(user.video_call_starts_at, 'Asia/Bangkok')}`;
      try {
         const chat = await getAdminChatId(svc);
         if (chat) await sendTelegramMessage(chat, text);
      } catch (err) {
         console.error('video-call-confirm: telegram failed', err instanceof Error ? err.message : err);
      }
      await postDiscord({ content: text }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
   }

   return redirect('yes');
});
