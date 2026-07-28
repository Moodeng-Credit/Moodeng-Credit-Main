// Shared caller check for the security cron functions.
//
// The problem it solves: `fraud-signal-scan` and `security-heartbeat` have no
// `[functions.*]` entry in config.toml, so they run with the platform's default
// verify_jwt — which accepts ANY valid JWT for the project, including the anon key that
// ships inside the client bundle. Anyone who opens devtools can therefore trigger a full
// fraud scan or a heartbeat, spamming the team's Telegram group and loading the database
// on demand. (Found the hard way on 2026-07-28: an anon-key probe fired a real scan and a
// real alert into the group.)
//
// The check is a shared-secret header, mirroring what `risk-score-recompute` already does
// with `X-Admin-Token`, so the three security functions end up consistent and one secret
// covers all of them.
//
// FAIL-OPEN BY DESIGN: when ADMIN_API_TOKEN is not configured, every caller is allowed
// through. That ordering matters — if this enforced unconditionally, deploying it before
// the secret exists would 401 the crons, and a silently-dead fraud scan AND a silently-
// dead heartbeat is precisely the outage the dead-man's switch was built to catch. Set
// the secret (function secret + vault, same value) and enforcement turns itself on.

export type CronAuthResult = { ok: true } | { ok: false; response: Response };

export const CRON_TOKEN_HEADER = 'X-Admin-Token';

/**
 * Returns `{ ok: true }` when the request may proceed. When a token is configured and the
 * caller did not present it, returns the 401 to send back.
 *
 * `expectedToken` is passed in rather than read from the environment so this stays pure
 * and testable; callers pass `Deno.env.get('ADMIN_API_TOKEN')`.
 */
export const checkCronAuth = (req: Request, expectedToken: string | undefined | null, corsHeaders: Record<string, string> = {}): CronAuthResult => {
   const expected = (expectedToken ?? '').trim();
   if (expected.length === 0) {
      // Not configured yet — preserve today's behaviour rather than break the crons.
      return { ok: true };
   }

   const presented = (req.headers.get(CRON_TOKEN_HEADER) ?? '').trim();
   if (presented === expected) {
      return { ok: true };
   }

   return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'unauthorized' }), {
         status: 401,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
   };
};
