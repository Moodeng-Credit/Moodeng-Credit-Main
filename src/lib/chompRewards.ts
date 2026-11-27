import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

// Shark Chomp rewards (2026-11-28, public.chomp_level_reward): every level cleared → +1 Pandesal point (max 3
// a day), and level 3+ while a Limit Spin waits for day 3 → +$1 "Shark bonus" on that spin. Signed out (or
// not an approved borrower) → nothing, and the game just plays.

// banked: no spin was waiting, so the +$1 is saved for their next spin.
export type LevelReward = { points: number; bonus: boolean; banked?: boolean };

export async function claimLevelReward(level: number): Promise<LevelReward | null> {
   if (!isSupabaseBrowserConfigured()) return null;
   try {
      const client = getSupabaseBrowserClient();
      if (!(await client.auth.getSession()).data.session) return null;
      const { data, error } = await client.rpc('chomp_level_reward', { p_level: level });
      if (error || !data || typeof data !== 'object') return null;
      const value = data as { points?: number; bonus?: boolean; banked?: boolean };
      const reward = { points: Number(value.points ?? 0) || 0, bonus: value.bonus === true, banked: value.banked === true };
      return reward.points > 0 || reward.bonus ? reward : null;
   } catch {
      return null;
   }
}
