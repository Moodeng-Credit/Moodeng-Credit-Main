'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

import {
   type AdminDirectoryUser,
   upsertAccountRestrictionByUsername,
   upsertRiskProfileByUsername
} from './adminSupabase';

type Band = 'Low' | 'Medium' | 'High' | 'Critical';
type SignalKey = 'I' | 'V' | 'R' | 'N' | 'A' | 'E' | 'B';

interface SignalNode {
   score: number;
   weight: number;
   factors: string[];
}

interface RiskScoreRow {
   id: string;
   user_id: string;
   score: number;
   band: Band;
   trigger: string;
   computed_at: string;
   signal_breakdown: Record<SignalKey, SignalNode>;
}

interface AdminRiskProfileRow {
   user_id: string;
   score: number;
   risk_level: 'low' | 'medium' | 'high';
   status: 'active' | 'watchlist' | 'blocked';
   algorithm_version: string | null;
   algorithm_note: string | null;
   override_score: number | null;
   override_reason: string | null;
   computed_at: string | null;
}

const SIGNAL_LABEL: Record<SignalKey, string> = {
   I: 'Identity',
   V: 'Velocity',
   R: 'Repayment',
   N: 'Network / Self-lending',
   A: 'Amount',
   E: 'Engagement',
   B: 'Bot pattern'
};

function bandFor(score: number | null | undefined): Band {
   if (score == null) return 'Medium';
   if (score < 30) return 'Low';
   if (score < 55) return 'Medium';
   if (score < 75) return 'High';
   return 'Critical';
}

function bandClass(band: Band): string {
   switch (band) {
      case 'Low':
         return 'bg-emerald-100 text-emerald-800';
      case 'Medium':
         return 'bg-amber-100 text-amber-900';
      case 'High':
         return 'bg-orange-100 text-orange-900';
      case 'Critical':
         return 'bg-red-100 text-red-800';
   }
}

interface RiskAssessmentSectionProps {
   directoryRows: AdminDirectoryUser[];
   adminDataLoading: boolean;
   adminDataLoaded: boolean;
   currentAdminId?: string | null;
   onSwitchToNotifications?: (username: string) => void;
}

export default function RiskAssessmentSection({
   directoryRows,
   adminDataLoading,
   adminDataLoaded,
   currentAdminId,
   onSwitchToNotifications
}: RiskAssessmentSectionProps) {
   const [profiles, setProfiles] = useState<Record<string, AdminRiskProfileRow>>({});
   const [latestScores, setLatestScores] = useState<Record<string, RiskScoreRow>>({});
   const [notes, setNotes] = useState<Record<string, string>>({});
   const [busy, setBusy] = useState<string | null>(null);
   const [statusByUsername, setStatusByUsername] = useState<Record<string, string>>({});

   const loadRiskData = useCallback(async () => {
      if (!directoryRows.length) return;
      const supabase = getSupabaseBrowserClient();
      const ids = directoryRows.map((u) => u.id);

      const [{ data: prof }, { data: scores }] = await Promise.all([
         supabase
            .from('admin_risk_profiles')
            .select(
               'user_id, score, risk_level, status, algorithm_version, algorithm_note, override_score, override_reason, computed_at'
            )
            .in('user_id', ids),
         supabase
            .from('risk_scores')
            .select('id, user_id, score, band, trigger, computed_at, signal_breakdown')
            .in('user_id', ids)
            .order('computed_at', { ascending: false })
      ]);

      const profMap: Record<string, AdminRiskProfileRow> = {};
      for (const row of (prof ?? []) as AdminRiskProfileRow[]) profMap[row.user_id] = row;
      setProfiles(profMap);

      const scoreMap: Record<string, RiskScoreRow> = {};
      for (const row of (scores ?? []) as RiskScoreRow[]) {
         if (!scoreMap[row.user_id]) scoreMap[row.user_id] = row;
      }
      setLatestScores(scoreMap);
   }, [directoryRows]);

   useEffect(() => {
      void loadRiskData();
   }, [loadRiskData]);

   const recompute = useCallback(
      async (userId: string, username: string | null) => {
         setBusy(`recompute:${userId}`);
         try {
            const r = await fetch('/api/risk-recompute', {
               method: 'POST',
               headers: { 'content-type': 'application/json' },
               body: JSON.stringify({ user_id: userId, trigger: 'manual' })
            });
            const j = await r.json();
            if (!j.ok) throw new Error(j.error ?? 'recompute failed');
            await loadRiskData();
            if (username) {
               setStatusByUsername((s) => ({ ...s, [username]: `Recomputed: ${j.score} (${j.band})` }));
            }
         } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (username) setStatusByUsername((s) => ({ ...s, [username]: `Recompute failed: ${msg}` }));
         } finally {
            setBusy(null);
         }
      },
      [loadRiskData]
   );

   const recomputeAll = useCallback(async () => {
      if (typeof window !== 'undefined' && !window.confirm('Recompute risk score for ALL users? This may take a minute.')) return;
      setBusy('batch');
      try {
         const r = await fetch('/api/risk-recompute', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ batch: true, trigger: 'daily_batch' })
         });
         const j = await r.json();
         if (!j.ok) throw new Error(j.error ?? 'batch failed');
         if (typeof window !== 'undefined') {
            window.alert(
               `Recomputed ${j.summary.total} users. Low ${j.summary.by_band.Low}, Medium ${j.summary.by_band.Medium}, High ${j.summary.by_band.High}, Critical ${j.summary.by_band.Critical}.`
            );
         }
         await loadRiskData();
      } catch (e) {
         if (typeof window !== 'undefined') window.alert(`Batch failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
         setBusy(null);
      }
   }, [loadRiskData]);

   const saveReview = useCallback(
      async (user: AdminDirectoryUser) => {
         if (!user.username) return;
         const note = (notes[user.username] ?? '').trim();
         const profile = profiles[user.id];
         const latest = latestScores[user.id];
         const score = profile?.score ?? latest?.score ?? 0;
         const riskLevel: 'low' | 'medium' | 'high' = score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low';
         setBusy(`review:${user.id}`);
         try {
            await upsertRiskProfileByUsername({
               username: user.username,
               score,
               risk_level: riskLevel,
               status: profile?.status === 'blocked' ? 'blocked' : 'active',
               algorithm_note: note || profile?.algorithm_note || 'manual review',
               override_reason: note || null,
               override_by: currentAdminId ?? null
            });
            setStatusByUsername((s) => ({ ...s, [user.username!]: 'Risk review saved.' }));
            setNotes((n) => ({ ...n, [user.username!]: '' }));
            await loadRiskData();
         } catch (e) {
            setStatusByUsername((s) => ({
               ...s,
               [user.username!]: `Save failed: ${e instanceof Error ? e.message : String(e)}`
            }));
         } finally {
            setBusy(null);
         }
      },
      [notes, profiles, latestScores, currentAdminId, loadRiskData]
   );

   const toggleWatchlist = useCallback(
      async (user: AdminDirectoryUser) => {
         if (!user.username) return;
         const profile = profiles[user.id];
         const score = profile?.score ?? 50;
         const riskLevel: 'low' | 'medium' | 'high' = score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low';
         setBusy(`watch:${user.id}`);
         try {
            await upsertAccountRestrictionByUsername({
               username: user.username,
               status: 'watchlist',
               reason: 'manual',
               risk_level: riskLevel,
               admin_note: 'Added to watchlist from risk panel',
               evidence_summary: profile?.algorithm_note ?? null,
               updated_by: currentAdminId ?? null
            });
            setStatusByUsername((s) => ({ ...s, [user.username!]: 'Moved to watchlist.' }));
         } catch (e) {
            setStatusByUsername((s) => ({
               ...s,
               [user.username!]: `Watchlist failed: ${e instanceof Error ? e.message : String(e)}`
            }));
         } finally {
            setBusy(null);
         }
      },
      [profiles, currentAdminId]
   );

   const sortedRows = useMemo(() => {
      return [...directoryRows].sort((a, b) => {
         const sa = profiles[a.id]?.score ?? -1;
         const sb = profiles[b.id]?.score ?? -1;
         return sb - sa;
      });
   }, [directoryRows, profiles]);

   return (
      <section className="space-y-6">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
               <h2 className="break-words text-4xl font-black sm:text-5xl">Risk assessment</h2>
               <p className="mt-3 text-2xl text-[#6f627e]">
                  Consensus risk score (v1) across 7 signals: identity, velocity, repayment, network /
                  self-lending, amount, engagement, bot patterns.
               </p>
            </div>
            <button
               type="button"
               onClick={recomputeAll}
               disabled={busy === 'batch'}
               className="rounded-2xl bg-[#1c053d] px-5 py-3 text-lg font-black text-white disabled:opacity-50"
            >
               {busy === 'batch' ? 'Recomputing…' : 'Recompute all'}
            </button>
         </div>

         <div className="grid gap-5 xl:grid-cols-2">
            {adminDataLoading && !adminDataLoaded ? (
               <div className="rounded-3xl border border-[#eadff8] bg-white p-6 text-2xl font-black">
                  Loading users before risk review…
               </div>
            ) : null}

            {adminDataLoaded
               ? sortedRows.map((user) => {
                    const profile = profiles[user.id];
                    const latest = latestScores[user.id];
                    const score = profile?.score ?? latest?.score ?? null;
                    const band = latest?.band ?? bandFor(score);
                    const breakdown = latest?.signal_breakdown;
                    const factorList = breakdown
                       ? (Object.keys(SIGNAL_LABEL) as SignalKey[])
                            .flatMap((k) =>
                               (breakdown[k]?.factors ?? []).map((f) => `${SIGNAL_LABEL[k]}: ${f}`)
                            )
                            .slice(0, 8)
                       : [];

                    return (
                       <article
                          key={user.id}
                          className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm"
                       >
                          <div className="flex items-start justify-between gap-3">
                             <h3 className="break-words text-3xl font-black">
                                {user.username ?? user.id.slice(0, 8)}
                             </h3>
                             <span
                                className={`rounded-full px-4 py-1 text-base font-black uppercase ${bandClass(band)}`}
                             >
                                {band} risk
                             </span>
                          </div>

                          <div className="mt-3 flex items-baseline gap-2">
                             <span className="text-5xl font-black text-[#1c053d]">
                                {score == null ? '—' : score}
                             </span>
                             <span className="text-lg font-bold text-[#6f627e]">/ 100</span>
                             {profile?.override_score != null ? (
                                <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-black uppercase text-purple-700">
                                   manual override
                                </span>
                             ) : null}
                          </div>

                          {breakdown ? (
                             <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {(Object.keys(SIGNAL_LABEL) as SignalKey[]).map((k) => {
                                   const node = breakdown[k];
                                   if (!node) return null;
                                   return (
                                      <div
                                         key={k}
                                         className="rounded-xl bg-[#fbf8ff] p-2 text-center"
                                         title={SIGNAL_LABEL[k]}
                                      >
                                         <div className="text-xs font-black uppercase text-[#6f627e]">
                                            {k}
                                         </div>
                                         <div className="text-lg font-black">{node.score}</div>
                                      </div>
                                   );
                                })}
                             </div>
                          ) : null}

                          <div className="mt-4 rounded-2xl bg-[#fbf8ff] p-5">
                             <p className="text-sm font-black uppercase text-[#6f627e]">Risk factors</p>
                             {factorList.length ? (
                                <ul className="mt-2 space-y-1 text-lg font-bold text-[#1c053d]">
                                   {factorList.map((f, i) => (
                                      <li key={i}>• {f}</li>
                                   ))}
                                </ul>
                             ) : (
                                <strong className="mt-2 block text-2xl">
                                   {profile?.algorithm_note ?? 'No factors fired yet — recompute to get a fresh score.'}
                                </strong>
                             )}
                          </div>

                          <label className="mt-5 grid gap-2 text-sm font-black uppercase tracking-wide text-[#6f627e]">
                             Review note
                             <textarea
                                value={notes[user.username ?? ''] ?? ''}
                                onChange={(e) =>
                                   setNotes((current) => ({
                                      ...current,
                                      [user.username ?? '']: e.target.value
                                   }))
                                }
                                placeholder="Add a manual override reason or context"
                                className="min-h-28 rounded-2xl border border-[#ded0ef] p-4 text-lg font-bold normal-case tracking-normal text-[#1c053d]"
                             />
                          </label>

                          {statusByUsername[user.username ?? ''] ? (
                             <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-lg font-black text-emerald-800">
                                {statusByUsername[user.username ?? '']}
                             </div>
                          ) : null}

                          <div className="mt-5 grid gap-3 sm:grid-cols-4">
                             <button
                                type="button"
                                onClick={() => recompute(user.id, user.username)}
                                disabled={busy === `recompute:${user.id}`}
                                className="rounded-2xl border border-[#1c053d] bg-white px-5 py-4 text-lg font-black text-[#1c053d] disabled:opacity-50"
                             >
                                {busy === `recompute:${user.id}` ? '…' : 'Recompute'}
                             </button>
                             <button
                                type="button"
                                onClick={() => saveReview(user)}
                                disabled={busy === `review:${user.id}`}
                                className="rounded-2xl bg-[#8336f0] px-5 py-4 text-lg font-black text-white disabled:opacity-50"
                             >
                                {busy === `review:${user.id}` ? 'Saving…' : 'Save risk review'}
                             </button>
                             <button
                                type="button"
                                onClick={() => toggleWatchlist(user)}
                                disabled={busy === `watch:${user.id}`}
                                className="rounded-2xl bg-amber-500 px-5 py-4 text-lg font-black text-white disabled:opacity-50"
                             >
                                {busy === `watch:${user.id}` ? '…' : 'Watchlist'}
                             </button>
                             <button
                                type="button"
                                onClick={() => onSwitchToNotifications?.(user.username ?? '')}
                                className="rounded-2xl bg-[#34234f] px-5 py-4 text-lg font-black text-white"
                             >
                                Notify
                             </button>
                          </div>
                       </article>
                    );
                 })
               : null}

            {adminDataLoaded && !directoryRows.length ? (
               <div className="rounded-3xl border border-[#eadff8] bg-white p-6 text-2xl font-black">
                  No users loaded for risk review.
               </div>
            ) : null}
         </div>
      </section>
   );
}
