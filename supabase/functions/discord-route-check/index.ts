import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { resolveDiscordWebhookWithKey } from '../_shared/discord.ts';

// Ops check for Discord alert routing. For each team feed, reports which env key its alerts
// resolve to (never the URL itself) and, with { "send": true }, posts a clearly-labelled test
// embed through that same resolution so you can see which channel it lands in.
// Internal only: requires x-notification-secret (the vault SUPABASE_SECRET_KEY the crons use).

const FEEDS: Record<string, string[]> = {
   kyc: ['DISCORD_KYC_WEBHOOK_URL'],
   bookings: ['DISCORD_BOOKINGS_WEBHOOK_URL'],
   loan_requests: ['DISCORD_REQUESTS_WEBHOOK_URL'],
   new_users: ['DISCORD_NEW_USERS_WEBHOOK_URL'],
   cashout_face: ['DISCORD_KYC_WEBHOOK_URL', 'DISCORD_SECURITY_WEBHOOK_URL'],
   repayments: ['DISCORD_REPAY_WEBHOOK_URL']
};

// GET on a webhook URL returns its metadata (channel_id, name) without posting anything.
const webhookChannel = async (url: string | undefined): Promise<string | null> => {
   if (!url) return null;
   const res = await fetch(url).catch(() => null);
   if (!res?.ok) return null;
   const meta = await res.json().catch(() => null);
   return (meta as { channel_id?: string } | null)?.channel_id ?? null;
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body, null, 2), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const secret = req.headers.get('x-notification-secret')?.trim();
   if (!secret) return json({ error: 'Unauthorized' }, 401);
   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const { data: ok, error } = await supabase.rpc('verify_internal_notification_secret', { candidate: secret });
   if (error) return json({ error: `Secret check failed: ${error.message}` }, 500);
   if (ok !== true) return json({ error: 'Unauthorized' }, 401);

   const body = await req.json().catch(() => ({} as Record<string, unknown>));
   const only = typeof body.feed === 'string' ? body.feed : null;
   const send = body.send === true;

   const results: Record<string, unknown> = {};
   for (const [feed, prefer] of Object.entries(FEEDS)) {
      if (only && feed !== only) continue;
      const resolved = resolveDiscordWebhookWithKey(...prefer);
      const entry: Record<string, unknown> = {
         resolves_to: resolved?.key ?? null,
         channel_id: await webhookChannel(resolved?.url)
      };
      if (send && resolved) {
         const res = await fetch(resolved.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               embeds: [
                  {
                     title: `🧪 Routing test — ${feed}`,
                     description: `Test only, ignore. Sent via ${resolved.key}.`,
                     color: 0x95a5a6,
                     timestamp: new Date().toISOString()
                  }
               ]
            })
         }).catch(() => null);
         entry.sent = res?.ok ?? false;
         if (res && !res.ok) entry.status = res.status;
      }
      results[feed] = entry;
   }

   return json({
      logins_channel_id: await webhookChannel(Deno.env.get('DISCORD_LOGIN_WEBHOOK_URL')?.trim()),
      feeds: results
   });
});
