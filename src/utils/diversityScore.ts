import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

// ---------------------------------------------------------------------------
// Display helpers (unchanged public API)
// ---------------------------------------------------------------------------

export const getDiversityColor = (diversity: number): string => {
   if (diversity >= 80) return 'green';
   if (diversity >= 60) return 'blue';
   if (diversity >= 40) return 'yellow';
   if (diversity >= 20) return 'orange';
   return 'red';
};

export const getDiversityStatus = (diversity: number): string => {
   if (diversity >= 80) return 'Excellent';
   if (diversity >= 60) return 'Good';
   if (diversity >= 40) return 'Fair';
   if (diversity >= 20) return 'Low';
   if (diversity < 20) return 'Very Low';
   return 'Unknown';
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LenderGravityDetail {
   lenderId: string;
   name: string;
   /** Raw gravity score for this lender — higher means more suspicious */
   gravity: number;
   /**
    * Amplifier for fresh accounts: 1× for accounts ≥ 180 days old,
    * up to 180× for a brand-new account (1 day old).
    */
   newnessFactor: number;
   /** Penalty for rapid consecutive loans from the same lender (< 7 days apart) */
   burstFactor: number;
   /** How old the lender's wallet/account was at the time of their first loan here */
   accountAgeAtFirstLoanDays: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

/** Safe Date parse → Unix ms.  Returns NaN for bad/missing input. */
function toMs(date: string | undefined | null): number {
   if (!date) return NaN;
   const ms = new Date(date).getTime();
   return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Sliding-window maximum: find the largest number of items whose timestamps
 * all fall within any single 30-day rolling window.
 *
 * Used to detect signup coordination — multiple lenders who all created their
 * Moodeng accounts around the same time (suggesting they were recruited together).
 */
function maxItemsIn30DayWindow(timestampsMs: number[]): number {
   if (timestampsMs.length === 0) return 0;
   const sorted = [...timestampsMs].sort((a, b) => a - b);
   let max = 1;
   for (let i = 0; i < sorted.length; i++) {
      const windowEnd = sorted[i] + 30 * MS_PER_DAY;
      let count = 1;
      for (let j = i + 1; j < sorted.length && sorted[j] <= windowEnd; j++) {
         count++;
      }
      max = Math.max(max, count);
   }
   return max;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Gravity-model fraud detection score for a borrower's incoming lender base.
 *
 * ── Threat model ──────────────────────────────────────────────────────────
 * A borrower recruits friends to open lender accounts and send fake loans,
 * building artificial credit history.  They then take a large real loan and
 * disappear.  Borrowers must have World ID (biometric, hard to fake), but
 * lenders do not — so fake LENDER accounts are the attack vector.
 *
 * ── Algorithm (per lender L) ──────────────────────────────────────────────
 *
 *   amountShare    = totalAmountFromL / totalAmount
 *   newnessFactor  = max(1, 180 / max(1, accountAgeAtFirstLoanDays))
 *   recencyDecay   = Σ exp(−daysSinceLoan / 60)          [60-day half-life]
 *   burstFactor    = 1 + rapidPairs / max(1, loansFromL − 1)
 *
 *   Gravity(L)     = amountShare² × newnessFactor × recencyDecay × burstFactor
 *
 * ── Portfolio-level adjustment ────────────────────────────────────────────
 *
 *   coordinationRate  = maxLendersIn30DaySignupWindow / uniqueLenders
 *   coordinationBoost = 1 + coordinationRate²             [range: 1–2]
 *   TotalGravity      = Σ Gravity(L) × coordinationBoost
 *
 * ── Score ─────────────────────────────────────────────────────────────────
 *
 *   TrustScore = max(0, min(100, round(100 − 20 × ln(1 + TotalGravity))))
 *
 * Low score = suspicious pattern; High score = trustworthy diverse lender base.
 *
 * @param loans        Funded loans for this borrower (caller should pre-filter to loanStatus === 'Lent')
 * @param userProfiles User profiles keyed by user ID (for account age + display names)
 * @param walletAges   On-chain wallet ages in days from today, keyed by lender user ID.
 *                     Preferred over account age — supply via getWalletAgeInfo() from walletAge.ts.
 */
export const calculateLenderDiversity = (
   loans: Loan[],
   userProfiles?: Record<string, User>,
   walletAges?: Record<string, number>
): {
   score: number;
   distribution: Array<{ name: string; count: number; percent: string; percentValue: number }>;
   uniqueLenders: number;
   repeatLenders: number;
   gravityDetails?: LenderGravityDetail[];
   coordinationBoost?: number;
   totalGravity?: number;
} => {
   if (loans.length === 0) {
      return { score: 0, distribution: [], uniqueLenders: 0, repeatLenders: 0 };
   }

   const now = Date.now();
   const totalAmount = loans.reduce((sum, l) => sum + (Number(l.loanAmount) || 0), 0);

   // ── Group loans by lender ID ─────────────────────────────────────────────
   const byLender = new Map<string, Loan[]>();
   for (const loan of loans) {
      const id = loan.lenderUser || 'unknown';
      if (!byLender.has(id)) byLender.set(id, []);
      byLender.get(id)!.push(loan);
   }

   const uniqueLendersCount = byLender.size;
   const repeatLenders = [...byLender.values()].filter((ls) => ls.length > 1).length;

   // ── Per-lender gravity ───────────────────────────────────────────────────
   let sumGravity = 0;
   const gravityDetails: LenderGravityDetail[] = [];
   const signupTimestampsMs: number[] = []; // collected for coordination check

   for (const [lenderId, lenderLoans] of byLender.entries()) {
      const profile = lenderId !== 'unknown' ? userProfiles?.[lenderId] : undefined;

      // ── Amount share (HHI-style) ───────────────────────────────────────
      const lenderAmount = lenderLoans.reduce((s, l) => s + (Number(l.loanAmount) || 0), 0);
      const amountShare = totalAmount > 0 ? lenderAmount / totalAmount : 1 / uniqueLendersCount;

      // ── Sort this lender's loans chronologically ───────────────────────
      const sorted = [...lenderLoans].sort(
         (a, b) => (toMs(a.fundedAt ?? a.createdAt) || 0) - (toMs(b.fundedAt ?? b.createdAt) || 0)
      );
      const firstLoanMs = toMs(sorted[0].fundedAt ?? sorted[0].createdAt);

      // ── Account age at first loan ──────────────────────────────────────
      // Default to 180 (treated as "established") when no data is available
      // so we neither reward nor punish unknown lenders unfairly.
      let accountAgeAtFirstLoanDays = 180;

      if (!isNaN(firstLoanMs)) {
         if (walletAges && lenderId in walletAges) {
            // On-chain wallet age: most reliable — can't be faked at low cost.
            // walletAges[id] = days since first on-chain tx from today.
            const walletFirstTxMs = now - walletAges[lenderId] * MS_PER_DAY;
            accountAgeAtFirstLoanDays = Math.max(0, (firstLoanMs - walletFirstTxMs) / MS_PER_DAY);
         } else if (profile?.createdAt) {
            // Moodeng account age fallback: weaker signal but still useful.
            const lenderCreatedMs = toMs(profile.createdAt);
            if (!isNaN(lenderCreatedMs)) {
               accountAgeAtFirstLoanDays = Math.max(0, (firstLoanMs - lenderCreatedMs) / MS_PER_DAY);
            }
         }
      }

      // Collect for coordination analysis
      const signupMs = profile?.createdAt ? toMs(profile.createdAt) : NaN;
      if (!isNaN(signupMs)) signupTimestampsMs.push(signupMs);

      // ── Newness factor ─────────────────────────────────────────────────
      // Saturates to 1× at ≥ 180 days; peaks at 180× for a 1-day-old account.
      const newnessFactor = Math.max(1, 180 / Math.max(1, accountAgeAtFirstLoanDays));

      // ── Recency decay  Σ exp(−daysSinceLoan / 60) ─────────────────────
      // A loan 60 days ago contributes ~37% vs a fresh loan today.
      let recencyDecay = 0;
      for (const loan of lenderLoans) {
         const loanMs = toMs(loan.fundedAt ?? loan.createdAt);
         const daysSince = isNaN(loanMs) ? 0 : Math.max(0, (now - loanMs) / MS_PER_DAY);
         recencyDecay += Math.exp(-daysSince / 60);
      }
      recencyDecay = Math.max(recencyDecay, 0.01); // avoid degenerate zero

      // ── Burst factor ───────────────────────────────────────────────────
      // Count consecutive loan pairs with < 7 days gap.
      let rapidPairs = 0;
      for (let i = 1; i < sorted.length; i++) {
         const prev = toMs(sorted[i - 1].fundedAt ?? sorted[i - 1].createdAt);
         const curr = toMs(sorted[i].fundedAt ?? sorted[i].createdAt);
         if (!isNaN(prev) && !isNaN(curr) && (curr - prev) / MS_PER_DAY <= 7) {
            rapidPairs++;
         }
      }
      const burstFactor = 1 + rapidPairs / Math.max(1, lenderLoans.length - 1);

      // ── Gravity(L) ────────────────────────────────────────────────────
      const gravity = amountShare ** 2 * newnessFactor * recencyDecay * burstFactor;
      sumGravity += gravity;

      gravityDetails.push({
         lenderId,
         name: profile?.username ?? lenderId,
         gravity,
         newnessFactor,
         burstFactor,
         accountAgeAtFirstLoanDays
      });
   }

   // ── Coordination boost ───────────────────────────────────────────────────
   // If many lenders all joined Moodeng within the same 30-day window they may
   // have been recruited together.  coordinationRate ∈ (0, 1]; boost ∈ [1, 2].
   let coordinationBoost = 1;
   if (signupTimestampsMs.length > 1) {
      const maxInWindow = maxItemsIn30DayWindow(signupTimestampsMs);
      const coordinationRate = maxInWindow / uniqueLendersCount;
      coordinationBoost = 1 + coordinationRate ** 2;
   }

   const totalGravity = sumGravity * coordinationBoost;

   // ── Trust score (log-scale) ──────────────────────────────────────────────
   // TotalGravity ≈ 0.05  →  score ~99   (5 well-established diverse lenders)
   // TotalGravity ≈ 1     →  score ~86   (moderate concern)
   // TotalGravity ≈ 10    →  score ~53   (notable concentration / newness)
   // TotalGravity ≈ 100   →  score  ~7   (severe fraud signal)
   const score = Math.max(0, Math.min(100, Math.round(100 - 20 * Math.log(1 + totalGravity))));

   // ── Distribution (backward-compatible shape) ─────────────────────────────
   const distribution = gravityDetails
      .map(({ lenderId, name }) => {
         const lenderLoans = byLender.get(lenderId)!;
         const percentValue = Math.round((lenderLoans.length / loans.length) * 100);
         return {
            name,
            count: lenderLoans.length,
            percent: `${percentValue}%`,
            percentValue
         };
      })
      .sort((a, b) => b.count - a.count);

   return {
      score,
      distribution,
      uniqueLenders: uniqueLendersCount,
      repeatLenders,
      gravityDetails,
      coordinationBoost,
      totalGravity
   };
};
