// Ranks joined lenders against an incoming loan request and formats the private
// team-channel message (used by loan-request-lender-suggestions). Pure functions
// only — no Supabase/Telegram calls — so the scoring can be unit-tested and the
// edge function stays a thin data-loading shell.

export type LenderRow = {
   id: string;
   username?: string | null;
   telegram_username?: string | null;
   line_id?: string | null;
   email?: string | null;
   chat_id?: number | string | null;
   created_at?: string | null;
};

export type LenderLoan = {
   lender_user_id?: string | null;
   borrower_user_id?: string | null;
   loan_amount?: number | string | null;
   funded_at?: string | null;
   loan_status?: string | null;
   repayment_status?: string | null;
};

export type ProspectRow = {
   id: string;
   name: string;
   handle?: string | null;
   note?: string | null;
};

export type LoanForMatch = {
   id: string;
   loan_amount?: number | string | null;
   coin?: string | null;
   reason?: string | null;
   borrower_user_id?: string | null;
};

export type RankedLender = {
   id: string;
   name: string;
   contact: string;
   score: number;
   tags: string[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NEW_LENDER_DAYS = 30;
const RECENT_ACTIVITY_DAYS = 30;
const OVER_EXTENDED_OPEN_LOANS = 3;

const toDate = (value?: string | null) => {
   if (!value) return null;
   const date = new Date(value);
   return Number.isNaN(date.getTime()) ? null : date;
};

const toAmount = (value: number | string | null | undefined) => {
   const amount = Number(value ?? 0);
   return Number.isFinite(amount) ? amount : 0;
};

const daysSince = (value?: string | null) => {
   const date = toDate(value);
   return date ? (Date.now() - date.getTime()) / MS_PER_DAY : null;
};

// Best reachable handle for the team to ping, in order of usefulness.
export const contactFor = (lender: LenderRow): string => {
   if (lender.telegram_username) return `@${String(lender.telegram_username).replace(/^@/, '')}`;
   if (lender.line_id) return `LINE: ${lender.line_id}`;
   if (lender.email) return lender.email;
   return 'no contact on file';
};

const displayName = (lender: LenderRow) => lender.username || contactFor(lender);

type LenderStats = {
   fundedCount: number;
   avgAmount: number;
   lastFundedDays: number | null;
   fundedThisBorrower: boolean;
   openOutstanding: number;
};

const statsFor = (lenderId: string, borrowerUserId: string | null | undefined, loans: LenderLoan[]): LenderStats => {
   const mine = loans.filter((loan) => loan.lender_user_id === lenderId);
   const funded = mine.filter((loan) => loan.loan_status === 'Lent' || Boolean(loan.funded_at));

   const amounts = funded.map((loan) => toAmount(loan.loan_amount)).filter((amount) => amount > 0);
   const avgAmount = amounts.length ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length : 0;

   const fundedDates = funded
      .map((loan) => daysSince(loan.funded_at))
      .filter((days): days is number => days !== null);
   const lastFundedDays = fundedDates.length ? Math.min(...fundedDates) : null;

   return {
      fundedCount: funded.length,
      avgAmount,
      lastFundedDays,
      fundedThisBorrower: Boolean(borrowerUserId) && funded.some((loan) => loan.borrower_user_id === borrowerUserId),
      openOutstanding: funded.filter((loan) => loan.loan_status === 'Lent' && loan.repayment_status !== 'Paid').length
   };
};

// Transparent, tunable scoring. Every point of score attaches a human-readable
// tag so the team can see *why* a lender surfaced.
const scoreLender = (lender: LenderRow, stats: LenderStats, requestAmount: number) => {
   let score = 0;
   const tags: string[] = [];

   const joinedDays = daysSince(lender.created_at);
   const isNew = joinedDays !== null && joinedDays <= NEW_LENDER_DAYS;
   const neverLent = stats.fundedCount === 0;

   if (neverLent && isNew) {
      score += 50;
      tags.push('🆕 new lender, no loans yet');
   } else if (neverLent) {
      score += 20;
      tags.push("🆕 hasn't lent yet");
   }

   if (stats.fundedThisBorrower) {
      score += 40;
      tags.push('🔁 funded this borrower before');
   }

   if (stats.fundedCount > 0) {
      const usual = `💵 usually lends ~$${stats.avgAmount.toFixed(0)}`;
      const withinRange =
         requestAmount > 0 && stats.avgAmount > 0 && Math.abs(stats.avgAmount - requestAmount) <= requestAmount * 0.5;
      if (withinRange) {
         score += 20;
         tags.push(`${usual} (good fit)`);
      } else {
         score += 5;
         tags.push(usual);
      }

      if (stats.lastFundedDays !== null && stats.lastFundedDays <= RECENT_ACTIVITY_DAYS) {
         score += 15;
         tags.push('⏱️ active recently');
      }

      if (stats.openOutstanding >= OVER_EXTENDED_OPEN_LOANS) {
         score -= 15;
         tags.push(`⏳ ${stats.openOutstanding} loans still out`);
      } else {
         score += 5;
      }
   }

   return { score, tags };
};

export const rankLenders = (
   loan: LoanForMatch,
   lenders: LenderRow[],
   loans: LenderLoan[],
   limit = 5
): RankedLender[] => {
   const requestAmount = toAmount(loan.loan_amount);

   return lenders
      .map((lender) => {
         const stats = statsFor(lender.id, loan.borrower_user_id, loans);
         const { score, tags } = scoreLender(lender, stats, requestAmount);
         return {
            id: lender.id,
            name: displayName(lender),
            contact: contactFor(lender),
            score,
            tags,
            _joined: toDate(lender.created_at)?.getTime() ?? 0
         };
      })
      .sort((a, b) => b.score - a.score || b._joined - a._joined || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map(({ _joined, ...rest }) => rest);
};

const formatAmount = (value: number | string | null | undefined) => toAmount(value).toFixed(2);

export const buildLenderSuggestionMessage = (
   loan: LoanForMatch,
   borrowerUsername: string | null | undefined,
   ranked: RankedLender[],
   prospects: ProspectRow[]
): string => {
   const lines: string[] = [];
   const coin = loan.coin || 'USDC';

   lines.push('💸 New loan request');
   lines.push(`$${formatAmount(loan.loan_amount)} ${coin}${loan.reason ? ` — "${loan.reason}"` : ''}`);
   lines.push(`Borrower: ${borrowerUsername ? `@${borrowerUsername}` : 'unknown'}`);
   lines.push('');

   if (ranked.length) {
      lines.push('👥 Suggested lenders to ping:');
      ranked.forEach((lender, index) => {
         const tags = lender.tags.length ? ` — ${lender.tags.join(' · ')}` : '';
         lines.push(`${index + 1}. ${lender.name} (${lender.contact})${tags}`);
      });
   } else {
      lines.push('👥 No joined lenders to suggest yet.');
   }

   const activeProspects = prospects.filter((prospect) => prospect.name?.trim());
   if (activeProspects.length) {
      lines.push('');
      lines.push('📇 Prospects to consider (not on the platform yet):');
      activeProspects.forEach((prospect) => {
         const bits = [prospect.handle?.trim(), prospect.note?.trim()].filter(Boolean).join(' · ');
         lines.push(`• ${prospect.name.trim()}${bits ? ` — ${bits}` : ''}`);
      });
   }

   lines.push('');
   lines.push('Reach out and nudge whoever fits — nobody is auto-assigned.');

   return lines.join('\n');
};
