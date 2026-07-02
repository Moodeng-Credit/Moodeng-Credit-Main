import { isUserVerified } from './isUserVerified';

import type { User } from '@/types/authTypes';

/**
 * Single source of truth for how verification status is presented across the
 * app (dashboard badge, request board header, CTA cards, /verify resume).
 *
 * Didit's raw session status lands in users.didit_id_status via the webhook;
 * didit_submitted_at records that a session was started. The distinct UI states:
 *
 * - verified:   World ID or Didit approved.
 * - review:     Didit flagged the session for human review ("In Review").
 * - processing: documents submitted, decision pending (no verdict yet).
 * - unfinished: the user started but never completed the Didit session
 *               ("Not Started" / "In Progress" / "Abandoned" / "Expired").
 *               They must continue or restart — nothing is being reviewed.
 * - declined:   terminal rejection; user may retry.
 * - duplicate:  face already registered on another account; blocked.
 * - unverified: never started.
 */
export type VerificationUiState =
   | 'verified'
   | 'review'
   | 'processing'
   | 'unfinished'
   | 'declined'
   | 'duplicate'
   | 'unverified';

type VerificationUser = Pick<User, 'isWorldId' | 'isDidit' | 'diditIdStatus' | 'diditSubmittedAt'>;

export function getVerificationUiState(user: VerificationUser | null | undefined): VerificationUiState {
   if (!user) return 'unverified';
   if (isUserVerified(user)) return 'verified';

   const raw = user.diditIdStatus?.toLowerCase() ?? '';
   if (raw === 'duplicate') return 'duplicate';
   if (raw.includes('review')) return 'review';
   if (raw === 'declined') return 'declined';
   if (raw === 'abandoned' || raw === 'expired' || raw === 'not started' || raw === 'in progress') return 'unfinished';
   if (user.diditSubmittedAt) return 'processing';
   return 'unverified';
}

/** Short badge/chip label per state. */
export const VERIFICATION_STATE_LABEL: Record<VerificationUiState, string> = {
   verified: 'Verified',
   review: 'In review',
   processing: 'Pending',
   unfinished: 'Unfinished',
   declined: 'Declined',
   duplicate: 'Blocked',
   unverified: 'Not Verified'
};

/** Inline link/CTA label per state, for surfaces that deep-link to /verify. */
export const VERIFICATION_STATE_CTA: Record<VerificationUiState, string> = {
   verified: 'Verified',
   review: 'View status',
   processing: 'View status',
   unfinished: 'Continue verification',
   declined: 'Try again',
   duplicate: 'View details',
   unverified: 'Verify Yourself'
};
