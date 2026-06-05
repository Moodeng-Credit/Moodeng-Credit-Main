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
export type WalletProvider = 'argent' | 'base_wallet' | 'metamask' | 'phantom' | 'rainbow' | 'trust' | 'walletconnect' | 'unknown';

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
