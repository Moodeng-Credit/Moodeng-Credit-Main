'use client';

import { useCallback, useEffect, useState } from 'react';

import { type Automation, type AutomationStep, listAutomations, saveAutomation } from '@/app/admin/adminSupabase';

// Admin → Campaigns → Automations: journeys that run by themselves every day at 10:00 Manila
// (campaign-automations). Today: "Repaid → come back". Switch it on/off, edit each step's day and
// text, see who's due today, who the weekly limit is holding back, and what went out recently.

const CHANNEL_LABEL = { messenger: 'Messenger', email: 'Email', push: 'Push' } as const;
const DETAIL_LABEL: Record<string, string> = {
   unsubscribed: 'unsubscribed from email',
   no_email: 'no email on file',
   no_device: 'notifications not turned on',
   push_failed: 'push failed'
};

const errorText = (err: unknown, fallback: string) => (err as { message?: string } | null)?.message || fallback;
const shortDateTime = (iso: string) =>
   new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function AutomationsPanel() {
   const [automation, setAutomation] = useState<Automation | null>(null);
   const [draft, setDraft] = useState<AutomationStep[]>([]);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [saved, setSaved] = useState(false);
   const [showLog, setShowLog] = useState(false);

   const apply = (list: Automation[]) => {
      const a = list[0] ?? null;
      setAutomation(a);
      setDraft(a ? a.steps.map((s) => ({ ...s })) : []);
   };

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         apply((await listAutomations()).automations);
      } catch (err) {
         setError(errorText(err, 'Could not load automations.'));
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const dirty =
      automation !== null &&
      JSON.stringify(draft.map(({ step, delay_days, subject, message }) => ({ step, delay_days, subject, message }))) !==
         JSON.stringify(automation.steps.map(({ step, delay_days, subject, message }) => ({ step, delay_days, subject, message })));

   const save = async (enabled?: boolean) => {
      if (!automation) return;
      if (enabled === true && !window.confirm(`Switch on "${automation.name}"? It will message borrowers automatically every day.`)) return;
      setSaving(true);
      setError(null);
      setSaved(false);
      try {
         apply(
            (
               await saveAutomation({
                  id: automation.id,
                  ...(enabled === undefined ? {} : { enabled }),
                  ...(dirty ? { steps: draft.map((s) => ({ step: s.step, delayDays: s.delay_days, subject: s.subject, message: s.message })) } : {})
               })
            ).automations
         );
         setSaved(true);
      } catch (err) {
         setError(errorText(err, 'Could not save.'));
      } finally {
         setSaving(false);
      }
   };

   const updateStep = (step: number, patch: Partial<AutomationStep>) =>
      setDraft((prev) => prev.map((s) => (s.step === step ? { ...s, ...patch } : s)));

   if (loading && !automation) return <p className="text-[#a89bb8]">Loading automations…</p>;
   if (!automation) return error ? <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 font-bold text-red-300">{error}</p> : null;

   return (
      <div className="space-y-4 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
         <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
               <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">Automation</p>
               <p className="text-lg font-black">{automation.name}</p>
               <p className="text-sm text-[#a89bb8]">
                  Runs daily at 10:00 Manila. After a borrower repays and has nothing open, each step goes out once, inside its own
                  week ({automation.stepWindowDays} days). Nobody gets more than one message per {automation.capDays} days (campaigns
                  included). People who repaid long ago are never sent old steps.
               </p>
            </div>
            <button
               className={`rounded-full px-5 py-2 text-base font-black disabled:opacity-50 ${automation.enabled ? 'bg-emerald-600 text-white' : 'bg-[#241044] text-[#c9b8ff]'}`}
               disabled={saving}
               onClick={() => void save(!automation.enabled)}
               type="button"
            >
               {automation.enabled ? 'ON — tap to pause' : 'OFF — tap to switch on'}
            </button>
         </div>

         <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-[#12052a] px-3 py-1 font-bold text-white">
               Due today: {automation.dueToday.length}
               {automation.dueToday.length ? ` (${automation.dueToday.map((d) => `${d.name} · step ${d.step}`).join(', ')})` : ''}
            </span>
            {automation.waitingForLimit.length ? (
               <span className="rounded-full bg-[#12052a] px-3 py-1 font-bold text-amber-300">
                  Waiting for the weekly limit: {automation.waitingForLimit.length}
               </span>
            ) : null}
            <button className="rounded-full bg-[#1c053d] px-3 py-1 font-black text-white" disabled={loading} onClick={() => void load()} type="button">
               {loading ? 'Loading…' : 'Refresh'}
            </button>
         </div>

         <div className="space-y-3">
            {draft.map((s) => (
               <div className="space-y-2 rounded-xl border border-[#2a1453] bg-[#12052a] p-3" key={s.step}>
                  <label className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#a89bb8]">
                     Step {s.step} —
                     <input
                        className="w-20 rounded-full border border-[#2a1453] bg-[#1c0a3a] px-3 py-1 text-sm text-white"
                        max={365}
                        min={1}
                        onChange={(e) => updateStep(s.step, { delay_days: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })}
                        type="number"
                        value={s.delay_days}
                     />
                     days after they repay
                  </label>
                  <input
                     className="w-full rounded-lg border border-[#2a1453] bg-[#1c0a3a] px-3 py-2 text-sm font-bold text-white"
                     maxLength={200}
                     onChange={(e) => updateStep(s.step, { subject: e.target.value })}
                     value={s.subject}
                  />
                  <textarea
                     className="min-h-28 w-full rounded-lg border border-[#2a1453] bg-[#1c0a3a] p-3 text-sm text-white"
                     maxLength={2000}
                     onChange={(e) => updateStep(s.step, { message: e.target.value })}
                     value={s.message}
                  />
               </div>
            ))}
         </div>

         <div className="flex flex-wrap items-center gap-3">
            <button
               className="rounded-full bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
               disabled={!dirty || saving}
               onClick={() => void save()}
               type="button"
            >
               {saving ? 'Saving…' : 'Save messages'}
            </button>
            {dirty ? <span className="text-sm font-bold text-amber-300">Unsaved changes</span> : null}
            {saved && !dirty ? <span className="text-sm font-bold text-emerald-300">Saved ✓</span> : null}
            <span className="text-sm text-[#a89bb8]">{'{first_name}'} becomes each person&apos;s first name.</span>
         </div>
         {error ? <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 font-bold text-red-300">{error}</p> : null}

         <div>
            <button className="text-sm font-black text-[#c9b8ff] underline" onClick={() => setShowLog((v) => !v)} type="button">
               {showLog ? 'Hide' : 'Show'} last 30 days ({automation.recentSends.filter((r) => r.status === 'sent').length} sent)
            </button>
            {showLog ? (
               automation.recentSends.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                     {automation.recentSends.map((r) => (
                        <li key={`${r.user_id}-${r.step}-${r.channel}-${r.created_at}`}>
                           <span className="text-[#7a6b8f]">{shortDateTime(r.created_at)}</span>{' '}
                           <span className="font-bold">{r.users?.display_name || r.users?.username || r.users?.email || r.user_id}</span>
                           {` · step ${r.step} · ${CHANNEL_LABEL[r.channel]} · `}
                           <span className={r.status === 'sent' ? 'text-emerald-300' : r.status === 'failed' ? 'text-red-300' : 'text-[#a89bb8]'}>
                              {r.status}
                           </span>
                           {r.detail ? <span className="text-[#7a6b8f]"> ({DETAIL_LABEL[r.detail] ?? r.detail})</span> : null}
                        </li>
                     ))}
                  </ul>
               ) : (
                  <p className="mt-2 text-sm text-[#a89bb8]">Nothing sent yet.</p>
               )
            ) : null}
         </div>
      </div>
   );
}
