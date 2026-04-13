export interface AuthState {
   user: User;
   username: string | null;
   isLoading: boolean;
   error: string | null;
   isWorldId?: WorldIdStatus;
   cs?: number;
   nal?: number;
   mal?: number;
   userProfiles: Record<string, User>; // Map of userId -> User profile for batch fetched users
}
export type UserRole = 'borrower' | 'lender';

export interface User {
   id: string;
   username: string;
   email: string;
   /** Profile picture URL from auth provider metadata (Google, Telegram). Not stored in the DB users table. */
   avatarUrl?: string;
   googleId?: string;
   walletAddress?: string;
   isWorldId: WorldIdStatus;
   nullifierHash?: string;
   telegramUsername?: string;
   telegramId?: string;
   chatId?: string;
   mal: number;
   nal: number;
   cs: number;
   creditProgressionPaused?: boolean;
   /** Single source of truth for role-based routing, wallet connect options, and tab bar */
   userRole?: UserRole | null;
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
