import type { DashboardMilestone } from '@/views/dashboard/dashboardHelpers';

export interface TrustPointReward {
   id: string;
   title: string;
   description: string;
   threshold: number;
}

export interface TrustPointRewardProgress extends TrustPointReward {
   status: 'unlocked' | 'next' | 'locked';
}

export const TRUST_POINT_REWARDS: TrustPointReward[] = [
   {
      id: 'silver-avatar-ring',
      title: 'Silver avatar ring',
      description: 'A clean profile ring around your avatar.',
      threshold: 50
   },
   {
      id: 'gold-avatar-ring',
      title: 'Gold avatar ring',
      description: 'A stronger profile ring for repeat borrowers.',
      threshold: 120
   },
   {
      id: 'trusted-profile-badge',
      title: 'Trusted profile badge',
      description: 'A visible badge on your borrower profile.',
      threshold: 250
   },
   {
      id: 'top-borrower-award',
      title: 'Top borrower award',
      description: 'A collectible profile award for long-term history.',
      threshold: 500
   }
];

export const getEarnedMilestonePoints = (milestones: DashboardMilestone[]) =>
   milestones
      .filter((milestone) => milestone.status === 'unlocked')
      .reduce((total, milestone) => total + (milestone.points ?? 0), 0);

export const getTrustPointRewardProgress = (pointsTotal: number, unlockedRewardIds?: readonly string[]) => {
   const normalizedPoints = Math.max(0, Math.floor(pointsTotal));
   const unlockedRewardIdSet = unlockedRewardIds ? new Set(unlockedRewardIds) : null;
   let nextRewardFound = false;

   const rewards = TRUST_POINT_REWARDS.map((reward): TrustPointRewardProgress => {
      const isUnlocked = unlockedRewardIdSet ? unlockedRewardIdSet.has(reward.id) : normalizedPoints >= reward.threshold;

      if (isUnlocked) {
         return { ...reward, status: 'unlocked' };
      }

      if (!nextRewardFound) {
         nextRewardFound = true;
         return { ...reward, status: 'next' };
      }

      return { ...reward, status: 'locked' };
   });

   const nextReward = rewards.find((reward) => reward.status === 'next') ?? null;
   const previousReward = [...rewards].reverse().find((reward) => reward.status === 'unlocked') ?? null;
   const progressCeiling = nextReward?.threshold ?? previousReward?.threshold ?? TRUST_POINT_REWARDS[0].threshold;
   const progressPercent = progressCeiling > 0 ? Math.min(100, Math.round((normalizedPoints / progressCeiling) * 100)) : 100;

   return {
      pointsTotal: normalizedPoints,
      nextReward,
      rewards,
      pointsToNext: nextReward ? Math.max(0, nextReward.threshold - normalizedPoints) : 0,
      progressPercent
   };
};

/**
 * Special collectibles are one-off, non-threshold rewards (e.g. commemorative gifts).
 * They are granted directly into `user_rewards` and never auto-unlock from Trust Points,
 * so they are kept out of the {@link TRUST_POINT_REWARDS} progression ladder.
 */
export interface SpecialCollectible {
   id: string;
   title: string;
   description: string;
   /** Public path to the collectible artwork. */
   image: string;
   /** Short label for why it was awarded, e.g. "First-time user". */
   occasion: string;
}

export const SPECIAL_COLLECTIBLES: SpecialCollectible[] = [
   {
      id: 'first-user-lucky-cat',
      title: 'Founding Lucky Cat',
      description: 'A lucky cat for being one of the first Moodeng borrowers.',
      image: '/rewards/lucky-neko.png',
      occasion: 'First-time user'
   }
];

export const getOwnedSpecialCollectibles = (unlockedRewardIds: readonly string[]): SpecialCollectible[] =>
   SPECIAL_COLLECTIBLES.filter((collectible) => unlockedRewardIds.includes(collectible.id));

export type AvatarRingRewardId = 'silver-avatar-ring' | 'gold-avatar-ring';

export const getAvatarRingRewardId = (unlockedRewardIds: readonly string[]): AvatarRingRewardId | null => {
   if (unlockedRewardIds.includes('gold-avatar-ring')) return 'gold-avatar-ring';
   if (unlockedRewardIds.includes('silver-avatar-ring')) return 'silver-avatar-ring';
   return null;
};
