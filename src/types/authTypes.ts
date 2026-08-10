export interface AuthState {
   user: User;
   username: string | null;
   isLoading: boolean;
   isAuthChecked: boolean;
   error: string | null;
   isWorldId?: WorldIdStatus;
   cs?: number;
   nal?: number;
   mal?: number;
   userProfiles: Record<string, User>; // Map of userId -> User profile for batch fetched users
}
export type UserRole = 'borrower' | 'lender';
export type AccountStatus = 'active' | 'blocked' | 'banned';
export type WalletProvider =
   | 'argent'
   | 'base_wallet'
   | 'metamask'
   | 'openfort'
   | 'phantom'
   | 'rainbow'
   | 'trust'
   | 'walletconnect'
   | 'unknown';

export interface User {
   id: string;
   username: string;
   email: string;
   /** Profile picture URL from auth provider metadata (Google, Telegram). Not stored in the DB users table. */
   avatarUrl?: string;
   /** Soft frame color used behind transparent/background-removed avatars. */
   avatarBackground?: string;
   /** User-facing name shown across profile surfaces. Falls back to username when unset. */
   displayName?: string;
   googleId?: string;
   walletAddress?: string;
   walletChainId?: number;
   walletConnectorName?: string;
   walletProvider?: WalletProvider;
   isWorldId: WorldIdStatus;
   nullifierHash?: string;
   /** World ID Passport/ID verification status. Independent of the Orb status above. */
   isWorldIdPassport?: WorldIdStatus;
   passportNullifierHash?: string;
   /** Identity verification status via Didit (KYC: ID + face match). Independent of World ID. */
   isDidit?: WorldIdStatus;
   /** Set when the user submits ID documents to Didit but before the webhook confirms ACTIVE. */
   diditSubmittedAt?: string;
   /** Raw Didit status string from the last ID-workflow webhook event (e.g. "In Review", "Declined"). Null once Approved. */
   diditIdStatus?: string;
   /** Human-readable reason extracted from Didit's decision when the last attempt was Declined. Null otherwise. */
   diditDeclineReason?: string;
   /** Hosted URL of the most recent Didit KYC session, so an unfinished session can be resumed. */
   diditSessionUrl?: string;
   /**
    * State of the most recent liveness pre-check (runs before both World ID and Didit ID steps).
    * A gate, not a final verified status. See {@link LivenessStatus}.
    */
   livenessStatus?: LivenessStatus;
   /** Didit session id of the most recent liveness attempt, used to resume after redirect. */
   livenessSessionId?: string;
   /**
    * State of the face scan that gates creating an embedded (Instant) wallet. Deliberately
    * separate from {@link livenessStatus}: that one gates KYC and is reset on every KYC
    * attempt, so sharing it would let one flow clobber the other. See {@link WalletFaceStatus}.
    */
   walletFaceStatus?: WalletFaceStatus;
   /** Didit session id of the most recent wallet face scan, used to resume after redirect. */
   walletFaceSessionId?: string;
   telegramUsername?: string;
   telegramId?: string;
   chatId?: string;
   mal: number;
   nal: number;
   cs: number;
   creditProgressionPaused?: boolean;
   accountStatus?: AccountStatus;
   /** Single source of truth for role-based routing, wallet connect options, and tab bar */
   userRole?: UserRole | null;
   incomeType?: string;
   paydayType?: string;
   paydayStart?: number | null;
   paydayEnd?: number | null;
   gapReasons?: string[];
   monthlyIncome?: string;
   monthlyExpenses?: string;
   otherIncome?: string;
   profession?: string;
   /** Free-text income explanation for the "Something else" work option. */
   incomeDescription?: string;
   /** Whether the user wants account activity notifications (loan approvals, World ID, etc.) */
   notifAccountActivity: boolean;
   /** Whether the user wants transaction notifications (funded, repayment, overdue, due) */
   notifTransactionActivity: boolean;
   /** Whether the user wants blog/news/weekly digest notifications */
   notifBlogs: boolean;
   createdAt: string;
   updatedAt: string;
}

export const WorldId = {
   INACTIVE: 'INACTIVE',
   ACTIVE: 'ACTIVE'
} as const;

export type WorldIdStatus = (typeof WorldId)[keyof typeof WorldId];

/** Lifecycle of a single liveness pre-check attempt, written by the didit-webhook. */
export type LivenessStatus = 'PENDING' | 'APPROVED' | 'DUPLICATE' | 'DECLINED';

/**
 * Lifecycle of the face scan that gates minting an embedded wallet. Written only by
 * didit-webhook / check-didit-status (service role) — a client-writable value would let
 * someone self-approve and mint a sponsored wallet without ever opening the camera.
 *
 *   PENDING   scan started, awaiting Didit's verdict
 *   APPROVED  clean scan — may mint
 *   DUPLICATE this face already holds another Moodeng account (one wallet per person)
 *   MISMATCH  a KYC'd borrower whose face didn't match their own KYC enrollment
 *   DECLINED  liveness itself failed (spoof, poor capture, abandoned)
 *   CONSUMED  approval already spent on a mint; cannot be replayed
 */
export type WalletFaceStatus = 'PENDING' | 'APPROVED' | 'DUPLICATE' | 'MISMATCH' | 'DECLINED' | 'CONSUMED';

export interface IUser {
   id: string;
   walletAddress?: string;
   username: string;
   isWorldId: WorldIdStatus;
   nullifierHash?: string;
   password?: string;
   email: string;
   googleId?: string;
   telegramUsername?: string;
   telegramId?: string;
   chatId?: string;
   mal: number; // max active loans
   nal: number; // number of active loans
   cs: number; // credit score
   creditProgressionPaused?: boolean;
   resetToken?: string;
   resetTokenExpiry?: Date;
   createdAt: Date;
   updatedAt: Date;
}
