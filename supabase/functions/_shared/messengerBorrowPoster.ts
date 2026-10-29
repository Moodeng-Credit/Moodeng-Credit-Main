import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { type MessengerCard, sendMessengerMessage } from './sendpulse.ts';

// The "6 things you need to know before borrow" poster (George, 2026-10-15). Sent once per borrower,
// on its own, a few minutes after their MDNG code connects Facebook (messenger-stuck-alerts runs this
// every 5 min). It used to answer the first message they wrote after connecting, which meant a real
// question ("730 pm right?") got a poster back instead of an answer (George, 2026-10-29).
// Connecting means they just messaged the Page, so we're inside Meta's 24h window.
// Stamped in users.borrow_poster_sent_at.
export const BORROW_POSTER_URL = `${(Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '')}/messenger/borrow-6-things.jpg`;

/** Wait this long after connecting, so it lands after the "connected" reply, not on top of it. */
export const POSTER_DELAY_MS = 2 * 60 * 1000;
/** Past this, Meta's 24h window may have closed: skip rather than fail. */
export const POSTER_WINDOW_MS = 23 * 60 * 60 * 1000;

export const BORROW_POSTER_CARD: MessengerCard = {
   title: '6 things to know before you borrow',
   subtitle: 'Borrow small. Build trust. Unlock your future.',
   imageUrl: BORROW_POSTER_URL,
   button: { title: 'Open Moodeng', url: 'https://moodeng.app' }
};

export type PosterCandidate = {
   messenger_verified_at: string | null;
   borrow_poster_sent_at: string | null;
   user_role: string | null;
};

/** True when this borrower is due the poster now. `hasBorrowed` = a funded loan exists. */
export const posterDue = (user: PosterCandidate | null, now: number, hasBorrowed: boolean): boolean => {
   if (!user || user.borrow_poster_sent_at || user.user_role === 'lender' || hasBorrowed) return false;
   const connectedAt = user.messenger_verified_at ? Date.parse(user.messenger_verified_at) : Number.NaN;
   if (Number.isNaN(connectedAt)) return false;
   const since = now - connectedAt;
   return since >= POSTER_DELAY_MS && since <= POSTER_WINDOW_MS;
};

type DueRow = PosterCandidate & { id: string; messenger_psid: string | null };

/** Sends the poster to everyone due it. Returns how many went out. Never throws. */
export const sendDuePosters = async (svc: SupabaseClient, now = Date.now()): Promise<number> => {
   const { data, error } = await svc
      .from('users')
      .select('id, messenger_psid, messenger_verified_at, borrow_poster_sent_at, user_role')
      .eq('is_test', false)
      .is('borrow_poster_sent_at', null)
      .not('messenger_psid', 'is', null)
      .gte('messenger_verified_at', new Date(now - POSTER_WINDOW_MS).toISOString())
      .lte('messenger_verified_at', new Date(now - POSTER_DELAY_MS).toISOString())
      .limit(50);
   if (error) {
      console.error('borrow poster: lookup failed', error.message);
      return 0;
   }
   const rows = (data ?? []) as DueRow[];
   if (!rows.length) return 0;
   const { data: funded } = await svc
      .from('loans')
      .select('borrower_user_id')
      .eq('is_test', false)
      .not('funded_at', 'is', null)
      .in(
         'borrower_user_id',
         rows.map((r) => r.id)
      );
   const borrowed = new Set(((funded ?? []) as Array<{ borrower_user_id: string }>).map((l) => l.borrower_user_id));

   let sent = 0;
   for (const row of rows) {
      if (!row.messenger_psid || !posterDue(row, now, borrowed.has(row.id))) continue;
      // Claim it first, so two overlapping runs can't both send it. Not unclaimed on failure: a
      // closed 24h window would fail every 5 minutes, and once is enough.
      const { data: claimed } = await svc
         .from('users')
         .update({ borrow_poster_sent_at: new Date(now).toISOString() })
         .eq('id', row.id)
         .is('borrow_poster_sent_at', null)
         .select('id')
         .maybeSingle();
      if (!claimed) continue;
      const result = await sendMessengerMessage(row.messenger_psid, { card: BORROW_POSTER_CARD });
      console.log(`borrow poster for ${row.id.slice(0, 8)} → ${result.ok ? 'sent' : `not sent (${result.reason})`}`);
      if (result.ok) sent += 1;
   }
   return sent;
};
