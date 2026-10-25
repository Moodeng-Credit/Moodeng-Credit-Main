// Onboarding friction digest, posted every 3 days to the KYC / admin Telegram group (and Discord #kyc):
//   - how far new borrowers got and how long each step took (public.onboarding_digest_people: our own
//     timestamps, same steps as onboarding_timeline, no names or contact details),
//   - who stopped partway, and where,
//   - where Clarity saw friction (rage / dead clicks, quick-backs, JS errors per page, and devices that
//     do clearly worse), with the team's own pages left out,
//   - what changed since the last digest (public.clarity_digest_runs),
//   - DeepSeek's read of where people get stuck, from each person's path rather than totals.
//
// Clarity's Data Export API only returns dashboard aggregates for the last 1-3 days, 10 calls per
// project per day, broken down by Browser / Device / OS / URL… — not by our custom tags or events, and
// no recordings or Copilot summaries. So the per-step picture comes from the database, and the digest
// links to Clarity recordings for the detail. Each run uses 2 Clarity calls (dry runs can reuse the last export).

// deno-lint-ignore-file no-explicit-any

/** Clarity's export only goes back 3 days. */
export const CLARITY_DAYS = 3;
/** Sign-up window: 3 days, widened until there are enough people to say anything. */
export const WINDOWS = [3, 7, 14];
export const MIN_PEOPLE = 5;
/** Below this, the AI section is skipped: the "who stopped" list says more than any guess. */
export const MIN_PEOPLE_FOR_AI = 3;
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

/** Pages mostly visited by the team (admin, testers, Emma's demo), left out of the Clarity numbers. */
const TEAM_PAGE = /^\/(admin|testqr|test|team|dashboard-v2-preview|borrower-demo|design|repay-design-brief|ut)(\/|$)/;
export const isTeamPage = (path: string) => TEAM_PAGE.test(path);

/**
 * What a page is for, so the AI only ties a borrower's stop to a page that's part of that step (2026-10-26
 * it blamed a borrower's wallet on /creditline, which is a lender page). Paths are cleaned (no query).
 */
export const pageArea = (path: string): string => {
   if (/^\/(creditline|lend|lender|whylend)(\/|$)/.test(path)) return 'lender page';
   if (/^\/(sign-up|sign-in|auth|auth-success|continue)(\/|$)/.test(path)) return 'sign-up / sign-in';
   if (/^\/onboarding\/(role|welcome)(\/|$)/.test(path)) return 'onboarding start';
   if (/^\/onboarding\/wallet(\/|$)/.test(path)) return 'onboarding: connect wallet';
   if (/^\/onboarding\/connect(\/|$)/.test(path)) return 'onboarding: connect Messenger/WhatsApp, bio, ask to borrow / book call';
   if (/^\/request-board(\/|$)/.test(path)) return 'loan requests board (borrowers and lenders)';
   if (/^\/(dashboard|repay|withdraw|history|account|onboarding\/congratulations)(\/|$)/.test(path)) return 'borrower app after onboarding';
   return 'info page';
};
export const isLenderPage = (path: string) => pageArea(path) === 'lender page';

export type ClarityMetric = { metricName: string; information: Record<string, unknown>[] };
// sessions = visits that had the problem; total = all visits to that place; pct = sessions / total.
export type FrictionRow = { metric: string; where: string; sessions: number; total: number; pct: number | null };
export type Person = {
   /** For the team's "stopped partway" list only — never part of what DeepSeek sees. */
   username?: string | null;
   method: string | null;
   browser: string | null;
   os: string | null;
   locale: string | null;
   steps: { step: string; at: string }[];
   /** Their latest ask-to-borrow / call request (loan_access_requests). */
   request?: { kind: string | null; status: string; decided_by: string | null; decided_at: string | null; created_at: string } | null;
};
/** The last posted digest's numbers, for "what changed". */
export type PrevRun = { step_pct: Record<string, number>; friction_pct: Record<string, number>; created_at: string } | null;

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
 * Team pages (admin, testers, the demo) are dropped.
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
         const parts = dimensions.map((d) => {
            const value = String(field(row, d) ?? '').trim();
            return d === 'URL' && value ? cleanPath(value) : value;
         });
         if (dimensions[0] === 'URL' && parts[0] && isTeamPage(parts[0])) continue;
         const where = parts.filter(Boolean).join(' · ');
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

const IN_APP_BROWSER = /facebook|messenger|instagram|tiktok|line|webview/i;

/**
 * Device / browser rows worth a line: an in-app browser (most borrowers sign up inside Facebook), or one
 * doing clearly worse than the rest — at least 3 affected visits and 1.5× the overall rate for that problem.
 */
export const notableDeviceRows = (rows: FrictionRow[]): FrictionRow[] => {
   const overall = new Map<string, { s: number; t: number }>();
   for (const r of rows) {
      const o = overall.get(r.metric) ?? { s: 0, t: 0 };
      overall.set(r.metric, { s: o.s + r.sessions, t: o.t + r.total });
   }
   return rows.filter((r) => {
      if (r.total < MIN_VISITS) return false;
      if (IN_APP_BROWSER.test(r.where)) return true;
      const o = overall.get(r.metric)!;
      const rate = o.t > 0 ? o.s / o.t : 0;
      return r.sessions >= 3 && r.total > 0 && r.sessions / r.total >= rate * 1.5;
   });
};

/** Real (non-bot) sessions from the Traffic metric, team pages left out. */
export const trafficSessions = (metrics: ClarityMetric[]): number | null => {
   const traffic = (Array.isArray(metrics) ? metrics : []).find((m) => m?.metricName === 'Traffic');
   if (!traffic) return null;
   return traffic.information.reduce((sum, row) => {
      const url = String(field(row, 'URL') ?? '');
      if (url && isTeamPage(cleanPath(url))) return sum;
      const total = num(field(row, 'totalSessionCount')) ?? 0;
      const bots = num(field(row, 'totalBotSessionCount')) ?? 0;
      return sum + Math.max(0, total - bots);
   }, 0);
};

export const fetchClarity = async (token: string, dimensions: string[]): Promise<ClarityMetric[]> => {
   const params = new URLSearchParams({ numOfDays: String(CLARITY_DAYS) });
   dimensions.forEach((d, i) => params.set(`dimension${i + 1}`, d));
   const res = await fetch(`${CLARITY_API}?${params}`, {
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
   });
   if (!res.ok) throw new Error(`Clarity ${res.status}${res.status === 429 ? ' (daily limit of 10 calls used)' : ''}`);
   return res.json();
};

const fmt = (n: number) => n.toLocaleString('en-US');

/** " ↑ from 33%" / " ↓ from 60%" when a share moved by 10+ points since the last digest. */
export const change = (now: number, before: number | undefined): string => {
   if (before === undefined || Math.abs(now - before) < 10) return '';
   return ` ${now > before ? '↑' : '↓'} from ${Math.round(before)}%`;
};

export const frictionKey = (r: FrictionRow) => `${r.metric}|${r.where}`;

/** The top friction lines: up to `perMetric` places for each signal, signals with the most affected visits first. */
export const frictionLines = (rows: FrictionRow[], perMetric = 3, prev: PrevRun = null): string[] => {
   const byMetric = new Map<string, FrictionRow[]>();
   for (const row of rows) byMetric.set(row.metric, [...(byMetric.get(row.metric) ?? []), row]);
   return [...byMetric.entries()]
      .sort((a, b) => b[1][0].sessions - a[1][0].sessions)
      .map(
         ([metric, list]) =>
            `• ${metric}: ${list
               .slice(0, perMetric)
               .map((r) => {
                  const pct = r.pct !== null ? Math.round(r.pct) : null;
                  const before = prev?.friction_pct[frictionKey(r)];
                  const trend = pct === null || !prev ? '' : before === undefined ? ' (new)' : change(pct, before);
                  return `${r.where} ${fmt(r.sessions)} of ${fmt(r.total)} visits${pct !== null ? ` (${pct}%)` : ''}${trend}`;
               })
               .join(', ')}`
      );
};

// ---- People: per-person onboarding paths -------------------------------------------------------

/** The onboarding steps, in order, as onboarding_timeline names them. */
export const FUNNEL_STEPS = [
   'Tapped Connect Messenger',
   'Opened Messenger chat',
   'Messenger connected',
   'Tapped Connect WhatsApp',
   'WhatsApp connected',
   'Skipped contact step',
   'Turned on push',
   'Wallet connected',
   'Asked to connect / booked call',
   'Call booked',
   'Approved to borrow',
   'ID check submitted',
   'First loan funded'
];
/** Steps after which nobody is "stuck": they're through, or the team turned them down. */
const DONE_STEPS = new Set(['Approved to borrow', 'ID check submitted', 'First loan funded', 'Rejected by team']);
/** How a request ended, as a step in their path. Cancelled requests are stored as expired; decided_by says who. */
export const requestOutcome = (r: Person['request']): string | null => {
   if (!r) return null;
   if (r.status === 'rejected') return 'Rejected by team';
   if (r.status === 'no_show') return 'Missed the call (no-show)';
   if (r.status !== 'expired') return null; // pending = still open; approved = "Approved to borrow" step
   if (r.decided_by?.startsWith('booking-cancelled')) return 'Cancelled their call';
   if (r.decided_by?.startsWith('call-cancelled')) return 'Call cancelled by team';
   return 'Request expired';
};
/** Outcomes after which the borrower has to book again. */
const REBOOK = new Set(['Cancelled their call', 'Missed the call (no-show)', 'Request expired']);
const isOpen = (p: Person) => p.request?.status === 'pending';

/** Their steps with the request's outcome added in time order. */
export const withOutcome = (p: Person): Person => {
   const outcome = requestOutcome(p.request);
   // Safe to apply twice: the lists below call it too.
   if (!outcome || !p.request?.decided_at || p.steps.some((s) => s.step === outcome)) return p;
   const steps = [...p.steps, { step: outcome, at: p.request.decided_at }].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
   return { ...p, steps };
};
const STUCK_AFTER_MS = 60 * 60_000;
/** Not goals in themselves, so never listed under "Nobody yet". */
const OPTIONAL_STEPS = new Set(['Opened Messenger chat', 'Skipped contact step', 'Tapped Connect WhatsApp', 'WhatsApp connected']);
/** A page or device needs this many visits before its share means anything. */
export const MIN_VISITS = 3;

export const formatGap = (ms: number): string => {
   const s = Math.max(0, Math.round(ms / 1000));
   if (s < 60) return `${s}s`;
   const m = Math.round(s / 60);
   if (m < 60) return `${m} min`;
   const h = Math.floor(m / 60);
   if (h < 48) return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`;
   return `${Math.round(h / 24)} days`;
};

const median = (values: number[]): number | null => {
   if (!values.length) return null;
   const sorted = [...values].sort((a, b) => a - b);
   const mid = Math.floor(sorted.length / 2);
   return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const reachedAt = (p: Person, step: string) => p.steps.find((s) => s.step === step)?.at;

/** Step → % of people who reached it (for "what changed" next time). */
export const stepPct = (people: Person[]): Record<string, number> => {
   const out: Record<string, number> = {};
   if (!people.length) return out;
   for (const step of FUNNEL_STEPS) out[step] = Math.round((people.filter((p) => reachedAt(p, step)).length / people.length) * 100);
   return out;
};

/** How long a step took that person: time since the step just before it in their own path. */
const stepTook = (p: Person, step: string): number | null => {
   const i = p.steps.findIndex((s) => s.step === step);
   return i > 0 ? Date.parse(p.steps[i].at) - Date.parse(p.steps[i - 1].at) : null;
};

/** "• Messenger connected: 3 of 5 (60%) · took ~53s ↑ from 40%" for each step someone reached. */
export const funnelLines = (people: Person[], prev: PrevRun = null): string[] => {
   const pct = stepPct(people);
   const lines = [`New borrowers: ${fmt(people.length)}`];
   for (const step of FUNNEL_STEPS) {
      const reached = people.filter((p) => reachedAt(p, step));
      if (!reached.length) continue;
      // Median over the people who did it, of how long it took after their previous step.
      const med = median(reached.map((p) => stepTook(p, step)).filter((ms): ms is number => ms !== null && ms >= 0));
      const timing = med !== null ? ` · took ~${formatGap(med)}` : '';
      lines.push(`• ${step}: ${reached.length} of ${people.length} (${pct[step]}%)${timing}${change(pct[step], prev?.step_pct[step])}`);
   }
   // Steps nobody reached go on one line, so the funnel stays short.
   const none = FUNNEL_STEPS.filter((step) => !OPTIONAL_STEPS.has(step) && !people.some((p) => reachedAt(p, step)));
   if (people.length && none.length) lines.push(`• Nobody yet: ${none.join(', ')}`);
   return lines;
};

const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `P${i + 1}`);
const device = (p: Person) => [p.method, [p.browser, p.os].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'unknown';

/** What a stuck person hasn't done yet, in the order onboarding asks for it. */
const missingSteps = (p: Person): string[] => {
   const did = (step: string) => Boolean(reachedAt(p, step));
   return [
      did('Messenger connected') || did('WhatsApp connected') ? null : did('Tapped Connect Messenger') ? 'finish Messenger (sent no code)' : 'connect Messenger',
      did('Wallet connected') ? null : 'connect wallet',
      did('Asked to connect / booked call') ? (REBOOK.has(p.steps[p.steps.length - 1]?.step) ? 'book the call again' : null) : 'ask to borrow'
   ].filter(Boolean) as string[];
};

/**
 * People who stopped partway (last step not a "done" step, an hour or more ago), most recent first:
 * they're the ones a message can still bring back. Shows the username so the team can reach them.
 */
export const stuckLines = (people: Person[], now: number, max = 6): string[] => {
   const stuck = people
      .map(withOutcome)
      .map((p, i) => ({ p, i, last: p.steps[p.steps.length - 1] }))
      .filter(
         ({ p, last }) =>
            last &&
            !DONE_STEPS.has(last.step) &&
            !isOpen(p) &&
            last.step !== 'Call cancelled by team' &&
            // Asked but no request record to say how it ended: don't guess.
            !(!p.request && reachedAt(p, 'Asked to connect / booked call')) &&
            now - Date.parse(last.at) >= STUCK_AFTER_MS
      )
      .sort((a, b) => Date.parse(b.last.at) - Date.parse(a.last.at));
   if (!stuck.length) return [];
   return [
      `Stopped partway: ${stuck.length} of ${people.length} (newest first, worth a message)`,
      ...stuck.slice(0, max).map(({ p, i, last }) => {
         const who = p.username ? `${letter(i)} @${p.username}` : letter(i);
         return `• ${who} (${device(p)}) · ${formatGap(now - Date.parse(last.at))} ago · hasn't: ${missingSteps(p).join(', ')}`;
      }),
      stuck.length > max ? `• …and ${stuck.length - max} more` : null
   ].filter(Boolean) as string[];
};

const WAITING_AFTER_MS = 24 * 60 * 60_000;

/**
 * People whose next move is ours: an ask-to-borrow / call request still open 24h+ later, or a call the
 * team cancelled with no new booking. A borrower left waiting is friction too.
 */
export const waitingLines = (people: Person[], now: number, max = 6): string[] => {
   const waiting = people
      .map(withOutcome)
      .map((p, i) => {
         const last = p.steps[p.steps.length - 1];
         if (isOpen(p) && now - Date.parse(p.request!.created_at) >= WAITING_AFTER_MS)
            return { p, i, since: p.request!.created_at, why: `${p.request!.kind === 'call' ? 'call request' : 'request'} open` };
         if (last?.step === 'Call cancelled by team') return { p, i, since: last.at, why: 'call cancelled by team, not rebooked' };
         return null;
      })
      .filter((w): w is NonNullable<typeof w> => w !== null)
      .sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
   if (!waiting.length) return [];
   return [
      `Waiting on the team: ${waiting.length} (longest first)`,
      ...waiting.slice(0, max).map(({ p, i, since, why }) => {
         const who = p.username ? `${letter(i)} @${p.username}` : letter(i);
         return `• ${who} · ${why} · ${formatGap(now - Date.parse(since))}`;
      }),
      waiting.length > max ? `• …and ${waiting.length - max} more` : null
   ].filter(Boolean) as string[];
};

/** "How asks ended: 1 cancelled their call · 1 call cancelled by team · 1 still open" */
export const outcomeLine = (people: Person[]): string | null => {
   const counts = new Map<string, number>();
   for (const p of people) {
      if (!p.request) continue;
      const label = isOpen(p) ? 'still open' : p.request.status === 'approved' ? 'approved' : (requestOutcome(p.request) ?? p.request.status).toLowerCase();
      counts.set(label, (counts.get(label) ?? 0) + 1);
   }
   if (!counts.size) return null;
   return `• How asks ended: ${[...counts.entries()].map(([k, n]) => `${n} ${k}`).join(' · ')}`;
};

/** Each person's path for DeepSeek: "A (Google · Chrome/android): Signed up → Wallet connected +52s → …". No names or contact details. */
export const pathLines = (people: Person[], now: number): string[] =>
   people.map(withOutcome).map((p, i) => {
      const steps = p.steps.map((s, j) => (j === 0 ? s.step : `${s.step} +${formatGap(Date.parse(s.at) - Date.parse(p.steps[j - 1].at))}`));
      const last = p.steps[p.steps.length - 1];
      const tail = isOpen(p)
         ? ` → (waiting on the team, ${formatGap(now - Date.parse(p.request!.created_at))})`
         : last && !DONE_STEPS.has(last.step)
           ? ` → (nothing since, ${formatGap(now - Date.parse(last.at))})`
           : '';
      return `${letter(i)} (${device(p)}${p.locale ? ` · ${p.locale}` : ''}): ${steps.join(' → ')}${tail}`;
   });

/** Each new borrower's onboarding path since `since` (public.onboarding_digest_people). */
export const loadPeople = async (supabase: any, since: number): Promise<Person[]> => {
   const { data, error } = await supabase.rpc('onboarding_digest_people', { p_since: new Date(since).toISOString() });
   if (error) throw new Error(`people: ${error.message}`);
   return (Array.isArray(data) ? data : []) as Person[];
};

/** The narrowest window (3, 7, then 14 days) with at least MIN_PEOPLE new borrowers. */
export const loadPeopleWindow = async (supabase: any, now: number): Promise<{ days: number; people: Person[] }> => {
   let last = { days: WINDOWS[0], people: [] as Person[] };
   for (const days of WINDOWS) {
      last = { days, people: await loadPeople(supabase, now - days * 86_400_000) };
      if (last.people.length >= MIN_PEOPLE) break;
   }
   return last;
};

// ---- DeepSeek ----------------------------------------------------------------------------------

export const DIGEST_PROMPT = `You review onboarding friction for Moodeng Credit (moodeng.app), a tiny microloan app for Filipino and
Indonesian gig workers. New borrowers sign up, connect Facebook Messenger (or WhatsApp) by tapping a button and sending a
code in the chat, turn on push reminders, connect a wallet, ask to borrow / book a short intro call, then do an ID check (Didit).
Most use cheap Android phones, often inside the Facebook or Messenger app's own browser.
You get: how many new borrowers reached each step, who stopped partway, EACH PERSON'S PATH with the time between steps
(letters A, B, C are different people), and Clarity's friction signals per page for the last 3 days
(% = share of that page's visits with the problem; team pages are already removed).
Name the 3 places people most likely get stuck, biggest first. Each finding is 2 short sentences in plain English (8th-grade level):
first the evidence with its numbers, naming the people (e.g. "B and D stopped after tapping Connect Messenger"), then one concrete
fix or check for the team to try. Use the paths, not just the totals: never say two different people did something one person did.
Each page has [what it's for] after it. Tie a person's stop to a page's Clarity friction ONLY when that page is part of the step
they stopped at (e.g. stopped at Messenger → [onboarding: connect Messenger…]); never use lender pages or info pages to explain
a borrower's stop. If you still connect something that isn't certain, end that finding with "(guess)".
Check what the people who stopped have in common: sign-up method (Phone code, Google…) and browser (Facebook app = Facebook's
own in-app browser, where many things break). Say so when they share one.
"Waiting on the team" are people the TEAM hasn't approved yet: if anyone waited days, make that one finding (the fix is ours).
Numbers are small: never claim a trend from 1 or 2 people. No markdown, no headings.
Return JSON: {"findings": ["...", "...", "..."]}`;

export const askDeepSeek = async (apiKey: string, data: string): Promise<string[]> => {
   const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
         model: 'deepseek-v4-pro',
         thinking: { type: 'disabled' },
         temperature: 0.2,
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

// ---- The message ---------------------------------------------------------------------------------

const bangkokDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric' });

export type DigestInput = {
   now: number;
   days: number;
   people: Person[];
   /** Clarity export by page and by device + browser; null when there's no token or the call failed. */
   clarity: { byPage: ClarityMetric[]; byDevice: ClarityMetric[] } | null;
   prev: PrevRun;
};

/**
 * Everything above the AI section, plus the numbers saved for next time's "what changed".
 * `aiInput` is the same text plus each person's path, for DeepSeek.
 */
export const composeDigest = ({ now, days, people: raw, clarity, prev }: DigestInput) => {
   const people = raw.map(withOutcome);
   const widened = days > WINDOWS[0] ? ` (widened from ${WINDOWS[0]}: too few sign-ups)` : '';
   const lines = [`🔎 Onboarding friction · ${bangkokDay(now - days * 86_400_000)} – ${bangkokDay(now)} · last ${days} days${widened}`];
   if (prev) lines.push(`Arrows = change since the last digest (${bangkokDay(Date.parse(prev.created_at))}).`);
   lines.push('', ...funnelLines(people, prev));
   const outcomes = outcomeLine(people);
   if (outcomes) lines.push(outcomes);
   const stuck = stuckLines(people, now);
   if (stuck.length) lines.push('', ...stuck);
   const waiting = waitingLines(people, now);
   if (waiting.length) lines.push('', ...waiting);

   const frictionPct: Record<string, number> = {};
   if (clarity) {
      const sessions = trafficSessions(clarity.byPage);
      const allPageRows = frictionRows(clarity.byPage, ['URL']).filter((r) => r.total >= MIN_VISITS);
      const pageRows = allPageRows.filter((r) => !isLenderPage(r.where));
      const lenderRows = allPageRows.filter((r) => isLenderPage(r.where));
      const deviceRows = notableDeviceRows(frictionRows(clarity.byDevice, ['Device', 'Browser']));
      for (const r of [...allPageRows, ...deviceRows]) if (r.pct !== null) frictionPct[frictionKey(r)] = Math.round(r.pct);
      lines.push('', `Clarity · last ${CLARITY_DAYS} days${sessions !== null ? ` · ${fmt(sessions)} visits` : ''} (team pages left out)`);
      lines.push(...(pageRows.length ? frictionLines(pageRows, 3, prev) : ['• No rage/dead clicks, quick-backs or errors recorded']));
      if (lenderRows.length) lines.push('Lender pages:', ...frictionLines(lenderRows, 2, prev));
      if (deviceRows.length) lines.push('Devices doing worse:', ...frictionLines(deviceRows, 2, prev));
   }
   // DeepSeek gets the same text without usernames, plus each person's path.
   // decided_by can carry a team member's handle ("call-cancelled by @…"): drop the handle, keep who-cancelled.
   const anonymous = people.map(({ username: _username, ...rest }) => ({
      ...rest,
      request: rest.request ? { ...rest.request, decided_by: rest.request.decided_by?.replace(/\s*by @\S+/g, '') ?? null } : null
   }));
   // Each page also says what it's for ("/onboarding/connect [onboarding: connect Messenger/WhatsApp…]").
   const aiLines = lines.map((line) =>
      line.replace(/ @[\w.-]+/g, '').replace(/(^|[\s,:])(\/[\w/:.-]*)(?= \d+ of)/g, (_m, pre, path) => `${pre}${path} [${pageArea(path)}]`)
   );
   const aiInput = [...aiLines, '', 'Each person (letters = different people):', ...pathLines(anonymous, now)].join('\n');
   return { lines, aiInput, stepPct: stepPct(people), frictionPct };
};
