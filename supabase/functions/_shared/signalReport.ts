// Weekly "what predicts repayment" report (George 2026-11-21). Rows come from public.loan_signal_rows()
// (migration 20261121090000): one per funded loan, with what we knew at funding and how it turned out.
// This groups them per signal and says which groups repay on time more or less often than average,
// with an honest warning while there are too few missed loans to tell. Sent by loan-weekly-digest.

export type SignalRow = {
   outcome: 'on_time' | 'just_after' | 'late' | 'unpaid' | 'not_due' | string;
   days_late: number | null;
   fast_repay: boolean | null;
   signals: Record<string, string> | null;
};

/** The signals, in the order the team reads them, with their names. */
export const SIGNAL_NAMES: Array<[key: string, name: string]> = [
   ['ai_chance', 'AI repay prediction'],
   ['prescreen', 'AI pre-screen'],
   ['income_doc', 'AI income doc'],
   ['video_call', 'Video call'],
   ['id_check', 'ID check'],
   ['referred', 'Referral'],
   ['past_record', 'Their record before'],
   ['referrer_record', 'Who referred them'],
   ['payday_fit', 'Payday vs due date'],
   ['loan_no', 'Loan number'],
   ['amount', 'Amount'],
   ['two_part', 'Payment plan'],
   ['signup_to_loan', 'Signup to loan'],
   ['request_time', 'When they asked'],
   ['due_day', 'Due day'],
   ['market', 'Country']
];

/** Below this many missed loans, differences are hints only. */
export const MISSES_TO_TRUST = 30;
/** A group needs this many finished loans before it gets a ▲/▼ mark. */
const MIN_GROUP = 5;
/** Points of on-time rate away from average that earn a mark. */
const MARK_GAP = 15;

const decided = (r: SignalRow) => r.outcome !== 'not_due';
const missed = (r: SignalRow) => r.outcome === 'just_after' || r.outcome === 'late' || r.outcome === 'unpaid';
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export type GroupStat = { label: string; finished: number; onTimePct: number; missed: number; unpaid: number; fast: number; mark: '▲' | '▼' | '' };

/** Per signal, its groups with finished loans: on-time rate, misses, unpaid, fast repays and a mark. Pure. */
export const signalStats = (rows: SignalRow[]) => {
   const done = rows.filter(decided);
   const overall = pct(done.filter((r) => r.outcome === 'on_time').length, done.length);
   const groups = SIGNAL_NAMES.map(([key, name]) => {
      const byLabel = new Map<string, SignalRow[]>();
      for (const r of done) {
         const label = r.signals?.[key];
         if (!label) continue;
         byLabel.set(label, [...(byLabel.get(label) ?? []), r]);
      }
      const stats: GroupStat[] = [...byLabel.entries()]
         .map(([label, list]) => {
            const onTimePct = pct(list.filter((r) => r.outcome === 'on_time').length, list.length);
            const mark: GroupStat['mark'] =
               list.length >= MIN_GROUP && onTimePct >= overall + MARK_GAP ? '▲' : list.length >= MIN_GROUP && onTimePct <= overall - MARK_GAP ? '▼' : '';
            return {
               label,
               finished: list.length,
               onTimePct,
               missed: list.filter(missed).length,
               unpaid: list.filter((r) => r.outcome === 'unpaid').length,
               fast: list.filter((r) => r.fast_repay).length,
               mark
            };
         })
         .sort((a, b) => b.finished - a.finished);
      return { key, name, stats };
   }).filter((g) => g.stats.length);
   return { overall, done: done.length, groups };
};

/**
 * How well the AI's "chance of repaying on time" matched reality: on finished loans that had one, the
 * average it predicted vs the share actually repaid on time. Null when no finished loan had one. Pure.
 */
export const aiCalibration = (rows: SignalRow[]) => {
   const withPct = rows.filter(decided).map((r) => ({ r, pct: Number(r.signals?.ai_chance_pct) })).filter((x) => Number.isFinite(x.pct) && x.pct > 0);
   if (!withPct.length) return null;
   const predicted = Math.round(withPct.reduce((a, x) => a + x.pct, 0) / withPct.length);
   const actual = pct(withPct.filter((x) => x.r.outcome === 'on_time').length, withPct.length);
   return { loans: withPct.length, predicted, actual };
};

/** The Telegram text. Pure. */
export const buildSignalReport = (rows: SignalRow[]): string => {
   const count = (o: string) => rows.filter((r) => r.outcome === o).length;
   const { overall, done, groups } = signalStats(rows);
   const misses = rows.filter(missed).length;
   const fast = rows.filter((r) => r.fast_repay).length;
   const lines = [
      '📊 What predicts repayment (weekly)',
      `${done} loans finished: ${count('on_time')} on time · ${count('just_after')} paid just after the due time · ${count('late')} late · ${count('unpaid')} unpaid. ${count('not_due')} still running.`,
      `On time overall: ${overall}%. Repaid within 48 h of funding: ${fast}.`,
      misses < MISSES_TO_TRUST
         ? `⚠️ Only ${misses} missed so far, so the differences below are hints, not proof. They get reliable around ${MISSES_TO_TRUST} misses.`
         : `✅ ${misses} missed loans, enough to start trusting the differences.`,
      `▲/▼ = a group with ${MIN_GROUP}+ finished loans that is ${MARK_GAP}+ points better/worse than ${overall}%.`
   ];
   const cal = aiCalibration(rows);
   lines.push(
      cal
         ? `🎯 AI prediction check: on ${cal.loans} finished loans the AI said ${cal.predicted}% on average; ${cal.actual}% actually repaid on time.`
         : '🎯 AI prediction check: no finished loan had an AI prediction yet.'
   );
   // A signal where every finished loan is in the same group can't show anything yet: one line for those.
   const comparable = groups.filter((g) => g.stats.length > 1);
   const notYet = groups.filter((g) => g.stats.length === 1);
   if (notYet.length) lines.push('', `Not comparable yet (every finished loan in one group): ${notYet.map((g) => `${g.name} (${g.stats[0].label})`).join(', ')}.`);
   for (const g of comparable) {
      lines.push('', `${g.name}`);
      for (const s of g.stats) {
         const extra = [s.missed ? `${s.missed} missed` : null, s.unpaid ? `${s.unpaid} unpaid` : null, s.fast ? `${s.fast} fast` : null].filter(Boolean).join(', ');
         lines.push(`${s.mark ? `${s.mark} ` : '• '}${s.label}: ${s.finished} · ${s.onTimePct}% on time${extra ? ` (${extra})` : ''}`);
      }
   }
   return lines.join('\n').slice(0, 3900);
};
