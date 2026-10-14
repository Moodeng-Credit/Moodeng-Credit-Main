// Marketing dashboard (admin → Growth → Marketing): how close we are to the month's lending goal, what we need
// each week to get there, what marketing costs per real borrower, and who to contact. Pure functions over loans,
// users and the spend log, so the page and tests agree. Dates are Manila calendar dates.
import { addDays, daysBetween, manilaDate } from '@/app/admin/creditLineModel';
import { getNextCreditTier } from '@/config/creditTiers';

export interface MarketingLoan {
   id: string;
   borrower_user_id: string;
   loan_status: string | null;
   created_at: string;
   funded_at: string | null;
   due_date: string | null;
   repaid_at: string | null;
   repayment_status: string | null;
   loan_amount: number;
   total_repayment_amount: number;
}

export interface MarketingUser {
   id: string;
   username: string | null;
   display_name: string | null;
   facebook_name: string | null;
   created_at: string;
   verified: boolean; // passed Didit or World ID
   messenger_verified_at: string | null;
   redeemed_referral_code_id: string | null;
   credit_limit: number | null;
   // Some real borrowers sit on test-flagged accounts; their non-test loans still count, but they stay out of
   // the signup funnel and outreach lists.
   is_test?: boolean;
   account_status?: string | null;
   loan_access_status?: string | null;
}

export interface MarketingSpendRow {
   id: number;
   spent_on: string;
   channel: 'poster' | 'referral' | 'ads' | 'other';
   amount_usd: number;
   referral_code_id: string | null;
   note: string | null;
}

export interface ReferralCodeRow {
   id: string;
   code: string;
   channel: 'person' | 'ambassador' | 'poster';
   label: string | null;
}

export interface MonthlyGoals {
   lent_usd: number;
   marketing_budget_usd: number;
   cac_target_usd: number;
}

const monthStart = (month: string) => `${month}-01`;
const monthEnd = (month: string) => {
   const [y, m] = month.split('-').map(Number);
   return addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
};
const inMonth = (date: string | null, month: string) => Boolean(date && date.slice(0, 7) === month);
const funded = (loans: MarketingLoan[]) =>
   loans.filter((l) => l.funded_at).sort((a, b) => (a.funded_at as string).localeCompare(b.funded_at as string));
const isRepaid = (l: MarketingLoan) => l.repayment_status === 'Paid';

// Loan number per borrower (1 = their first funded loan).
export function loanNumbers(loans: MarketingLoan[]): Map<string, number> {
   const counts = new Map<string, number>();
   const out = new Map<string, number>();
   for (const loan of funded(loans)) {
      const n = (counts.get(loan.borrower_user_id) ?? 0) + 1;
      counts.set(loan.borrower_user_id, n);
      out.set(loan.id, n);
   }
   return out;
}

export function goalProgress(loans: MarketingLoan[], month: string, target: number, today: string) {
   const start = monthStart(month);
   const end = monthEnd(month);
   const totalDays = daysBetween(start, end) + 1;
   const elapsed = Math.min(totalDays, Math.max(0, daysBetween(start, today) + 1));
   const daysLeft = totalDays - elapsed;
   const numbers = loanNumbers(loans);
   const monthLoans = funded(loans).filter((l) => inMonth(manilaDate(l.funded_at as string), month));
   const lent = monthLoans.reduce((s, l) => s + Number(l.loan_amount), 0);
   const repeatLoans = monthLoans.filter((l) => (numbers.get(l.id) ?? 1) > 1).length;
   const allFunded = funded(loans);
   const avgLoan = monthLoans.length
      ? lent / monthLoans.length
      : allFunded.length
        ? allFunded.reduce((s, l) => s + Number(l.loan_amount), 0) / allFunded.length
        : 20;
   // Repeat share from all history (more stable than one month).
   const repeatShareAll = allFunded.length ? allFunded.filter((l) => (numbers.get(l.id) ?? 1) > 1).length / allFunded.length : 0.5;
   const pacePerDay = elapsed > 0 ? lent / elapsed : 0;
   const remaining = Math.max(0, target - lent);
   const neededPerDay = daysLeft > 0 ? remaining / daysLeft : remaining;
   const projected = lent + pacePerDay * daysLeft;
   const loansNeeded = Math.ceil(remaining / Math.max(avgLoan, 1));
   const repeatNeeded = Math.round(loansNeeded * repeatShareAll);
   return {
      month,
      target,
      lent,
      pct: target > 0 ? lent / target : 0,
      loans: monthLoans.length,
      newBorrowers: monthLoans.length - repeatLoans,
      repeatLoans,
      avgLoan,
      totalDays,
      elapsed,
      daysLeft,
      pacePerDay,
      neededPerDay,
      projected,
      gap: Math.max(0, target - projected),
      remaining,
      loansNeeded,
      repeatNeeded,
      newNeeded: loansNeeded - repeatNeeded,
      repeatShare: repeatShareAll,
      onTrack: projected >= target
   };
}

// Cumulative lent by day vs the straight path to target and the current-pace projection (for the chart).
export function goalSeries(loans: MarketingLoan[], month: string, target: number, today: string) {
   const start = monthStart(month);
   const end = monthEnd(month);
   const totalDays = daysBetween(start, end) + 1;
   const byDay = new Map<string, number>();
   for (const l of funded(loans)) {
      const d = manilaDate(l.funded_at as string);
      if (inMonth(d, month)) byDay.set(d, (byDay.get(d) ?? 0) + Number(l.loan_amount));
   }
   const progress = goalProgress(loans, month, target, today);
   let cum = 0;
   return Array.from({ length: totalDays }, (_, i) => {
      const date = addDays(start, i);
      const past = date <= today;
      cum += byDay.get(date) ?? 0;
      return {
         day: i + 1,
         date,
         actual: past ? cum : null,
         target: Math.round((target * (i + 1)) / totalDays),
         projected: date >= today ? Math.round(progress.lent + progress.pacePerDay * daysBetween(today, date)) : null
      };
   });
}

// Monday-start weeks of the month: what was lent, and what each remaining week needs to reach the target.
export function weeklyPlan(loans: MarketingLoan[], month: string, target: number, today: string) {
   const start = monthStart(month);
   const end = monthEnd(month);
   const weeks: Array<{
      start: string;
      end: string;
      lent: number;
      loans: number;
      needed: number | null;
      status: 'done' | 'current' | 'upcoming';
   }> = [];
   let cursor = start;
   while (cursor <= end) {
      const dow = (new Date(`${cursor}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
      const weekEnd = addDays(cursor, 6 - dow) < end ? addDays(cursor, 6 - dow) : end;
      const weekLoans = funded(loans).filter((l) => {
         const d = manilaDate(l.funded_at as string);
         return d >= cursor && d <= weekEnd;
      });
      weeks.push({
         start: cursor,
         end: weekEnd,
         lent: weekLoans.reduce((s, l) => s + Number(l.loan_amount), 0),
         loans: weekLoans.length,
         needed: null,
         status: weekEnd < today ? 'done' : cursor <= today ? 'current' : 'upcoming'
      });
      cursor = addDays(weekEnd, 1);
   }
   // Spread what's still missing (from the start of the current week) over the remaining days.
   const open = weeks.filter((w) => w.status !== 'done');
   const lentBefore = weeks.filter((w) => w.status === 'done').reduce((s, w) => s + w.lent, 0);
   const remaining = Math.max(0, target - lentBefore);
   const openDays = open.reduce((s, w) => s + daysBetween(w.start, w.end) + 1, 0);
   for (const w of open) w.needed = openDays ? (remaining * (daysBetween(w.start, w.end) + 1)) / openDays : 0;
   return weeks;
}

export function funnel(users: MarketingUser[], loans: MarketingLoan[], from: string, to: string) {
   const cohort = users.filter((u) => {
      if (u.is_test) return false;
      const d = manilaDate(u.created_at);
      return d >= from && d <= to;
   });
   const requested = new Set(loans.map((l) => l.borrower_user_id));
   const fundedBorrowers = new Set(funded(loans).map((l) => l.borrower_user_id));
   const steps = [
      { label: 'Signed up', count: cohort.length },
      { label: 'ID verified', count: cohort.filter((u) => u.verified).length },
      { label: 'Facebook connected', count: cohort.filter((u) => u.messenger_verified_at).length },
      { label: 'Requested a loan', count: cohort.filter((u) => requested.has(u.id)).length },
      { label: 'Got a loan', count: cohort.filter((u) => fundedBorrowers.has(u.id)).length }
   ];
   return steps.map((s) => ({ ...s, pctOfSignups: steps[0].count ? s.count / steps[0].count : 0 }));
}

// Re-borrowing by loan number: of borrowers who repaid loan N, how many took loan N+1, and how much bigger it was.
export function retention(loans: MarketingLoan[]) {
   const byBorrower = new Map<string, MarketingLoan[]>();
   for (const l of funded(loans)) byBorrower.set(l.borrower_user_id, [...(byBorrower.get(l.borrower_user_id) ?? []), l]);
   const rows = new Map<
      number,
      { n: number; loans: number; amount: number; repaid: number; reborrowed: number; stepUp: number; stepCount: number }
   >();
   for (const list of byBorrower.values()) {
      list.forEach((loan, i) => {
         const n = Math.min(i + 1, 4); // 4 = "4th and later"
         const row = rows.get(n) ?? { n, loans: 0, amount: 0, repaid: 0, reborrowed: 0, stepUp: 0, stepCount: 0 };
         row.loans += 1;
         row.amount += Number(loan.loan_amount);
         if (isRepaid(loan)) {
            row.repaid += 1;
            const next = list[i + 1];
            if (next) {
               row.reborrowed += 1;
               row.stepUp += Number(next.loan_amount) - Number(loan.loan_amount);
               row.stepCount += 1;
            }
         }
         rows.set(n, row);
      });
   }
   return [...rows.values()]
      .sort((a, b) => a.n - b.n)
      .map((r) => ({
         loanNumber: r.n,
         loans: r.loans,
         avgAmount: r.loans ? r.amount / r.loans : 0,
         repaid: r.repaid,
         reborrowRate: r.repaid ? r.reborrowed / r.repaid : null,
         avgStepUp: r.stepCount ? r.stepUp / r.stepCount : null
      }));
}

// Interest earned per $ lent over loans funded in the window (principal-weighted, so a few tiny loans with
// high rates don't skew it).
export function averageYield(loans: MarketingLoan[], from: string) {
   const recent = funded(loans).filter((l) => manilaDate(l.funded_at as string) >= from && Number(l.loan_amount) > 0);
   const principal = recent.reduce((s, l) => s + Number(l.loan_amount), 0);
   if (!principal) return 0;
   return recent.reduce((s, l) => s + Number(l.total_repayment_amount) - Number(l.loan_amount), 0) / principal;
}

// Spend vs budget, and cost per new borrower (first loan funded this month) and per new borrower who repaid,
// split by channel: a borrower counts toward the channel of the referral code they redeemed, else organic.
export function cacReport(
   loans: MarketingLoan[],
   users: MarketingUser[],
   spend: MarketingSpendRow[],
   codes: ReferralCodeRow[],
   month: string,
   goals: MonthlyGoals
) {
   const numbers = loanNumbers(loans);
   const userById = new Map(users.map((u) => [u.id, u]));
   const codeById = new Map(codes.map((c) => [c.id, c]));
   const firstLoans = funded(loans).filter((l) => numbers.get(l.id) === 1 && inMonth(manilaDate(l.funded_at as string), month));
   const channelOf = (userId: string) => {
      const code = codeById.get(userById.get(userId)?.redeemed_referral_code_id ?? '');
      return code ? (code.channel === 'poster' ? 'poster' : 'referral') : 'organic';
   };
   const monthSpend = spend.filter((s) => inMonth(s.spent_on, month));
   const spent = monthSpend.reduce((s, r) => s + Number(r.amount_usd), 0);
   const channels = ['poster', 'referral', 'ads', 'other', 'organic'] as const;
   const byChannel = channels
      .map((channel) => {
         const newBorrowers = firstLoans.filter((l) => channelOf(l.borrower_user_id) === channel);
         const channelSpend = monthSpend.filter((s) => s.channel === channel).reduce((s, r) => s + Number(r.amount_usd), 0);
         const repaying = newBorrowers.filter(isRepaid).length;
         return {
            channel,
            spend: channelSpend,
            newBorrowers: newBorrowers.length,
            repaying,
            cacPerBorrower: newBorrowers.length && channelSpend > 0 ? channelSpend / newBorrowers.length : null,
            cacPerRepaying: repaying && channelSpend > 0 ? channelSpend / repaying : null
         };
      })
      .filter((row) => row.spend > 0 || row.newBorrowers > 0);
   const newBorrowers = firstLoans.length;
   const repaying = firstLoans.filter(isRepaid).length;
   return {
      budget: goals.marketing_budget_usd,
      spent,
      left: goals.marketing_budget_usd - spent,
      cacTarget: goals.cac_target_usd,
      newBorrowers,
      repaying,
      cacPerBorrower: newBorrowers && spent > 0 ? spent / newBorrowers : null,
      cacPerRepaying: repaying && spent > 0 ? spent / repaying : null,
      byChannel
   };
}

export interface UnitEconomicsInputs {
   yieldPerLoan: number; // borrower cost per ~30-day loan, e.g. 0.13
   reborrowAfterFirst: number;
   reborrowLater: number;
   amounts: number[]; // average amount by loan number (1st, 2nd, 3rd…)
   defaultFirst: number;
   defaultLater: number;
   costOfFundsMonthly: number;
   opsPerBorrower: number;
   cac: number;
   repayBonus: number;
}

// Profit per new borrower over 6 monthly loan cycles, after defaults, funding cost and acquisition.
export function unitEconomics(p: UnitEconomicsInputs) {
   let alive = 1;
   let cumulative = -(p.cac + p.opsPerBorrower);
   const series = [cumulative];
   let lent = 0;
   let profit = 0;
   for (let k = 0; k < 6; k++) {
      const amount = p.amounts[Math.min(k, p.amounts.length - 1)] ?? 0;
      const pd = k === 0 ? p.defaultFirst : p.defaultLater;
      const interest = alive * amount * p.yieldPerLoan * (1 - pd);
      const loss = alive * amount * pd;
      const funding = alive * amount * p.costOfFundsMonthly;
      const bonus = k === 0 ? (1 - pd) * p.repayBonus : 0;
      lent += alive * amount;
      profit += interest - loss - funding;
      cumulative += interest - loss - funding - bonus;
      series.push(cumulative);
      alive *= (1 - pd) * (k === 0 ? p.reborrowAfterFirst : p.reborrowLater);
   }
   const totalCac = p.cac + p.opsPerBorrower + (1 - p.defaultFirst) * p.repayBonus;
   const payback = series.findIndex((v, i) => i > 0 && v >= 0);
   return {
      lent,
      profitBeforeCac: profit,
      totalCac,
      ltvToCac: totalCac > 0 ? profit / totalCac : null,
      paybackMonth: payback > 0 ? payback : null,
      series
   };
}

// Who to contact today: just repaid with nothing open (can borrow again), ID-verified but never borrowed, due soon.
export function whoToContact(loans: MarketingLoan[], users: MarketingUser[], today: string) {
   const userById = new Map(users.map((u) => [u.id, u]));
   const list = funded(loans);
   const open = new Set(list.filter((l) => !isRepaid(l)).map((l) => l.borrower_user_id));
   const lastRepaid = new Map<string, string>();
   for (const l of list) if (isRepaid(l) && l.repaid_at) lastRepaid.set(l.borrower_user_id, manilaDate(l.repaid_at));
   const borrowed = new Set(list.map((l) => l.borrower_user_id));
   const requested = new Set(loans.map((l) => l.borrower_user_id));
   const canReborrow = [...lastRepaid.entries()]
      .filter(([id]) => !open.has(id) && userById.has(id))
      .map(([id, repaidOn]) => ({ user: userById.get(id) as MarketingUser, repaidOn, daysSince: daysBetween(repaidOn, today) }))
      .sort((a, b) => a.daysSince - b.daysSince);
   const verifiedNeverBorrowed = users
      .filter((u) => u.verified && !u.is_test && !borrowed.has(u.id))
      .map((u) => ({ user: u, signedUp: manilaDate(u.created_at), requested: requested.has(u.id) }))
      .sort((a, b) => b.signedUp.localeCompare(a.signedUp));
   const dueSoon = list
      .filter((l) => !isRepaid(l) && l.due_date)
      .map((l) => ({
         loan: l,
         user: userById.get(l.borrower_user_id) ?? null,
         due: manilaDate(l.due_date as string),
         daysToDue: daysBetween(today, manilaDate(l.due_date as string))
      }))
      .filter((r) => r.daysToDue >= 0 && r.daysToDue <= 2)
      .sort((a, b) => a.daysToDue - b.daysToDue);
   return { canReborrow, verifiedNeverBorrowed, dueSoon };
}

export interface GoalSlot {
   userId: string;
   name: string;
   username: string | null;
   amount: number;
}

// The month's lending goal, filled by name: loans already made this month, people who can take another loan
// before the month ends (and the limit they'd get), and how many new borrowers fill the rest.
export function goalSlots(
   loans: MarketingLoan[],
   users: MarketingUser[],
   excluded: Set<string>,
   month: string,
   today: string,
   target: number,
   cacTarget: number
) {
   const userById = new Map(users.map((u) => [u.id, u]));
   const nameOf = (id: string) => {
      const u = userById.get(id);
      return u?.display_name?.trim() || u?.username || 'Unknown';
   };
   const end = monthEnd(month);
   const list = funded(loans);

   const done = list
      .filter((l) => inMonth(manilaDate(l.funded_at as string), month))
      .map((l) => ({
         loanId: l.id,
         userId: l.borrower_user_id,
         name: nameOf(l.borrower_user_id),
         username: userById.get(l.borrower_user_id)?.username ?? null,
         amount: Number(l.loan_amount),
         date: manilaDate(l.funded_at as string)
      }));
   const lent = done.reduce((s, d) => s + d.amount, 0);

   // Only the current (or a future) month can still have comebacks.
   const comeback: Array<GoalSlot & { when: string | null }> = [];
   const leftOut: GoalSlot[] = [];
   if (today <= end) {
      const byBorrower = new Map<string, MarketingLoan[]>();
      for (const l of list) byBorrower.set(l.borrower_user_id, [...(byBorrower.get(l.borrower_user_id) ?? []), l]);
      for (const [userId, own] of byBorrower) {
         const u = userById.get(userId);
         if (!u || (u.account_status && u.account_status !== 'active') || (u.loan_access_status && u.loan_access_status !== 'approved'))
            continue;
         const open = own.filter((l) => !isRepaid(l));
         if (!open.length && !own.some(isRepaid)) continue;
         const dues = open.map((l) => (l.due_date ? manilaDate(l.due_date) : '9999-12-31'));
         if (dues.some((d) => d < today)) continue; // overdue: not a candidate
         const lastDue = dues.sort().pop() ?? null;
         if (lastDue && lastDue > end) continue; // not free again this month
         const limit = Number(u.credit_limit ?? 15);
         // A single loan at the full limit, repaid in full, moves them up a tier.
         const amount = open.some((l) => Number(l.loan_amount) >= limit) ? getNextCreditTier(limit) : limit;
         const slot = { userId, name: nameOf(userId), username: u.username, amount };
         if (excluded.has(userId)) leftOut.push(slot);
         else comeback.push({ ...slot, when: lastDue });
      }
      comeback.sort((a, b) => (a.when ?? '').localeCompare(b.when ?? '') || a.name.localeCompare(b.name));
   }
   const comebackSum = comeback.reduce((s, c) => s + c.amount, 0);

   // New borrowers' first loans: their recent average, else $16.
   const numbers = loanNumbers(loans);
   const recentFirsts = list.filter((l) => numbers.get(l.id) === 1 && manilaDate(l.funded_at as string) >= addDays(today, -60));
   const firstLoan = recentFirsts.length ? recentFirsts.reduce((s, l) => s + Number(l.loan_amount), 0) / recentFirsts.length : 16;

   const gap = Math.max(0, target - lent - comebackSum);
   const need = Math.ceil(gap / Math.max(firstLoan, 1));

   // Spread the new borrowers over the month's remaining Monday-start weeks by days left in each.
   const weeks: Array<{ start: string; end: string; count: number }> = [];
   let cursor = today > monthStart(month) ? today : monthStart(month);
   while (cursor <= end) {
      const dow = (new Date(`${cursor}T00:00:00Z`).getUTCDay() + 6) % 7;
      const weekEnd = addDays(cursor, 6 - dow) < end ? addDays(cursor, 6 - dow) : end;
      weeks.push({ start: cursor, end: weekEnd, count: 0 });
      cursor = addDays(weekEnd, 1);
   }
   const totalDays = weeks.reduce((s, w) => s + daysBetween(w.start, w.end) + 1, 0);
   let assigned = 0;
   weeks.forEach((w, i) => {
      const share =
         i === weeks.length - 1 ? need - assigned : Math.round((need * (daysBetween(w.start, w.end) + 1)) / Math.max(totalDays, 1));
      w.count = Math.max(0, Math.min(share, need - assigned));
      assigned += w.count;
   });

   return {
      target,
      done,
      lent,
      comeback,
      comebackSum,
      leftOut,
      firstLoan,
      gap,
      need,
      cost: need * cacTarget,
      posters: Math.ceil(need / 4),
      weeks
   };
}
