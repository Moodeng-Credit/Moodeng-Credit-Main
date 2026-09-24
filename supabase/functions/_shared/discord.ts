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

// #logins is reserved for the login feed (record-session-ip posts there directly). A webhook is
// identified by its numeric id, so discord.com vs discordapp.com spellings compare equal.
const webhookId = (url: string | undefined | null): string | null =>
   url?.match(/\/webhooks\/(\d+)\//)?.[1] ?? null;

export type ResolvedDiscordWebhook = { key: string; url: string };

export const resolveDiscordWebhookWithKey = (...preferKeys: string[]): ResolvedDiscordWebhook | null => {
   const loginId = webhookId(Deno.env.get('DISCORD_LOGIN_WEBHOOK_URL'));
   for (const key of [...preferKeys, 'DISCORD_TEAM_WEBHOOK_URL']) {
      const val = Deno.env.get(key)?.trim();
      if (!val) continue;
      // Never let a team alert land in #logins, even if a secret was pasted with the wrong URL.
      if (loginId && webhookId(val) === loginId) continue;
      return { key, url: val };
   }
   return null;
};

export const resolveDiscordWebhook = (...preferKeys: string[]): string | null =>
   resolveDiscordWebhookWithKey(...preferKeys)?.url ?? null;

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
         // Alerts often quote user-typed text (a borrower's reason, a name). Never let that text
         // ping anyone — "@everyone" in a loan reason must stay inert.
         body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } })
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
