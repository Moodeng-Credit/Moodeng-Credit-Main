// Onboarding friction digest, posted every 3 days to the KYC / admin Telegram group (and Discord #kyc): how far the
// last 3 days' sign-ups got through onboarding (our own timestamps, same steps as onboarding_timeline),
// where Clarity saw friction (rage / dead clicks, quick-backs, JS errors per page and device), and
// DeepSeek's read of where people get stuck.
//
// Clarity's Data Export API only returns dashboard aggregates for the last 1-3 days, 10 calls per
// project per day, broken down by Browser / Device / OS / URL… — not by our custom tags or events, and
// no recordings or Copilot summaries. So the per-step picture comes from the database, and the digest
// links to Clarity recordings for the detail. Each run uses 2 Clarity calls.

// deno-lint-ignore-file no-explicit-any

export const DIGEST_DAYS = 3;
const CLARITY_API = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';

// Clarity metric name → how the digest names it. Only friction signals; traffic is read separately.
const FRICTION_METRICS: Record<string, string> = {
   RageClickCount: 'Rage clicks',
   DeadClickCount: 'Dead clicks',
   QuickbackClick: 'Quick-backs',
   ScriptErrorCount: 'JS errors',
   ErrorClickCount: 'Error clicks',
   ExcessiveScroll: 'Excessive scrolling'
};

export type ClarityMetric = { metricName: string; information: Record<string, unknown>[] };
// sessions = visits that had the problem; total = all visits to that place; pct = sessions / total.
export type FrictionRow = { metric: string; where: string; sessions: number; total: number; pct: number | null };
export type StepCount = { step: string; count: number };

const num = (value: unknown): number | null => {
   const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
   return Number.isFinite(n) ? n : null;
};

const normalize = (key: string) => key.replace(/[^a-z]/gi, '').toLowerCase();

/** Reads a field whatever its casing ("sessionsCount", "SessionsCount", "sessions_count"). */
const field = (row: Record<string, unknown>, ...names: string[]) => {
   const wanted = new Set(names.map(normalize));
   for (const [key, value] of Object.entries(row)) if (wanted.has(normalize(key))) return value;
   return undefined;
};

/**
 * A page path without query string, fragment or ids, so URLs carrying a phone number, code or user id
 * never reach DeepSeek or the team chat, and the same screen is counted once.
 */
export const cleanPath = (url: string): string => {
   let path = url.trim();
   try {
      path = new URL(path, 'https://moodeng.app').pathname;
   } catch {
      path = path.split(/[?#]/)[0];
   }
   return (
      path
         .split('/')
         .map((part) => (/^[0-9a-f-]{16,}$/i.test(part) || /\d{5,}/.test(part) ? ':id' : part))
         .join('/')
         .replace(/\/+$/, '') || '/'
   );
};

/**
 * Friction rows from one Clarity response, merged per place (page path, or device/browser), most affected
 * visits first. Clarity's sessionsCount is ALL visits to that place; the share that hit the problem is
 * sessionsWithMetricPercentage, so a busy page with no problems is left out instead of topping every list.
 */
export const frictionRows = (metrics: ClarityMetric[], dimensions: string[]): FrictionRow[] => {
   const merged = new Map<string, FrictionRow>();
   for (const metric of Array.isArray(metrics) ? metrics : []) {
      const label = FRICTION_METRICS[metric?.metricName];
      if (!label) continue;
      for (const row of Array.isArray(metric.information) ? metric.information : []) {
         const total = num(field(row, 'sessionsCount', 'sessionCount')) ?? 0;
         const share = num(field(row, 'sessionsWithMetricPercentage'));
         // No share given: count the place only if Clarity recorded the problem there at all.
         const sessions = share !== null ? Math.round((total * share) / 100) : (num(field(row, 'subTotal')) ?? 0) > 0 ? total : 0;
         if (total <= 0 && sessions <= 0) continue;
         const where = dimensions
            .map((d) => {
               const value = String(field(row, d) ?? '').trim();
               return d === 'URL' && value ? cleanPath(value) : value;
            })
            .filter(Boolean)
            .join(' · ');
         if (!where) continue;
         const key = `${label}|${where}`;
         const prev = merged.get(key);
         const next = { metric: label, where, sessions: (prev?.sessions ?? 0) + sessions, total: (prev?.total ?? 0) + total };
         merged.set(key, { ...next, pct: next.total > 0 ? (next.sessions / next.total) * 100 : null });
      }
   }
   // Clean visits count toward a page's total (all its URL variants), but only places with the problem are listed.
   return [...merged.values()].filter((r) => r.sessions > 0).sort((a, b) => b.sessions - a.sessions);
};

/** Total real (non-bot) sessions from the Traffic metric. */
export const trafficSessions = (metrics: ClarityMetric[]): number | null => {
   const traffic = (Array.isArray(metrics) ? metrics : []).find((m) => m?.metricName === 'Traffic');
   if (!traffic) return null;
   return traffic.information.reduce((sum, row) => {
      const total = num(field(row, 'totalSessionCount')) ?? 0;
      const bots = num(field(row, 'totalBotSessionCount')) ?? 0;
      return sum + Math.max(0, total - bots);
   }, 0);
};

export const fetchClarity = async (token: string, dimensions: string[]): Promise<ClarityMetric[]> => {
   const params = new URLSearchParams({ numOfDays: String(DIGEST_DAYS) });
   dimensions.forEach((d, i) => params.set(`dimension${i + 1}`, d));
   const res = await fetch(`${CLARITY_API}?${params}`, {
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
   });
   if (!res.ok) throw new Error(`Clarity ${res.status}${res.status === 429 ? ' (daily limit of 10 calls used)' : ''}`);
   return res.json();
};

const fmt = (n: number) => n.toLocaleString('en-US');
const pctOf = (part: number, whole: number) => (whole > 0 ? ` (${Math.round((part / whole) * 100)}%)` : '');

/** The top friction lines: up to `perMetric` places for each signal, signals with the most sessions first. */
export const frictionLines = (rows: FrictionRow[], perMetric = 3): string[] => {
   const byMetric = new Map<string, FrictionRow[]>();
   for (const row of rows) byMetric.set(row.metric, [...(byMetric.get(row.metric) ?? []), row]);
   return [...byMetric.entries()]
      .sort((a, b) => b[1][0].sessions - a[1][0].sessions)
      .map(
         ([metric, list]) =>
            `• ${metric}: ${list
               .slice(0, perMetric)
               .map((r) => `${r.where} ${fmt(r.sessions)} of ${fmt(r.total)} visits${r.pct !== null ? ` (${Math.round(r.pct)}%)` : ''}`)
               .join(', ')}`
      );
};

export const funnelLines = (signups: number, steps: StepCount[]): string[] => [
   `New sign-ups: ${fmt(signups)}`,
   ...steps.map((s) => `• ${s.step}: ${fmt(s.count)}${pctOf(s.count, signups)}`)
];

export const DIGEST_PROMPT = `You review onboarding friction for Moodeng Credit (moodeng.app), a tiny microloan app for Filipino and
Indonesian gig workers. New borrowers sign up, connect Facebook Messenger (or WhatsApp) by tapping a button and sending a
code in the chat, turn on push reminders, connect a wallet, ask to borrow / book a short intro call, then do an ID check (Didit).
Most use cheap Android phones, often inside the Facebook or Messenger app's own browser.
You get the last 3 days: how many new sign-ups reached each step, and Clarity's friction signals per page and per device/browser
(sessions with rage clicks, dead clicks, quick-backs, JS errors; % = share of that page's sessions).
Name the 3 places people most likely get stuck, biggest first. Each finding is 2 short sentences in plain English (8th-grade level):
first the evidence with its numbers, then one concrete fix or check for the team to try. Connect step drop-offs to the pages
where Clarity saw friction when the numbers support it; say "(guess)" when they don't. If there are fewer than 5 sign-ups, say the
numbers are too small to be sure. No markdown, no headings.
Return JSON: {"findings": ["...", "...", "..."]}`;

export const askDeepSeek = async (apiKey: string, data: string): Promise<string[]> => {
   const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
         model: 'deepseek-v4-pro',
         thinking: { type: 'disabled' },
         temperature: 0.3,
         max_tokens: 900,
         response_format: { type: 'json_object' },
         messages: [
            { role: 'system', content: DIGEST_PROMPT },
            { role: 'user', content: data }
         ]
      })
   });
   if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
   const body = await res.json();
   const findings = JSON.parse(body.choices?.[0]?.message?.content ?? '{}').findings;
   return Array.isArray(findings) ? findings.filter((f: unknown) => typeof f === 'string' && f.trim()).slice(0, 3) : [];
};

const DAY_MS = 86_400_000;

/** How far the last 3 days' (non-test) sign-ups got. Same steps and sources as public.onboarding_timeline. */
export const loadFunnel = async (supabase: any, now = Date.now()): Promise<{ signups: number; steps: StepCount[] }> => {
   const since = new Date(now - DIGEST_DAYS * DAY_MS).toISOString();
   const { data: users, error } = await supabase
      .from('users')
      .select(
         'id, messenger_verified_at, whatsapp_verified_at, contact_step_skipped_at, wallet_connected_at, video_call_scheduled_at, loan_access_approved_at, didit_submitted_at'
      )
      .gte('created_at', since)
      .eq('is_test', false)
      .limit(2000);
   if (error) throw new Error(`users: ${error.message}`);
   const cohort = (users ?? []) as Record<string, string | null>[];
   const ids = cohort.map((u) => u.id as string);
   const distinct = async (table: string, filter?: [string, string]) => {
      if (!ids.length) return 0;
      let query = supabase.from(table).select('user_id').in('user_id', ids);
      if (filter) query = query.eq(filter[0], filter[1]);
      const { data } = await query;
      return new Set((data ?? []).map((r: any) => r.user_id)).size;
   };
   const has = (col: string) => cohort.filter((u) => u[col]).length;
   const [tappedMessenger, tappedWhatsapp, push, asked] = await Promise.all([
      distinct('contact_verification_codes', ['channel', 'messenger']),
      distinct('contact_verification_codes', ['channel', 'whatsapp']),
      distinct('push_subscriptions'),
      distinct('loan_access_requests')
   ]);
   return {
      signups: cohort.length,
      steps: [
         { step: 'Tapped Connect Messenger', count: tappedMessenger },
         { step: 'Messenger connected', count: has('messenger_verified_at') },
         { step: 'Tapped Connect WhatsApp', count: tappedWhatsapp },
         { step: 'WhatsApp connected', count: has('whatsapp_verified_at') },
         { step: 'Skipped contact step', count: has('contact_step_skipped_at') },
         { step: 'Turned on push', count: push },
         { step: 'Wallet connected', count: has('wallet_connected_at') },
         { step: 'Asked to connect / booked call', count: asked },
         { step: 'Call booked', count: has('video_call_scheduled_at') },
         { step: 'Approved to borrow', count: has('loan_access_approved_at') },
         { step: 'ID check submitted', count: has('didit_submitted_at') }
      ]
   };
};
