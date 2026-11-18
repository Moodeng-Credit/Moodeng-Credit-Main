// How long a loan was held before it was repaid, for the team cards, and whether it came before the
// loan's halfway day (then it earns no food voucher). From public.loan_reward_timing()
// (migration 20261118121000_voucher_halfway_rule). The team can count an early one with /unlockreward.

type SupabaseClient = any;

export type RewardTiming = {
   heldHours: number;
   termHours: number;
   rewardFrom: string | null;
   /** The borrower's zone: dates read as their day, the same one the app shows them. */
   zone: string;
   early: boolean;
   unlocked: boolean;
};

/** Null when it can't be read; never throws. */
export const loadRewardTiming = async (supabase: SupabaseClient, loanId: string | null | undefined): Promise<RewardTiming | null> => {
   if (!loanId) return null;
   try {
      const { data, error } = await supabase.rpc('loan_reward_timing', { p_loan_id: loanId });
      if (error || !data || typeof data !== 'object') return null;
      const value = data as Record<string, unknown>;
      return {
         heldHours: Number(value.heldHours ?? 0),
         termHours: Number(value.termHours ?? 0),
         rewardFrom: typeof value.rewardFrom === 'string' ? value.rewardFrom : null,
         zone: typeof value.zone === 'string' && value.zone ? value.zone : 'Asia/Manila',
         early: value.early === true,
         unlocked: value.unlocked === true
      };
   } catch {
      return null;
   }
};

/** "1d 16h", "5h", "12d". */
export const formatHeld = (hours: number) => {
   const total = Math.max(0, Math.round(hours));
   const days = Math.floor(total / 24);
   const rest = total % 24;
   if (!days) return `${rest}h`;
   return rest ? `${days}d ${rest}h` : `${days}d`;
};

/** "⏱ Held 1d 16h of 30d" */
export const heldLine = (timing: RewardTiming) => `⏱ Held ${formatHeld(timing.heldHours)} of ${formatHeld(timing.termHours)}`;

/** "Dec 1" in the borrower's zone, so it matches the date the app shows them. */
const shortDate = (iso: string, zone: string) => {
   try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: zone });
   } catch {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
   }
};

/** For the "Loan repaid" card: held time, and when it was early, that no voucher goes out + how to unlock. */
export const repaidTimingLines = (timing: RewardTiming | null, handle: string | null): string[] => {
   if (!timing) return [];
   if (!timing.early) return [heldLine(timing)];
   return [
      `${heldLine(timing)} · ⏩ paid early${timing.rewardFrom ? ` (rewards count from their ${shortDate(timing.rewardFrom, timing.zone)})` : ''}`,
      `No food voucher for this one. If they ask for it: /unlockreward ${handle ?? '@username'}`
   ];
};
