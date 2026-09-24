import type { MoodengMood, MoodengTierId } from '@/views/dashboard-v2/types';

/**
 * Art for the new borrower dashboard, from the designer's "slicing" export of the Figma file
 * "New Dashboard for Borrowers" (file key pH4XxcQZ985EtDuwkLY6H1), kept in `public/dashboard-v2/`.
 * The curved sheet and tabbed card shapes are drawn in code — see DashboardV2Graphics.
 */
const BASE = '/dashboard-v2';

export const DASHBOARD_V2_ASSETS = {
   heroBackground: `${BASE}/hero-bg.png`, // bg
   sampleAvatar: `${BASE}/avatar-sample.png`, // design's placeholder avatar (sample states only)
   arrowLeft: `${BASE}/arrow-left.png`, // btn_right
   arrowRight: `${BASE}/arrow-right.png`, // btn_right-1
   help: `${BASE}/icon-help.png`, // btn_help
   home: `${BASE}/icon-home.png`, // btn_home
   close: `${BASE}/icon-close.png`, // btn_pop_close
   verified: `${BASE}/icon-verified.png`, // icon_verified
   info: `${BASE}/icon-info.png`, // btn_detail
   viewAllChevron: `${BASE}/icon-chevron-blue.png`, // btn_all
   insightsChevron: `${BASE}/icon-chevron-gray.png`, // btn_insight
   activeLoanChevron: `${BASE}/icon-chevron-purple.png`, // btn_active_loan
   repayments: `${BASE}/icon-repayments.png`, // icon_repayments
   pandesal: `${BASE}/pandesal.png`, // icon_pandesal
   coupon: `${BASE}/coupon.png`, // icon_coupon
   pandesalSmall: `${BASE}/pandesal-small.png`, // icon_s_pandesal
   pandesalLarge: `${BASE}/pandesal-large.png`, // icon_l_pandseal
   lock: `${BASE}/icon-lock.png`, // icon_lock
   shield: `${BASE}/icon-shield.png`, // icon_verify
   closeLarge: `${BASE}/icon-close-large.png`, // btn_close (popups)
   firstLoanTitle: `${BASE}/title-first-loan.png`, // title ("Post Your First Loan")
   emptyMoodeng: `${BASE}/empty-moodeng.png`, // pic_empty
   verifyHippo: `${BASE}/verify-hippo.png`, // hippo with ID card, cut from verify_popup (card bg #f8f1ff)
   // Invite ("FREE MEAL for both of you") — invite_1 export. The sample code is baked into invite-bg at 30,418.
   inviteBackground: `${BASE}/invite-bg.png`, // bg_2 (440×735)
   back: `${BASE}/icon-back.png`, // btn_back
   shareClose: `${BASE}/icon-share-close.png`, // btn_share_close
   shareNext: `${BASE}/icon-share-next.png`, // btn_next
   shareEmbed: `${BASE}/share-others.png`, // others
   shareWhatsapp: `${BASE}/share-whatsapp.png`,
   shareFacebook: `${BASE}/share-facebook.png`,
   shareX: `${BASE}/share-x.png`,
   shareEmail: `${BASE}/share-email.png`,
   shareReddit: `${BASE}/share-reddit.png`, // raddit
   // Banners are exported whole (440px frame incl. 20px side margins, copy baked in).
   verifyBanner: `${BASE}/banner-verify.png`, // banner_1
   connectWalletBanner: `${BASE}/banner-connect-wallet.png`, // banner_2
   voucherBanner: `${BASE}/banner-voucher.png`, // banner_3
   voucherBannerFood: `${BASE}/banner-voucher-food.png` // right side of banner_3 (no copy), for the English banner
} as const;

/** process_bar_{tier} — 440×28 track with the current tier's node highlighted. */
export const getTierTrackAsset = (tier: MoodengTierId) => `${BASE}/tier-track-${tier}.png`;

const MOOD_INDEX: Record<MoodengMood, number> = { waiting: 1, loan: 2, repaid: 3 };

/** {Tier}_{1|2|3} — 164×164 including the ground shadow. */
export const getMoodengAsset = (tier: MoodengTierId, mood: MoodengMood) => `${BASE}/moodeng-${tier}-${MOOD_INDEX[mood]}.png`;
