import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';

// Called when a borrower continues the loan request without confirming Facebook Messenger (the m.me
// link never reached our bot: Facebook Lite, Messenger Lite, no Messenger app). Stamps
// users.contact_step_skipped_at and asks the team on Discord to reach them another way, so the
// borrower isn't stuck and we still get a line to them.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// One ping per borrower per day, however many times they reopen the step.
const REPING_AFTER_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false }
   });
   const {
      data: { user },
      error: userError
   } = await supabase.auth.getUser(token);
   if (userError || !user) return json({ error: 'Invalid authorization token' }, 401);

   const { data: profile } = await supabase
      .from('users')
      .select('username, display_name, email, contact_step_skipped_at, messenger_verified_at')
      .eq('id', user.id)
      .maybeSingle();
   if (profile?.messenger_verified_at) return json({ ok: true, alreadyVerified: true });

   const now = new Date();
   const lastSkip = profile?.contact_step_skipped_at ? Date.parse(profile.contact_step_skipped_at) : Number.NaN;
   const shouldPing = Number.isNaN(lastSkip) || now.getTime() - lastSkip > REPING_AFTER_MS;

   const { error: updateError } = await supabase.from('users').update({ contact_step_skipped_at: now.toISOString() }).eq('id', user.id);
   if (updateError) console.error('[contact-step-skipped] stamp failed', updateError.message);

   if (shouldPing) {
      const name = profile?.display_name || profile?.username || user.id;
      await postDiscord(
         {
            embeds: [
               {
                  title: '📵 Borrower couldn’t confirm Facebook Messenger',
                  description:
                     `**${name}** (${profile?.username ?? 'no username'}) continued their loan request without Messenger. ` +
                     `The link never reached our bot (likely Facebook Lite or no Messenger app).\n\n` +
                     `**Please reach them another way:** add them on Facebook, or email ${profile?.email ?? 'n/a'}.`,
                  color: 0x0866ff,
                  timestamp: now.toISOString()
               }
            ]
         },
         { prefer: ['DISCORD_REQUESTS_WEBHOOK_URL'] }
      );
   }

   return json({ ok: true, pinged: shouldPing });
});
