// Best-effort Discord webhook posting for team / admin alerts (bookings, loan requests, KYC).
//
// Routing: resolveDiscordWebhook tries the caller's preferred env keys first (e.g.
// DISCORD_BOOKINGS_WEBHOOK_URL, DISCORD_KYC_WEBHOOK_URL) and then falls back to the shared
// DISCORD_TEAM_WEBHOOK_URL. That means a single secret — DISCORD_TEAM_WEBHOOK_URL — makes every
// team alert appear in one channel out of the box, while a per-feed secret can still peel any one
// of them off into its own channel later without a code change.
//
// Every send is fire-and-forget and never throws: a failed ping must not break the flow that
// triggered it (a booking, a loan request, a KYC outcome all persist first).

export const resolveDiscordWebhook = (...preferKeys: string[]): string | null => {
   for (const key of [...preferKeys, 'DISCORD_TEAM_WEBHOOK_URL']) {
      const val = Deno.env.get(key)?.trim();
      if (val) return val;
   }
   return null;
};

export type DiscordEmbed = {
   title?: string;
   description?: string;
   color?: number;
   fields?: Array<{ name: string; value: string; inline?: boolean }>;
   timestamp?: string;
};

export const postDiscord = async (
   payload: { content?: string; embeds?: DiscordEmbed[] },
   opts: { prefer?: string[] } = {}
): Promise<boolean> => {
   const url = resolveDiscordWebhook(...(opts.prefer ?? []));
   if (!url) return false;
   try {
      const res = await fetch(url, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
      });
      if (!res.ok) {
         console.error(`[discord] webhook responded ${res.status}`);
      }
      return res.ok;
   } catch (err) {
      console.error('[discord] webhook post failed:', err instanceof Error ? err.message : err);
      return false;
   }
};
