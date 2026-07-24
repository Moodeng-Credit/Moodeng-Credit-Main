'use client';

import { useCallback, useEffect, useState } from 'react';

import { type UxFunnelStep, type UxMetrics, getUxMetrics } from './adminSupabase';

function pct(part: number, whole: number): string {
   if (!whole) return '—';
   return `${Math.round((part / whole) * 100)}%`;
}

function Stat({ label, value, note, tone = 'default' }: { label: string; value: string | number; note?: string; tone?: string }) {
   const border =
      tone === 'danger'
         ? 'border-red-900 bg-red-950/40'
         : tone === 'success'
           ? 'border-emerald-900 bg-emerald-950/40'
           : tone === 'blue'
             ? 'border-blue-900 bg-blue-950/40'
             : 'border-[#2a1453] bg-[#1c0a3a]';
   return (
      <div className={`rounded-2xl border p-5 ${border}`}>
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <strong className="mt-2 block text-4xl font-black text-white">{value}</strong>
         {note ? <p className="mt-1 text-sm font-bold text-[#a89bb8]">{note}</p> : null}
      </div>
   );
}

// Horizontal funnel: each step as a bar sized relative to the first step, with the
// conversion % from the previous step. Makes the biggest drop-off obvious at a glance.
function Funnel({ steps }: { steps: UxFunnelStep[] }) {
   const top = steps[0]?.count ?? 0;
   if (!steps.length) return <p className="text-base font-bold text-[#a89bb8]">No data in this window.</p>;
   return (
      <div className="space-y-3">
         {steps.map((step, i) => {
            const prev = i === 0 ? step.count : steps[i - 1].count;
            const width = top ? Math.max((step.count / top) * 100, 2) : 2;
            const dropped = i > 0 && prev > 0 && step.count < prev;
            return (
               <div key={`${step.name}-${i}`}>
                  <div className="mb-1 flex items-baseline justify-between text-sm font-black">
                     <span className="text-[#cfc6dd]">
                        {i + 1}. {step.name}
                     </span>
                     <span className="text-[#a89bb8]">
                        {step.count.toLocaleString()} {i > 0 ? `· ${pct(step.count, prev)} of prev` : ''}
                     </span>
                  </div>
                  <div className="h-6 w-full overflow-hidden rounded-lg bg-[#150a2c]">
                     <div
                        className={`h-full rounded-lg ${dropped ? 'bg-gradient-to-r from-[#8336f0] to-[#c026d3]' : 'bg-[#8336f0]'}`}
                        style={{ width: `${width}%` }}
                     />
                  </div>
               </div>
            );
         })}
      </div>
   );
}

export default function UxHealthSection({ initialData }: { initialData?: UxMetrics } = {}) {
   const [data, setData] = useState<UxMetrics | null>(initialData ?? null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         setData(await getUxMetrics());
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load UX metrics.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      if (initialData) return;
      void load();
   }, [initialData, load]);

   const signinSteps = data?.signin.steps ?? [];
   const signinLanded = signinSteps[0]?.count ?? 0;
   const signinReached = signinSteps[signinSteps.length - 1]?.count ?? 0;
   const signinConv = pct(signinReached, signinLanded);

   return (
      <div className="space-y-5">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
               <h3 className="text-3xl font-black">UX Health</h3>
               <p className="text-sm font-bold text-[#a89bb8]">Where users get stuck or frustrated · last 30 days · via PostHog</p>
            </div>
            <div className="flex items-center gap-2">
               {data?.dashboardUrl ? (
                  <a
                     href={data.dashboardUrl}
                     target="_blank"
                     rel="noreferrer"
                     className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white hover:bg-[#2a1453]"
                  >
                     Open in PostHog ↗
                  </a>
               ) : null}
               <button
                  type="button"
                  onClick={() => load()}
                  disabled={loading}
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               >
                  {loading ? '…' : 'Refresh'}
               </button>
            </div>
         </div>

         {error ? (
            <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">{error}</div>
         ) : null}

         {data && !data.configured ? (
            <div className="rounded-2xl border border-amber-900 bg-amber-950/40 p-5 text-base font-bold text-amber-200">
               <p className="mb-2 text-xl font-black text-amber-100">One-time setup needed</p>
               <p>
                  These tiles read aggregate numbers from PostHog. Add a PostHog <strong>personal API key</strong> (with read scope)
                  as the <code className="rounded bg-black/40 px-1">POSTHOG_PERSONAL_API_KEY</code> secret on the Supabase project, then hit Refresh.
               </p>
               {data.reason ? <p className="mt-2 text-sm text-amber-300/80">{data.reason}</p> : null}
            </div>
         ) : null}

         {!data ? (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               {loading ? 'Loading UX metrics…' : 'No data.'}
            </div>
         ) : data.configured ? (
            <>
               <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Stat
                     label="Sign-in conversion"
                     value={signinConv}
                     note={`${signinReached} of ${signinLanded} got in`}
                     tone={signinLanded && signinReached / signinLanded < 0.5 ? 'danger' : 'success'}
                  />
                  <Stat label="Rage clicks" value={data.rageClicks.toLocaleString()} note="frustration signal" tone={data.rageClicks ? 'danger' : 'default'} />
                  <Stat label="Dead clicks" value={data.deadClicks.toLocaleString()} note="clicked, nothing happened" tone={data.deadClicks ? 'danger' : 'default'} />
                  <Stat
                     label="Errors"
                     value={data.errors.total.toLocaleString()}
                     note={`${data.errors.sessions} session${data.errors.sessions === 1 ? '' : 's'} affected`}
                     tone={data.errors.total ? 'danger' : 'default'}
                  />
               </div>

               <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                     <h4 className="mb-1 text-xl font-black text-[#cfc6dd]">Sign-in conversion</h4>
                     <p className="mb-4 text-sm font-bold text-[#a89bb8]">Do people who land on sign-in actually get in?</p>
                     <Funnel steps={signinSteps} />
                  </div>
                  <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                     <h4 className="mb-1 text-xl font-black text-[#cfc6dd]">Onboarding drop-off</h4>
                     <p className="mb-4 text-sm font-bold text-[#a89bb8]">Which signup step loses the most people?</p>
                     <Funnel steps={data.onboarding.steps} />
                  </div>
               </div>

               <p className="text-xs font-bold text-[#6f6385]">
                  Updated {new Date(data.generatedAt).toLocaleString()} · matches the PostHog “UX Friction” dashboard.
               </p>
            </>
         ) : null}
      </div>
   );
}
