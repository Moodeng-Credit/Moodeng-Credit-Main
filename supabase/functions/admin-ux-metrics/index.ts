import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

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
