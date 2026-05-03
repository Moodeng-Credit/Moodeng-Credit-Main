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

/**
 * On-chain liveness data for a single lender wallet, sourced from Alchemy.
 * Passed as walletData to calculateLenderDiversity for a stronger fraud
 * signal than Moodeng account age alone.
 */
export interface WalletLivenessData {
   /** Days since wallet's first ever on-chain transaction */
   ageInDays: number;
   /**
    * Approximate total asset transfers (from + to) across all checked chains.
    * Capped at ~400 — treat as a rough activity bucket.
    */
   transferCount: number;
   /** True when any chain/direction returned > 100 transfers */
   hasMoreThan100Transfers: boolean;
   /** Days since the wallet's most recent on-chain transfer (from today) */
   daysSinceLastTx: number;
   /** False when wallet has zero on-chain history */
   hasHistory: boolean;
}

export interface LenderGravityDetail {
   lenderId: string;
   name: string;
   /** Raw gravity score — higher = more suspicious */
   gravity: number;
   /**
    * Combined age + activity + dormancy amplifier.
    * 1× = fully established live wallet (no amplification).
    * Up to 180× = brand-new or dormant wallet.
    */
   newnessFactor: number;
   /** Penalty for rapid consecutive loans < 7 days apart */
   burstFactor: number;
   /** Wallet age at the time of the lender's first loan to this borrower */
   accountAgeAtFirstLoanDays: number;
   /**
    * Combined wallet trust score (0–1) when liveness data is available.
    * ageTrust (40%) + activityTrust (30%) + dormancyTrust (30%).
    * undefined when only account age fallback was used.
    */
   walletTrustScore?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

function toMs(date: string | undefined | null): number {
   if (!date) return NaN;
   const ms = new Date(date).getTime();
   return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Sliding-window maximum: largest count of timestamps within any 30-day window.
 * Detects signup coordination — multiple lenders who all joined Moodeng at once.
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

/**
 * Computes a combined wallet trust score (0–1) from three signals.
 *
 * ── Components ────────────────────────────────────────────────────────────
 *
 *   ageTrustScore      (40%) = min(1, accountAgeAtFirstLoanDays / 180)
 *   activityTrustScore (30%) = min(1, sqrt(transferCount) / 10)
 *                              [sqrt gives diminishing returns; 100 txs = 1.0]
 *   dormancyTrustScore (30%) = exp(−daysSinceLastTx / 365)
 *                              [365-day decay; active last week ≈ 1.0]
 *
 * ── Why three signals ────────────────────────────────────────────────────
 *
 *   Age alone misses the "patient attacker" who creates wallets early and
 *   sits on them.  A wallet that is 200 days old but has 2 transactions and
 *   has been dormant for 18 months is not a legitimate active wallet —
 *   it scores ~0.5 here vs 1.0 under the age-only model.
 *
 * ── newnessFactor from walletTrustScore ──────────────────────────────────
 *
 *   newnessFactor = max(1, 180 × (1 − walletTrustScore))
 *
 *   walletTrustScore 1.0 → newnessFactor  1× (established live wallet)
 *   walletTrustScore 0.5 → newnessFactor 90× (dormant / barely active)
 *   walletTrustScore 0.0 → newnessFactor 180× (brand new / no history)
 */
function computeWalletTrustScore(
   accountAgeAtFirstLoanDays: number,
   liveness: WalletLivenessData
): number {
   const ageTrustScore = Math.min(1, accountAgeAtFirstLoanDays / 180);

   // If wallet has no on-chain history, activity and dormancy both contribute 0
   if (!liveness.hasHistory) {
      return 0.4 * ageTrustScore;
   }

   const effectiveCount = liveness.hasMoreThan100Transfers ? 150 : liveness.transferCount;
   const activityTrustScore = Math.min(1, Math.sqrt(effectiveCount) / 10);
   const dormancyTrustScore = Math.exp(-liveness.daysSinceLastTx / 365);

   return 0.4 * ageTrustScore + 0.3 * activityTrustScore + 0.3 * dormancyTrustScore;
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
 * disappear.  Borrowers must have World ID (biometric), but lenders do not —
 * so fake LENDER accounts are the attack vector.
 *
 * ── Per-lender gravity ────────────────────────────────────────────────────
 *
 *   amountShare    = totalAmountFromL / totalAmount
 *
 *   newnessFactor  = max(1, 180 × (1 − walletTrustScore))       [if liveness data]
 *                  = max(1, 180 / accountAgeAtFirstLoanDays)     [fallback: age only]
 *
 *   recencyDecay   = Σ exp(−daysSinceLoan / 60)   [60-day half-life]
 *   burstFactor    = 1 + rapidPairs / max(1, loansFromL − 1)
 *
 *   Gravity(L)     = amountShare² × newnessFactor × recencyDecay × burstFactor
 *
 * ── Portfolio-level adjustment ────────────────────────────────────────────
 *
 *   coordinationRate  = maxLendersInAny30DaySignupWindow / uniqueLenders
 *   coordinationBoost = 1 + coordinationRate²
 *   TotalGravity      = Σ Gravity(L) × coordinationBoost
 *
 * ── Score ─────────────────────────────────────────────────────────────────
 *
 *   TrustScore = max(0, min(100, round(100 − 20 × ln(1 + TotalGravity))))
 *
 * @param loans        Pre-filtered funded loans (loanStatus === 'Lent')
 * @param userProfiles User profiles keyed by user ID
 * @param walletData   On-chain liveness data keyed by lender user ID.
 *                     Supply via getWalletAgeInfo() from walletAge.ts.
 *                     Falls back to userProfiles createdAt when absent.
 */
export const calculateLenderDiversity = (
   loans: Loan[],
   userProfiles?: Record<string, User>,
   walletData?: Record<string, WalletLivenessData>
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
   const signupTimestampsMs: number[] = [];

   for (const [lenderId, lenderLoans] of byLender.entries()) {
      const profile = lenderId !== 'unknown' ? userProfiles?.[lenderId] : undefined;

      // Amount share squared (HHI-style concentration)
      const lenderAmount = lenderLoans.reduce((s, l) => s + (Number(l.loanAmount) || 0), 0);
      const amountShare = totalAmount > 0 ? lenderAmount / totalAmount : 1 / uniqueLendersCount;

      // Sort chronologically to find first loan and detect bursts
      const sorted = [...lenderLoans].sort(
         (a, b) => (toMs(a.fundedAt ?? a.createdAt) || 0) - (toMs(b.fundedAt ?? b.createdAt) || 0)
      );
      const firstLoanMs = toMs(sorted[0].fundedAt ?? sorted[0].createdAt);

      // ── Account age at first loan to this borrower ─────────────────────
      // Default 180 = "established" when we have no data, so unknown lenders
      // don't unfairly inflate or deflate the score.
      let accountAgeAtFirstLoanDays = 180;

      if (!isNaN(firstLoanMs)) {
         if (walletData && lenderId in walletData) {
            const walletFirstTxMs = now - walletData[lenderId].ageInDays * MS_PER_DAY;
            accountAgeAtFirstLoanDays = Math.max(0, (firstLoanMs - walletFirstTxMs) / MS_PER_DAY);
         } else if (profile?.createdAt) {
            const lenderCreatedMs = toMs(profile.createdAt);
            if (!isNaN(lenderCreatedMs)) {
               accountAgeAtFirstLoanDays = Math.max(0, (firstLoanMs - lenderCreatedMs) / MS_PER_DAY);
            }
         }
      }

      const signupMs = profile?.createdAt ? toMs(profile.createdAt) : NaN;
      if (!isNaN(signupMs)) signupTimestampsMs.push(signupMs);

      // ── Newness factor ─────────────────────────────────────────────────
      //
      // With liveness data: uses walletTrustScore (age + activity + dormancy)
      //   newnessFactor = max(1, 180 × (1 − walletTrustScore))
      //   A perfectly established live wallet scores ~1×.
      //   An old dormant wallet (patient attacker) scores ~90×.
      //
      // Without liveness data: falls back to age-only signal.
      //   newnessFactor = max(1, 180 / accountAgeAtFirstLoanDays)
      let newnessFactor: number;
      let walletTrustScore: number | undefined;

      if (walletData && lenderId in walletData) {
         walletTrustScore = computeWalletTrustScore(accountAgeAtFirstLoanDays, walletData[lenderId]);
         newnessFactor = Math.max(1, 180 * (1 - walletTrustScore));
      } else {
         newnessFactor = Math.max(1, 180 / Math.max(1, accountAgeAtFirstLoanDays));
      }

      // ── Recency decay Σ exp(−daysSinceLoan / 60) ──────────────────────
      let recencyDecay = 0;
      for (const loan of lenderLoans) {
         const loanMs = toMs(loan.fundedAt ?? loan.createdAt);
         const daysSince = isNaN(loanMs) ? 0 : Math.max(0, (now - loanMs) / MS_PER_DAY);
         recencyDecay += Math.exp(-daysSince / 60);
      }
      recencyDecay = Math.max(recencyDecay, 0.01);

      // ── Burst factor ───────────────────────────────────────────────────
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
         accountAgeAtFirstLoanDays,
         walletTrustScore
      });
   }

   // ── Coordination boost ───────────────────────────────────────────────────
   let coordinationBoost = 1;
   if (signupTimestampsMs.length > 1) {
      const maxInWindow = maxItemsIn30DayWindow(signupTimestampsMs);
      const coordinationRate = maxInWindow / uniqueLendersCount;
      coordinationBoost = 1 + coordinationRate ** 2;
   }

   const totalGravity = sumGravity * coordinationBoost;

   // ── Trust score (log-scale) ──────────────────────────────────────────────
   const score = Math.max(0, Math.min(100, Math.round(100 - 20 * Math.log(1 + totalGravity))));

   // ── Distribution (backward-compatible) ──────────────────────────────────
   const distribution = gravityDetails
      .map(({ lenderId, name }) => {
         const ll = byLender.get(lenderId)!;
         const percentValue = Math.round((ll.length / loans.length) * 100);
         return { name, count: ll.length, percent: `${percentValue}%`, percentValue };
      })
      .sort((a, b) => b.count - a.count);

   return { score, distribution, uniqueLenders: uniqueLendersCount, repeatLenders, gravityDetails, coordinationBoost, totalGravity };
};
