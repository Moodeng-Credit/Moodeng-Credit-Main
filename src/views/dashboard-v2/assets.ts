import type { MoodengMood, MoodengTierId } from '@/views/dashboard-v2/types';

/**
 * Raster art for the new borrower dashboard, exported from the Figma file
 * "New Dashboard for Borrowers" (file key pH4XxcQZ985EtDuwkLY6H1) into `public/dashboard-v2/`.
 * Vector pieces (tier track, arrows, tabbed cards, icons) are drawn in code — see DashboardV2Graphics.
 */
const BASE = '/dashboard-v2';

export const DASHBOARD_V2_ASSETS = {
   heroBackground: `${BASE}/hero-bg.webp`, // bg
   sampleAvatar: `${BASE}/avatar-sample.png`, // design's placeholder avatar (sample states only)
   viewAllChevron: `${BASE}/icon-chevron-blue.png`, // btn_all
   activeLoanChevron: `${BASE}/icon-chevron-purple.png`, // btn_active_loan
   pandesal: `${BASE}/pandesal.png`, // icon_pandesal
   coupon: `${BASE}/coupon.png`, // icon_coupon
   // Banners are exported whole (440px frame incl. 20px side margins, copy baked in).
   verifyBanner: `${BASE}/banner-verify.png`, // banner_1
   connectWalletBanner: `${BASE}/banner-connect-wallet.png`, // banner_2
   voucherBanner: `${BASE}/banner-voucher.png` // banner_3
} as const;

const MOOD_INDEX: Record<MoodengMood, number> = { waiting: 1, loan: 2, repaid: 3 };

/** Tiers whose three moods have been exported so far; the rest borrow Apex art until they land. */
const TIERS_WITH_ART: ReadonlySet<MoodengTierId> = new Set(['apex']);

/** {Tier}_{1|2|3} from the "slicing" frame — 164×164 including the ground shadow. */
export const getMoodengAsset = (tier: MoodengTierId, mood: MoodengMood) =>
   `${BASE}/moodeng-${TIERS_WITH_ART.has(tier) ? tier : 'apex'}-${MOOD_INDEX[mood]}.png`;
