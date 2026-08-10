// How a face scan for embedded-wallet creation is judged. Shared by didit-webhook (push) and
// check-didit-status (pull) so the two can never disagree — a verdict that depends on whether
// a webhook happened to arrive is the worst kind of intermittent bug. Pure (no Deno APIs) so
// vitest covers it.
//
// ── READ THIS BEFORE REUSING hasDuplicateFace() FOR WALLETS ──────────────────────────────
//
// The wallet gate is the only flow where the scanning user is EXPECTED to already be in the
// 1:N index — they may well have enrolled at KYC. Every other caller (the KYC liveness
// pre-gate) runs on a user's FIRST scan, where any match really is somebody else.
// hasDuplicateFace() encodes that assumption:
//
//     if (score >= THRESHOLD && vendorStr !== currentUserId) return true;
//
// When Didit doesn't attach vendor_data to a match, vendorStr is undefined, `undefined !== U`
// is true, and the user's OWN enrollment is reported as a duplicate. Conservative and correct
// on a first scan. On a re-scan it hard-blocks a verified borrower out of the wallet they are
// entitled to, with "this face already has a wallet" and no retry.
//
// So this module is DEFINITIVE-ONLY: it refuses on an identified match to a different
// account, and treats an anonymous match as inconclusive — because in a re-scan the likeliest
// owner of an unattributed match is the user themselves.

export type WalletDecisionBlock = {
   status?: string;
   score?: number;
   warnings?: unknown;
   results?: unknown;
   matches?: unknown;
   detected_faces?: unknown;
   duplicated_faces?: unknown;
   duplicate_faces?: unknown;
} | null;

export type WalletDecision = {
   face_match?: WalletDecisionBlock;
   face_search?: WalletDecisionBlock;
   liveness?: WalletDecisionBlock;
   warnings?: unknown;
   status?: string;
};

/** Didit similarity scores are 0-100; treat >= 80% as a match. */
export const FACE_MATCH_THRESHOLD = 80;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readField = (obj: unknown, keys: string[]): unknown => {
   if (!obj || typeof obj !== 'object') return undefined;
   const record = obj as Record<string, unknown>;
   for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key];
   }
   return undefined;
};

/**
 * Every 1:N match in a decision, as { userId, score }.
 *
 * face_match contributes ONLY its duplicate-specific arrays: its `results`/`matches` hold the
 * 1:1 selfie-vs-document comparison, whose success is a high-score match with no vendor_data —
 * not an identity hit against another account.
 */
export const collectFaceSearchMatches = (decision: WalletDecision | null | undefined): { userId?: string; score: number }[] => {
   if (!decision) return [];
   const blocks: (WalletDecisionBlock | undefined)[] = [decision.face_search, decision.liveness];
   const entries: unknown[] = [];

   for (const block of blocks) {
      if (!block) continue;
      entries.push(
         ...asArray(block.results),
         ...asArray(block.matches),
         ...asArray(block.detected_faces),
         ...asArray(block.duplicated_faces),
         ...asArray(block.duplicate_faces)
      );
   }
   entries.push(...asArray(decision.face_match?.duplicated_faces), ...asArray(decision.face_match?.duplicate_faces));

   return entries.map((entry) => {
      const raw = Number(readField(entry, ['score', 'similarity', 'confidence']) ?? 0);
      const matchedVendor = readField(entry, ['vendor_data', 'external_user_id', 'user_id']);
      return {
         userId: typeof matchedVendor === 'string' ? matchedVendor : undefined,
         // Accept either a 0-1 or a 0-100 scale.
         score: raw > 0 && raw <= 1 ? raw * 100 : raw
      };
   });
};

/**
 * Distinct OTHER accounts whose enrolled face this scan matched above threshold.
 * Requires an IDENTIFIED vendor — see the module note on why an anonymous match can't count.
 */
export const collectDuplicateUserIds = (decision: WalletDecision | null | undefined, currentUserId: string): string[] => [
   ...new Set(
      collectFaceSearchMatches(decision)
         .filter((match) => match.score >= FACE_MATCH_THRESHOLD && match.userId && match.userId !== currentUserId)
         .map((match) => match.userId as string)
   )
];

/** True when the scan matched THIS account's own prior enrollment. */
export const matchesOwnEnrollment = (decision: WalletDecision | null | undefined, currentUserId: string): boolean =>
   collectFaceSearchMatches(decision).some((match) => match.userId === currentUserId && match.score >= FACE_MATCH_THRESHOLD);

export type WalletFaceVerdict = {
   status: 'APPROVED' | 'DUPLICATE' | 'DECLINED';
   duplicateUserIds: string[];
   /** Approved, but we could not confirm the enrolled face was this user's. Review-only. */
   unverifiedSelfMatch: boolean;
};

/**
 * Resolve a wallet face scan.
 *
 * On the borrower/KYC self-match: enforcing it automatically is not currently sound. Absence
 * of a self-match has three causes the payload cannot distinguish — a genuinely different
 * person, Didit not attaching vendor_data, or the enrollment not being searchable yet — and
 * two of those are innocent. Blocking would deny verified borrowers a wallet they're entitled
 * to, terminally and with no retry. So the ambiguous case is APPROVED and flagged via
 * `unverifiedSelfMatch` for review. Once a real decision payload confirms vendor_data is
 * populated, this is the single place to turn enforcement back on.
 */
export const resolveWalletFaceVerdict = ({
   decision,
   userId,
   status,
   hasPriorEnrollment
}: {
   decision: WalletDecision | null | undefined;
   userId: string;
   status: string;
   hasPriorEnrollment: boolean;
}): WalletFaceVerdict => {
   if (status === 'Abandoned' || status === 'Expired') {
      return { status: 'DECLINED', duplicateUserIds: [], unverifiedSelfMatch: false };
   }

   const duplicateUserIds = collectDuplicateUserIds(decision, userId);
   if (duplicateUserIds.length > 0) {
      return { status: 'DUPLICATE', duplicateUserIds, unverifiedSelfMatch: false };
   }

   if (status !== 'Approved') {
      return { status: 'DECLINED', duplicateUserIds: [], unverifiedSelfMatch: false };
   }

   return {
      status: 'APPROVED',
      duplicateUserIds: [],
      unverifiedSelfMatch: hasPriorEnrollment && !matchesOwnEnrollment(decision, userId)
   };
};
