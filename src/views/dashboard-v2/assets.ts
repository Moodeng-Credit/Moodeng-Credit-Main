import type { MoodengMood, MoodengTierId } from '@/views/dashboard-v2/types';

/**
 * Static art for the new borrower dashboard, exported from the Figma file
 * "New Dashboard for Borrowers" (file key pH4XxcQZ985EtDuwkLY6H1). Each entry notes its source node
 * so the files in `public/dashboard-v2/` can be re-exported when the design changes.
 */
const BASE = '/dashboard-v2';

export const DASHBOARD_V2_ASSETS = {
   heroBackground: `${BASE}/hero-bg.webp`, // 1:226 bg
   sheetTop: `${BASE}/sheet-top.svg`, // 1:227 Rectangle 849
   milestonesCard: `${BASE}/card-milestones.svg`, // 1:273 Rectangle 3467568 (400×300)
   loanSummaryCard: `${BASE}/card-loan-summary.svg`, // 1:276 Rectangle 3467571 (400×123)
   arrowLeft: `${BASE}/arrow-left.svg`, // 1:24 btn_right (mirrored)
   arrowRight: `${BASE}/arrow-right.svg`, // 1:26 btn_right
   help: `${BASE}/icon-help.svg`, // 1:87 btn_help
   home: `${BASE}/icon-home.svg`, // 1:89 btn_home
   close: `${BASE}/icon-close.svg`, // 1:82 btn_pop_close
   verified: `${BASE}/icon-verified.svg`, // 1:122 icon_verified
   info: `${BASE}/icon-info.svg`, // 1:38 btn_detail
   viewAllChevron: `${BASE}/icon-chevron-blue.png`, // 1:42 btn_all
   insightsChevron: `${BASE}/icon-chevron-gray.svg`, // 1:114 btn_insight
   activeLoanChevron: `${BASE}/icon-chevron-purple.png`, // 1:56 btn_active_loan
   repayments: `${BASE}/icon-repayments.svg`, // 1:44 icon_repayments
   pandesal: `${BASE}/pandesal.png`, // 1:93 icon_pandesal
   coupon: `${BASE}/coupon.png`, // 1:95 icon_coupon
   // Banners are exported whole (440px frame incl. 20px side margins, copy baked in).
   verifyBanner: `${BASE}/banner-verify.png`, // banner_1
   connectWalletBanner: `${BASE}/banner-connect-wallet.png`, // banner_2
   voucherBanner: `${BASE}/banner-voucher.png` // banner_3
} as const;

/** 1:1223–1:1226 process_bar_{tier} */
export const getTierTrackAsset = (tier: MoodengTierId) => `${BASE}/tier-track-${tier}.svg`;

const MOOD_INDEX: Record<MoodengMood, number> = { waiting: 1, loan: 2, repaid: 3 };

/** Tiers whose three moods have been exported so far; the rest borrow Apex art until they land. */
const TIERS_WITH_ART: ReadonlySet<MoodengTierId> = new Set(['apex']);

/** 1:1231–1:1242 {Tier}_{1|2|3} — 164×164 frames including the ground shadow. */
export const getMoodengAsset = (tier: MoodengTierId, mood: MoodengMood) =>
   `${BASE}/moodeng-${TIERS_WITH_ART.has(tier) ? tier : 'apex'}-${MOOD_INDEX[mood]}.png`;
