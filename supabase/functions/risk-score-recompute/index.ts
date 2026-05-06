// Pure orchestrator. Calls compute_risk_score(uuid) and returns the result.
// No LLM, no external API calls.
//
// Modes:
//   POST { user_id }            single-user (action trigger / admin button)
//   POST { batch: true }        recompute every user (cron / admin button)
//   Optional body: { trigger: 'loan_request' | 'repayment' | 'manual' | 'daily_batch' | 'signup' }
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_TOKEN.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_TOKEN  = Deno.env.get('ADMIN_API_TOKEN')!;

const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function computeOne(userId: string, trigger: string) {
  const { data, error } = await supa.rpc('compute_risk_score', { p_user_id: userId });
  if (error) throw new Error(`compute_risk_score(${userId}): ${error.message}`);
  if (!data) throw new Error(`compute_risk_score(${userId}): no row returned`);

  if (trigger !== 'manual') {
    await supa.from('risk_scores').update({ trigger }).eq('id', data.id);
  }

  return {
    user_id:   userId,
    score:     data.score,
    band:      data.band,
    breakdown: data.signal_breakdown
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (req.headers.get('X-Admin-Token') !== ADMIN_TOKEN) {
    return new Response('unauthorized', { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const trigger: string = body.trigger ?? (body.batch ? 'daily_batch' : 'manual');

  try {
    if (body.batch === true) {
      const PAGE = 100;
      let offset = 0;
      const summary = {
        total: 0,
        by_band: { Low: 0, Medium: 0, High: 0, Critical: 0 } as Record<string, number>,
        errors: [] as Array<{ user_id: string; error: string }>
      };
      while (true) {
        const { data: users, error } = await supa
          .from('users')
          .select('id')
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        if (!users || users.length === 0) break;
        for (const u of users) {
          try {
            const r = await computeOne(u.id as string, trigger);
            summary.total += 1;
            summary.by_band[r.band] = (summary.by_band[r.band] ?? 0) + 1;
          } catch (e) {
            summary.errors.push({ user_id: u.id as string, error: (e as Error).message });
          }
        }
        if (users.length < PAGE) break;
        offset += PAGE;
      }
      return Response.json({ ok: true, batch: true, summary });
    }

    if (typeof body.user_id !== 'string') {
      return new Response('user_id required', { status: 400 });
    }
    const result = await computeOne(body.user_id, trigger);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
});
