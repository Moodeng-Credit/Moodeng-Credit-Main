// Didit Reusable KYC: mint a share token for a verified session so a partner app (Stableyard) can
// import it instead of running its own KYC. POST /v3/session/{id}/share/ with for_application_id.
// Only Approved / Declined / In Review sessions can be shared; tokens live 60s–24h (default 1h).

const DIDIT_API_BASE = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');

export type DiditShareResult =
   | { ok: true; shareToken: string; sessionKind: string | null; forApplicationId: string }
   | { ok: false; status: number; error: string };

export const shareDiditSession = async (sessionId: string, forApplicationId: string, ttlSeconds = 86_400): Promise<DiditShareResult> => {
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) return { ok: false, status: 0, error: 'DIDIT_API_KEY not configured' };
   try {
      const res = await fetch(`${DIDIT_API_BASE}/session/${encodeURIComponent(sessionId)}/share/`, {
         method: 'POST',
         headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
         body: JSON.stringify({ for_application_id: forApplicationId, ttl_in_seconds: ttlSeconds }),
         signal: AbortSignal.timeout(15_000)
      });
      const data = (await res.json().catch(() => ({}))) as { share_token?: string; session_kind?: string; detail?: string; error?: string };
      if (!res.ok || !data.share_token) {
         return { ok: false, status: res.status, error: String(data.detail ?? data.error ?? `Didit share failed (${res.status})`) };
      }
      return { ok: true, shareToken: data.share_token, sessionKind: data.session_kind ?? null, forApplicationId };
   } catch (err) {
      return { ok: false, status: 0, error: (err as Error).message };
   }
};
