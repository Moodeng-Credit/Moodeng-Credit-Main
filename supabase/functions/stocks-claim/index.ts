import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { postDiscord } from '../_shared/discord.ts';

// moodeng.app/stocks prize-wheel claim.
//
// The money-lesson page lets a visitor spin a wheel after each right quiz answer (pandesal points
// or a golden ticket). At the end they type their TikTok @handle and press "Claim". The page POSTs
// { handle, spins, points, tickets, lang } here and we drop it in the team's Discord so someone can
// follow up on TikTok. Public endpoint (no JWT) — the wheel runs in the browser, so the numbers are
// only sanity-checked against what the wheel can actually produce, never trusted for a payout.
//
// Routing: DISCORD_PRIZES_WEBHOOK_URL (own channel) — falls back to DISCORD_TEAM_WEBHOOK_URL.
// With neither set we answer 503 so the page never tells someone their claim was received when it
// was not.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MAX_SPINS = 4; // one per quiz on the page
const TICKETS_NEEDED = 2; // golden tickets that unlock the Grab draw
const MAX_BODY_BYTES = 2_000;

type Claim = { handle: string; spins: number; points: number; tickets: number; lang: 'fil' | 'en' };

// TikTok handles: letters, digits, "." and "_", up to 24 chars. A leading "@" is optional.
export const cleanHandle = (raw: unknown): string | null => {
   if (typeof raw !== 'string') return null;
   const h = raw.trim().replace(/^@/, '');
   return /^[A-Za-z0-9._]{2,24}$/.test(h) ? h : null;
};

// Can the wheel actually have produced this? tickets + point-spins = spins, and every point spin is
// worth 5/10/15/20 on the wheel, so points are a multiple of 5 and bounded by the best case.
export const parseClaim = (body: unknown): Claim | null => {
   if (!body || typeof body !== 'object') return null;
   const b = body as Record<string, unknown>;
   const handle = cleanHandle(b.handle);
   const { spins, points, tickets } = b as Record<'spins' | 'points' | 'tickets', unknown>;
   if (!handle) return null;
   if (typeof spins !== 'number' || typeof points !== 'number' || typeof tickets !== 'number') return null;
   if (![spins, points, tickets].every(Number.isInteger)) return null;
   if (spins < 1 || spins > MAX_SPINS || tickets < 0 || tickets > spins) return null;
   const pointSpins = spins - tickets;
   const [minPts, maxPts] = [pointSpins * 5, pointSpins * 20];
   if (points < minPts || points > maxPts || points % 5 !== 0) return null;
   if (pointSpins === 0 && points !== 0) return null;
   return { handle, spins, points, tickets, lang: b.lang === 'en' ? 'en' : 'fil' };
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

   const raw = await req.text();
   if (raw.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);

   let body: unknown;
   try {
      body = JSON.parse(raw);
   } catch {
      return json({ error: 'bad_json' }, 400);
   }
   const claim = parseClaim(body);
   if (!claim) return json({ error: 'invalid_claim' }, 400);

   const grab = claim.tickets >= TICKETS_NEEDED;
   const ok = await postDiscord(
      {
         embeds: [
            {
               title: grab ? '🎟️ Prize wheel: Grab draw claim' : '🥯 Prize wheel: pandesal points claim',
               color: grab ? 0x1aa45b : 0x8336f0,
               fields: [
                  { name: 'TikTok', value: `[@${claim.handle}](https://www.tiktok.com/@${claim.handle})`, inline: true },
                  { name: 'Pandesal points', value: String(claim.points), inline: true },
                  { name: 'Golden tickets', value: `${claim.tickets}/${TICKETS_NEEDED}${grab ? ' (Grab draw)' : ''}`, inline: true },
                  { name: 'Spins', value: `${claim.spins}/${MAX_SPINS}`, inline: true },
                  { name: 'Language', value: claim.lang === 'en' ? 'English' : 'Taglish', inline: true }
               ],
               timestamp: new Date().toISOString()
            }
         ]
      },
      { prefer: ['DISCORD_PRIZES_WEBHOOK_URL'] }
   );

   // Never confirm a claim nobody can see.
   if (!ok) return json({ error: 'not_delivered' }, 503);
   return json({ ok: true });
});
