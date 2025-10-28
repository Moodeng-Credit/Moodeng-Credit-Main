import type { Document } from 'mongoose';

export interface AuthState {
   user: User;
   username: string | null;
   isLoading: boolean;
   error: string | null;
   isWorldId?: WorldIdStatus;
   cs?: number;
   nal?: number;
   mal?: number;
}
export interface User {
   _id: string;
   username: string;
   email: string;
   googleId?: string;
   walletAddress?: string;
   isWorldId: WorldIdStatus;
   nullifierHash?: string;
   telegramUsername?: string;
   telegramId?: number;
   chatId?: number;
   mal: number;
   nal: number;
   cs: number;
   createdAt: string;
   updatedAt: string;
}

export const WorldId = {
   INACTIVE: 'INACTIVE',
   ACTIVE: 'ACTIVE'
} as const;

export type WorldIdStatus = (typeof WorldId)[keyof typeof WorldId];

export interface IUser extends Document {
   walletAddress?: string;
   username: string;
   isWorldId: WorldIdStatus;
   nullifierHash?: string;
   password?: string;
   email: string;
   googleId?: string;
   telegramUsername?: string;
   telegramId?: number;
   chatId?: number;
   mal: number; // max active loans
   nal: number; // number of active loans
   cs: number; // credit score
   createdAt: Date;
   updatedAt: Date;
}
