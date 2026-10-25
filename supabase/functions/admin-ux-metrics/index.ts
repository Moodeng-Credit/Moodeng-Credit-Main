import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   askDeepSeek,
   DIGEST_DAYS,
   fetchClarity,
   frictionLines,
   frictionRows,
   funnelLines,
   loadFunnel,
   trafficSessions
} from '../_shared/clarityDigest.ts';
import { postDiscord } from '../_shared/discord.ts';
import { isInternalRequest } from '../_shared/internalAuth.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// Serves the /admin "UX Health" tiles. Pulls a handful of AGGREGATE friction numbers
// from PostHog (sign-in conversion, onboarding drop-off, rage clicks, errors) over the
// last 30 days. We run the exact same Funnels/Trends queries that back the PostHog
// "UX Friction" dashboard, so the admin numbers match that dashboard 1:1.
//
// The PostHog *personal* API key (phx_…) lives only here, as a Supabase secret — it is
// never shipped to the browser. The project ingestion key (phc_…) can't query, so a
// personal key with read scope is required.
//   Secrets: POSTHOG_PERSONAL_API_KEY (required), POSTHOG_PROJECT_ID (default 492261),
//            POSTHOG_HOST (default https://us.posthog.com)
//
// Also serves the admin search bar's AI answer (it rides along here because the project is at its
// edge-function cap): { action: 'search', query, pages: [{ id, label, group, hint }] }
//   → { results: [{ id, why }] } — up to 3 of the given tab ids DeepSeek thinks answer the question.
//   Secret: DEEPSEEK_API_KEY.
//
// And the onboarding friction digest (see _shared/clarityDigest.ts), internal callers only:
// { action: 'clarity_digest', clarityToken, clarityProjectId, dryRun? } — pg_cron clarity-digest posts it
// every 3 days at 08:00 Bangkok (01:00 UTC) to the KYC / admin Telegram group + Discord #kyc, passing the token and project id from
// the DB vault (CLARITY_API_TOKEN, CLARITY_PROJECT_ID). dryRun returns the text and the raw Clarity rows.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const POSTHOG_HOST = (Deno.env.get('POSTHOG_HOST') ?? 'https://us.posthog.com').replace(/\/$/, '');
const POSTHOG_PROJECT_ID = Deno.env.get('POSTHOG_PROJECT_ID') ?? '492261';

// --- Query definitions (mirror the saved PostHog dashboard insights) -------------------
const signinFunnel = {
   kind: 'FunnelsQuery',
   series: [
      {
         kind: 'EventsNode',
         event: '$pageview',
         name: 'Landed on Sign-in',
         properties: [{ key: '$pathname', type: 'event', value: ['/sign-in'], operator: 'exact' }]
      },
      {
         kind: 'EventsNode',
         event: '$pageview',
         name: 'Reached dashboard',
         properties: [{ key: '$pathname', type: 'event', value: 'dashboard', operator: 'icontains' }]
      }
   ],
   dateRange: { date_from: '-30d' },
   funnelsFilter: { funnelOrderType: 'ordered', funnelVizType: 'steps' }
};

// Same sign-in funnel, scoped to one device type on the first step. The 82% drop-off
// is almost entirely mobile, so splitting it out makes the real problem visible.
const signinFunnelForDevice = (device: 'Mobile' | 'Desktop') => ({
   kind: 'FunnelsQuery',
   series: [
      {
         kind: 'EventsNode',
         event: '$pageview',
         name: 'Landed on Sign-in',
         properties: [
            { key: '$pathname', type: 'event', value: ['/sign-in'], operator: 'exact' },
            { key: '$device_type', type: 'event', value: [device], operator: 'exact' }
         ]
      },
      {
         kind: 'EventsNode',
         event: '$pageview',
         name: 'Reached dashboard',
         properties: [{ key: '$pathname', type: 'event', value: 'dashboard', operator: 'icontains' }]
      }
   ],
   dateRange: { date_from: '-30d' },
   funnelsFilter: { funnelOrderType: 'ordered', funnelVizType: 'steps' }
});

const onboardingFunnel = {
   kind: 'FunnelsQuery',
   series: [
      { kind: 'EventsNode', event: '$pageview', name: 'Onboarding welcome', properties: [{ key: '$pathname', type: 'event', value: ['/onboarding/welcome'], operator: 'exact' }] },
      { kind: 'EventsNode', event: '$pageview', name: 'Wallet step', properties: [{ key: '$pathname', type: 'event', value: ['/onboarding/wallet'], operator: 'exact' }] },
      { kind: 'EventsNode', event: '$pageview', name: 'Wallet connected', properties: [{ key: '$pathname', type: 'event', value: ['/onboarding/wallet/connected'], operator: 'exact' }] },
      { kind: 'EventsNode', event: '$pageview', name: 'Verify ID', properties: [{ key: '$pathname', type: 'event', value: ['/verify'], operator: 'exact' }] }
   ],
   dateRange: { date_from: '-30d' },
   funnelsFilter: { funnelOrderType: 'ordered', funnelVizType: 'steps' }
};

const rageTrend = {
   kind: 'TrendsQuery',
   series: [{ kind: 'EventsNode', event: '$rageclick', name: 'Rage clicks', math: 'total' }],
   dateRange: { date_from: '-30d' },
   interval: 'day'
};

const deadClickTrend = {
   kind: 'TrendsQuery',
   series: [{ kind: 'EventsNode', event: '$dead_click', name: 'Dead clicks', math: 'total' }],
   dateRange: { date_from: '-30d' },
   interval: 'day'
};

const errorTrend = {
   kind: 'TrendsQuery',
   series: [
      { kind: 'EventsNode', event: '$exception', name: 'Errors', math: 'total' },
      { kind: 'EventsNode', event: '$exception', name: 'Sessions with errors', math: 'unique_session' }
   ],
   dateRange: { date_from: '-30d' },
   interval: 'day'
};

async function runQuery(apiKey: string, query: unknown): Promise<any> {
   const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
   });
   if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`PostHog query failed (${res.status}): ${detail.slice(0, 300)}`);
   }
   return res.json();
}

// Funnel results come back as an ordered array of steps, each with a `count`.
function funnelSteps(result: any): Array<{ name: string; count: number }> {
   const rows = Array.isArray(result?.results) ? result.results : [];
   return rows.map((r: any) => ({ name: String(r?.name ?? r?.custom_name ?? ''), count: Number(r?.count ?? 0) }));
}

// Trends results: one entry per series, each with an aggregated `count`.
function trendTotal(result: any, seriesIndex = 0): number {
   const rows = Array.isArray(result?.results) ? result.results : [];
   const row = rows[seriesIndex];
   if (!row) return 0;
   if (typeof row.count === 'number') return row.count;
   if (typeof row.aggregated_value === 'number') return row.aggregated_value;
   const data = Array.isArray(row.data) ? row.data : [];
   return data.reduce((sum: number, n: number) => sum + Number(n || 0), 0);
}

// --- Admin search: DeepSeek picks the tabs that answer a plain-words question -------------
const SEARCH_MODEL = 'deepseek-v4-flash';
const SEARCH_PROMPT = `You help a lending company's admin find the right page in their admin panel.
You get the admin's question and a list of pages (id, name, area, what it is for).
Pick up to 3 pages that best answer the question, best first. Only use ids from the list.
For each, write "why": one short plain sentence (max 12 words) saying what they can do there for this question.
If no page fits, return an empty list.
Reply as JSON: {"results":[{"id":"...","why":"..."}]}`;

type SearchPage = { id: string; label: string; group: string; hint: string };

const clipText = (value: unknown, max: number) => String(value ?? '').slice(0, max);

async function aiSearch(body: any): Promise<Response> {
   const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
   if (!apiKey) return json({ error: 'DEEPSEEK_API_KEY secret is not set on this project.' }, 503);

   const query = clipText(body?.query, 200).trim();
   const pages: SearchPage[] = (Array.isArray(body?.pages) ? body.pages : []).slice(0, 80).map((p: any) => ({
      id: clipText(p?.id, 40),
      label: clipText(p?.label, 60),
      group: clipText(p?.group, 30),
      hint: clipText(p?.hint, 200)
   }));
   if (!query || pages.length === 0) return json({ results: [] });

   const ctrl = new AbortController();
   const timer = setTimeout(() => ctrl.abort(), 15_000);
   let res: Response;
   try {
      res = await fetch('https://api.deepseek.com/chat/completions', {
         method: 'POST',
         signal: ctrl.signal,
         headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
            model: SEARCH_MODEL,
            thinking: { type: 'disabled' },
            temperature: 0,
            max_tokens: 300,
            response_format: { type: 'json_object' },
            messages: [
               { role: 'system', content: SEARCH_PROMPT },
               {
                  role: 'user',
                  content: `PAGES:\n${pages.map((p) => `${p.id} | ${p.label} | ${p.group} | ${p.hint}`).join('\n')}\n\nQUESTION: ${query}`
               }
            ]
         })
      });
   } catch (err) {
      return json({ error: err instanceof Error && err.name === 'AbortError' ? 'DeepSeek took too long.' : 'DeepSeek is unreachable.' }, 502);
   } finally {
      clearTimeout(timer);
   }
   if (!res.ok) return json({ error: `DeepSeek ${res.status}` }, 502);

   let parsed: any = {};
   try {
      const reply = await res.json();
      parsed = JSON.parse(reply?.choices?.[0]?.message?.content ?? '{}');
   } catch {
      return json({ error: 'DeepSeek sent an unreadable answer.' }, 502);
   }
   const known = new Set(pages.map((p) => p.id));
   const seen = new Set<string>();
   const results = (Array.isArray(parsed?.results) ? parsed.results : [])
      .map((r: any) => ({ id: String(r?.id ?? ''), why: clipText(r?.why, 140).trim() }))
      .filter((r: { id: string }) => known.has(r.id) && !seen.has(r.id) && seen.add(r.id))
      .slice(0, 3);
   return json({ results });
}

const DAY_MS = 86_400_000;
const bangkokDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric' });

async function clarityDigest(supabase: any, body: any): Promise<Response> {
   const token = String(body?.clarityToken ?? '').trim();
   const projectId = String(body?.clarityProjectId ?? '').trim();
   const now = Date.now();
   const lines = [`🔎 Onboarding friction · ${bangkokDay(now - DIGEST_DAYS * DAY_MS)} – ${bangkokDay(now)} (last ${DIGEST_DAYS} days)`];
   const problems: string[] = [];

   const funnel = await loadFunnel(supabase, now).catch((err) => {
      problems.push(`Sign-up steps: ${err instanceof Error ? err.message : err}`);
      return null;
   });
   if (funnel) lines.push('', ...funnelLines(funnel.signups, funnel.steps));

   let raw: unknown = null;
   if (!token) {
      problems.push('Clarity: CLARITY_API_TOKEN is not in the vault yet');
   } else {
      try {
         // 2 of Clarity's 10 calls a day: per page, and per device + browser (the Facebook app's browser shows here).
         const [byPage, byDevice] = await Promise.all([fetchClarity(token, ['URL']), fetchClarity(token, ['Device', 'Browser'])]);
         raw = { byPage, byDevice };
         const sessions = trafficSessions(byPage);
         const pageRows = frictionRows(byPage, ['URL']);
         const deviceRows = frictionRows(byDevice, ['Device', 'Browser']);
         lines.push('', `Clarity${sessions !== null ? ` · ${sessions.toLocaleString('en-US')} sessions` : ''}`);
         lines.push(...(pageRows.length ? frictionLines(pageRows) : ['• No rage/dead clicks, quick-backs or errors recorded']));
         if (deviceRows.length) lines.push('By device / browser:', ...frictionLines(deviceRows, 2));
      } catch (err) {
         problems.push(`Clarity: ${err instanceof Error ? err.message : err}`);
      }
   }

   const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
   if (apiKey && funnel) {
      const findings = await askDeepSeek(apiKey, lines.join('\n')).catch((err) => {
         problems.push(`AI summary: ${err instanceof Error ? err.message : err}`);
         return [] as string[];
      });
      if (findings.length)
         lines.push('', '🤖 Where people get stuck (AI, check before acting)', ...findings.map((f, i) => `${i + 1}. ${f}`));
   }

   const clarityBase = projectId ? `https://clarity.microsoft.com/projects/view/${projectId}` : 'https://clarity.microsoft.com/projects';
   lines.push(
      '',
      `🎥 Recordings: ${projectId ? `${clarityBase}/impressions` : clarityBase}`,
      'Filter by Smart event (e.g. tapped_connect_messenger without messenger_connected) or Custom tag (browser, signup_method).'
   );
   if (problems.length) lines.push('', `⚠️ ${problems.join(' · ')}`);
   const text = lines.join('\n');

   if (body?.dryRun) return json({ text, raw });

   // The KYC / admin group, with the other onboarding alerts: George keeps routine posts out of the team / fraud group.
   const { data: chats } = await supabase.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle();
   const chatId = chats?.value ?? Deno.env.get('TEAM_TELEGRAM_CHAT_ID');
   const telegramOk = chatId
      ? await sendTelegramMessage(chatId, text)
           .then(() => true)
           .catch((err) => (console.error('clarity digest: Telegram failed', err instanceof Error ? err.message : err), false))
      : false;
   // Discord #kyc: with no preferred key postDiscord falls back to DISCORD_TEAM_WEBHOOK_URL, which no longer exists.
   const discordOk = await postDiscord(
      {
         embeds: [
            { title: '🔎 Onboarding friction', description: text.slice(0, 4000), color: 0x7c3aed, timestamp: new Date(now).toISOString() }
         ]
      },
      { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
   );
   return json({ posted: { telegram: telegramOk, discord: discordOk }, problems });
}

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const body = await req.json().catch(() => ({}));

   if (body?.action === 'clarity_digest') {
      if (!(await isInternalRequest(supabase, req))) return json({ error: 'Unauthorized' }, 401);
      return clarityDigest(supabase, body);
   }

   // --- Verify the caller is an active Moodeng admin (mirrors admin-loan-notify) ---
   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);

   const { data: userData, error: userError } = await supabase.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);

   const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);

   if (body?.action === 'search') return aiSearch(body);

   const apiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
   if (!apiKey) {
      // Not a hard error — let the UI show a friendly "one-time setup" note.
      return json({ configured: false, reason: 'POSTHOG_PERSONAL_API_KEY secret is not set on this project.' });
   }

   try {
      const [signin, signinMobile, signinDesktop, onboarding, rage, dead, errors] = await Promise.all([
         runQuery(apiKey, signinFunnel),
         runQuery(apiKey, signinFunnelForDevice('Mobile')),
         runQuery(apiKey, signinFunnelForDevice('Desktop')),
         runQuery(apiKey, onboardingFunnel),
         runQuery(apiKey, rageTrend),
         runQuery(apiKey, deadClickTrend),
         runQuery(apiKey, errorTrend)
      ]);

      // Collapse a 2-step sign-in funnel to {landed, reached} for the device split.
      const deviceSplit = (result: any) => {
         const steps = funnelSteps(result);
         return { landed: steps[0]?.count ?? 0, reached: steps[steps.length - 1]?.count ?? 0 };
      };

      return json({
         configured: true,
         windowDays: 30,
         generatedAt: new Date().toISOString(),
         dashboardUrl: `${POSTHOG_HOST}/project/${POSTHOG_PROJECT_ID}/dashboard/1900315`,
         signin: {
            steps: funnelSteps(signin),
            byDevice: { mobile: deviceSplit(signinMobile), desktop: deviceSplit(signinDesktop) }
         },
         onboarding: { steps: funnelSteps(onboarding) },
         rageClicks: trendTotal(rage),
         deadClicks: trendTotal(dead),
         errors: { total: trendTotal(errors, 0), sessions: trendTotal(errors, 1) }
      });
   } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Failed to load PostHog metrics.' }, 502);
   }
});
