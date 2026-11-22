'use client';

import { useCallback, useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Admin → Growth → Spin wheel (Moo-Spin, moodeng.app/spin). The switch, the weekly pot, the odds per
// group, and the campaigns: a Facebook post or video gets a code, its link is moodeng.app/spin/CODE,
// and people who read / watch it and answer its question get one spin. All rules are in the database
// (migration 20261122120000_spin_wheel).

type Prize = 'grab100' | 'food50' | 'locked50' | 'extra' | 'none';
type Segment = 'new' | 'comeback' | 'regular';
type Config = {
   mode: 'off' | 'team' | 'on';
   pot: Record<'grab100' | 'food50' | 'locked50', number>;
   odds: Record<Segment, Record<Prize, number>>;
   cash_cooldown_days: number;
};
type Campaign = {
   code: string;
   title: string;
   body: string | null;
   videoUrl: string | null;
   question: string | null;
   options: string[];
   answerIndex: number | null;
   startsAt: string;
   endsAt: string | null;
   active: boolean;
   tickets: number;
   spins: number;
   wins: number;
};
type Overview = {
   config: Config;
   potLeft: Record<'grab100' | 'food50' | 'locked50', number>;
   week: { spins: number; people: number; grab100: number; food50: number; locked50: number; claimedPhp: number };
   allTime: { spins: number; people: number; claimedPhp: number; lockedOpen: number };
   campaigns: Campaign[];
   recent: Array<{
      created_at: string;
      prize: Prize;
      amountPhp: number | null;
      segment: Segment;
      source: string;
      campaignCode: string | null;
      isTest: boolean;
      claimed: boolean;
      name: string | null;
   }>;
};

const PRIZES: Array<{ id: Prize; label: string; costPhp: number }> = [
   { id: 'grab100', label: '₱100 now', costPhp: 100 },
   { id: 'food50', label: '₱50 now', costPhp: 50 },
   { id: 'locked50', label: '₱50 next loan', costPhp: 50 },
   { id: 'extra', label: 'Spin again', costPhp: 0 },
   { id: 'none', label: 'Try again', costPhp: 0 }
];
const SEGMENTS: Array<{ id: Segment; label: string; hint: string }> = [
   { id: 'new', label: 'New', hint: 'never borrowed or first loan' },
   { id: 'comeback', label: 'Comeback', hint: 'repaid, idle 14+ days' },
   { id: 'regular', label: 'Regular', hint: 'everyone else' }
];

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));
const bkk = (iso: string) =>
   new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Expected ₱ per spin for one group: cash now counts in full; "next loan" counts in full too (worst case). */
const costPerSpin = (odds: Record<Prize, number>) => {
   const total = PRIZES.reduce((sum, prize) => sum + Math.max(0, Number(odds[prize.id]) || 0), 0);
   if (!total) return 0;
   return PRIZES.reduce((sum, prize) => sum + (Math.max(0, Number(odds[prize.id]) || 0) / total) * prize.costPhp, 0);
};

const EMPTY_FORM = { code: '', title: '', body: '', videoUrl: '', question: '', options: ['', '', ''], answerIndex: 0, endsAt: '' };

export default function SpinWheelSection() {
   const [data, setData] = useState<Overview | null>(null);
   const [config, setConfig] = useState<Config | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [form, setForm] = useState(EMPTY_FORM);
   const [saved, setSaved] = useState<string | null>(null);

   const load = useCallback(async () => {
      try {
         const { data: raw, error: rpcError } = await getSupabaseBrowserClient().rpc('admin_spin_overview');
         if (rpcError) throw rpcError;
         const next = raw as Overview;
         setData(next);
         setConfig(next.config);
         setError(null);
      } catch (err) {
         setError(errorMessage(err));
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const saveConfig = async (patch: Partial<Config>) => {
      setBusy(true);
      try {
         const { error: rpcError } = await getSupabaseBrowserClient().rpc('admin_set_spin_config', { p_config: patch });
         if (rpcError) throw rpcError;
         setSaved('Saved');
         await load();
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setBusy(false);
      }
   };

   const saveCampaign = async (campaign: Record<string, unknown>) => {
      setBusy(true);
      try {
         const { error: rpcError } = await getSupabaseBrowserClient().rpc('admin_save_spin_campaign', { p_campaign: campaign });
         if (rpcError) throw rpcError;
         setSaved(`Saved ${String(campaign.code)}`);
         await load();
         return true;
      } catch (err) {
         setError(errorMessage(err));
         return false;
      } finally {
         setBusy(false);
      }
   };

   const createCampaign = async () => {
      const options = form.options.map((option) => option.trim()).filter(Boolean);
      const ok = await saveCampaign({
         code: form.code.trim().toUpperCase(),
         title: form.title.trim(),
         body: form.body.trim() || null,
         videoUrl: form.videoUrl.trim() || null,
         question: form.question.trim() || null,
         options,
         answerIndex: form.question.trim() ? form.answerIndex : null,
         endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
         active: true
      });
      if (ok) setForm(EMPTY_FORM);
   };

   const setOdds = (segment: Segment, prize: Prize, value: string) =>
      setConfig((prev) =>
         prev ? { ...prev, odds: { ...prev.odds, [segment]: { ...prev.odds[segment], [prize]: Number(value) } } } : prev
      );
   const setPot = (prize: 'grab100' | 'food50' | 'locked50', value: string) =>
      setConfig((prev) => (prev ? { ...prev, pot: { ...prev.pot, [prize]: Number(value) } } : prev));

   const input = 'w-full rounded-xl bg-[#241044] px-3 py-2 text-sm text-white placeholder:text-[#6f6385]';

   return (
      <div className="space-y-4">
         <article className="rounded-2xl border border-[#3a2366] bg-[#1c0a3a] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
               <h4 className="text-xl font-black">🎡 Moo-Spin</h4>
               <div className="flex gap-1 rounded-full bg-[#241044] p-1">
                  {(['off', 'team', 'on'] as const).map((mode) => (
                     <button
                        key={mode}
                        type="button"
                        disabled={busy}
                        onClick={() => saveConfig({ mode })}
                        className={`rounded-full px-4 py-1.5 text-sm font-black ${config?.mode === mode ? 'bg-[#8336f0] text-white' : 'text-[#a89bb8]'}`}
                     >
                        {mode === 'off' ? 'Off' : mode === 'team' ? 'Team test' : 'Live'}
                     </button>
                  ))}
               </div>
            </div>
            <p className="mt-1 text-sm font-medium text-[#a89bb8]">
               Team test: only the team can spin, nothing is sent and the pot isn&apos;t touched. Live: every approved PH borrower with no
               overdue loan. Link: moodeng.app/spin (welcome spin) or moodeng.app/spin/CODE (a campaign). Messenger &quot;SPIN&quot; answers
               with the newest campaign&apos;s link.
            </p>
            {error ? <p className="mt-2 text-sm font-bold text-red-300">{error}</p> : null}
            {saved ? <p className="mt-2 text-sm font-bold text-emerald-300">{saved}</p> : null}
            {data ? (
               <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                     ['Spins this week', `${data.week.spins} (${data.week.people} people)`],
                     ['Won this week', `₱100 ×${data.week.grab100} · ₱50 ×${data.week.food50} · next-loan ×${data.week.locked50}`],
                     [
                        'Left this week',
                        `₱100 ×${data.potLeft.grab100} · ₱50 ×${data.potLeft.food50} · next-loan ×${data.potLeft.locked50}`
                     ],
                     [
                        'All time',
                        `${data.allTime.spins} spins · ₱${data.allTime.claimedPhp} claimed · ${data.allTime.lockedOpen} next-loan open`
                     ]
                  ].map(([label, value]) => (
                     <div key={label} className="rounded-xl bg-[#241044] px-3 py-2">
                        <p className="text-xs font-bold uppercase text-[#a89bb8]">{label}</p>
                        <p className="text-sm font-black text-white">{value}</p>
                     </div>
                  ))}
               </div>
            ) : (
               <p className="mt-2 text-base font-bold text-[#6f6385]">Loading…</p>
            )}
         </article>

         {config ? (
            <article className="rounded-2xl border border-[#3a2366] bg-[#1c0a3a] p-5">
               <h4 className="text-lg font-black">Weekly pot and odds</h4>
               <p className="mt-1 text-sm font-medium text-[#a89bb8]">
                  The pot resets Monday 00:00 Bangkok. A sold-out prize can&apos;t be drawn (greyed on the wheel). One cash prize per person
                  every {config.cash_cooldown_days} days. Odds are weights, they don&apos;t need to add to 100. Welcome spins skip
                  &quot;Spin again&quot; and &quot;Try again&quot;.
               </p>
               <div className="mt-3 flex flex-wrap gap-3">
                  {(['grab100', 'food50', 'locked50'] as const).map((prize) => (
                     <label key={prize} className="text-sm font-bold text-[#cfc6dd]">
                        {PRIZES.find((item) => item.id === prize)?.label} per week
                        <input
                           type="number"
                           min={0}
                           className={`${input} mt-1 w-28`}
                           value={config.pot[prize]}
                           onChange={(e) => setPot(prize, e.target.value)}
                        />
                     </label>
                  ))}
               </div>
               <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className="text-left text-[#a89bb8]">
                           <th className="py-1 pr-3">Group</th>
                           {PRIZES.map((prize) => (
                              <th key={prize.id} className="py-1 pr-3">
                                 {prize.label}
                              </th>
                           ))}
                           <th className="py-1">≤ ₱ per spin</th>
                        </tr>
                     </thead>
                     <tbody>
                        {SEGMENTS.map((segment) => (
                           <tr key={segment.id}>
                              <td className="py-1 pr-3 font-black text-white">
                                 {segment.label}
                                 <span className="block text-xs font-medium text-[#a89bb8]">{segment.hint}</span>
                              </td>
                              {PRIZES.map((prize) => (
                                 <td key={prize.id} className="py-1 pr-3">
                                    <input
                                       type="number"
                                       min={0}
                                       className={`${input} w-20`}
                                       value={config.odds[segment.id][prize.id]}
                                       onChange={(e) => setOdds(segment.id, prize.id, e.target.value)}
                                    />
                                 </td>
                              ))}
                              <td className="py-1 font-black text-amber-200">₱{costPerSpin(config.odds[segment.id]).toFixed(1)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveConfig({ pot: config.pot, odds: config.odds })}
                  className="mt-3 rounded-xl bg-[#8336f0] px-4 py-2 text-base font-black text-white disabled:opacity-50"
               >
                  Save pot and odds
               </button>
            </article>
         ) : null}

         <article className="rounded-2xl border border-[#3a2366] bg-[#1c0a3a] p-5">
            <h4 className="text-lg font-black">New campaign (a post or video)</h4>
            <p className="mt-1 text-sm font-medium text-[#a89bb8]">
               Post on Facebook: &quot;Read this, then comment or message SPIN for a free spin 🎡&quot; plus the link. A YouTube link plays
               in the page and the question shows when it ends.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
               <input
                  className={input}
                  placeholder="Code, e.g. PAYDAY (A–Z, 0–9)"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
               />
               <input
                  className={input}
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
               />
               <textarea
                  className={`${input} sm:col-span-2`}
                  rows={3}
                  placeholder="Announcement text (optional)"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
               />
               <input
                  className={input}
                  placeholder="Video link (optional, https://…)"
                  value={form.videoUrl}
                  onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
               />
               <label className="text-sm font-bold text-[#cfc6dd]">
                  Ends (optional)
                  <input
                     type="datetime-local"
                     className={`${input} mt-1`}
                     value={form.endsAt}
                     onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  />
               </label>
               <input
                  className={`${input} sm:col-span-2`}
                  placeholder="Question about it (optional, proves they read it)"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
               />
               {form.question.trim()
                  ? form.options.map((option, index) => (
                       <label key={index} className="flex items-center gap-2 text-sm font-bold text-[#cfc6dd]">
                          <input
                             type="radio"
                             name="spin-answer"
                             checked={form.answerIndex === index}
                             onChange={() => setForm({ ...form, answerIndex: index })}
                          />
                          <input
                             className={input}
                             placeholder={`Answer ${index + 1}${index === form.answerIndex ? ' (right one)' : ''}`}
                             value={option}
                             onChange={(e) =>
                                setForm({ ...form, options: form.options.map((item, i) => (i === index ? e.target.value : item)) })
                             }
                          />
                       </label>
                    ))
                  : null}
            </div>
            <button
               type="button"
               disabled={busy || form.code.length < 3 || form.title.trim().length < 2}
               onClick={createCampaign}
               className="mt-3 rounded-xl bg-[#8336f0] px-4 py-2 text-base font-black text-white disabled:opacity-50"
            >
               Save campaign
            </button>
         </article>

         {data?.campaigns.length ? (
            <article className="rounded-2xl border border-[#3a2366] bg-[#1c0a3a] p-5">
               <h4 className="text-lg font-black">Campaigns</h4>
               <ul className="mt-3 space-y-2">
                  {data.campaigns.map((campaign) => {
                     const link = `https://moodeng.app/spin/${campaign.code}`;
                     return (
                        <li
                           key={campaign.code}
                           className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#241044] px-4 py-3"
                        >
                           <div className="min-w-0">
                              <p className="text-base font-black text-white">
                                 {campaign.code} · {campaign.title}{' '}
                                 {campaign.active ? null : <span className="text-[#a89bb8]">(paused)</span>}
                              </p>
                              <p className="text-sm font-medium text-[#a89bb8]">
                                 {campaign.tickets} earned a spin · {campaign.spins} spun · {campaign.wins} won · since{' '}
                                 {bkk(campaign.startsAt)}
                                 {campaign.endsAt ? ` · ends ${bkk(campaign.endsAt)}` : ''}
                              </p>
                              <p className="break-all font-mono text-sm text-[#cfc6dd]">{link}</p>
                           </div>
                           <div className="flex gap-2">
                              <button
                                 type="button"
                                 onClick={() => void navigator.clipboard?.writeText(link).then(() => setSaved(`Copied ${link}`))}
                                 className="rounded-xl bg-[#3a2366] px-3 py-2 text-sm font-black text-white"
                              >
                                 Copy link
                              </button>
                              <button
                                 type="button"
                                 disabled={busy}
                                 onClick={() => saveCampaign({ ...campaign, active: !campaign.active })}
                                 className="rounded-xl bg-[#3a2366] px-3 py-2 text-sm font-black text-white disabled:opacity-50"
                              >
                                 {campaign.active ? 'Pause' : 'Resume'}
                              </button>
                           </div>
                        </li>
                     );
                  })}
               </ul>
            </article>
         ) : null}

         {data?.recent.length ? (
            <article className="rounded-2xl border border-[#3a2366] bg-[#1c0a3a] p-5">
               <h4 className="text-lg font-black">Latest spins</h4>
               <ul className="mt-2 space-y-1 text-sm">
                  {data.recent.map((spin, index) => (
                     <li key={index} className="flex flex-wrap gap-x-2 text-[#cfc6dd]">
                        <span className="text-[#a89bb8]">{bkk(spin.created_at)}</span>
                        <span className="font-black text-white">{spin.name || 'Someone'}</span>
                        <span>{PRIZES.find((prize) => prize.id === spin.prize)?.label}</span>
                        <span className="text-[#a89bb8]">
                           {spin.segment} · {spin.campaignCode ?? spin.source}
                           {spin.isTest ? ' · test' : ''}
                           {spin.claimed ? ' · claimed' : ''}
                        </span>
                     </li>
                  ))}
               </ul>
            </article>
         ) : null}
      </div>
   );
}
