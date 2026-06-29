import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { clearClientAuthState } from '@/lib/authSessionCleanup';
import { setLastUsedAuth } from '@/lib/lastUsedAuth';
import { recordSessionIp } from '@/lib/recordSessionIp';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import { type AccountStatus, type AuthState, type LivenessStatus, type User, type UserRole, type WalletProvider, WorldId } from '@/types/authTypes';

type UpdateUserPayload = {
   username?: string;
   displayName?: string;
   avatarUrl?: string | null;
   avatarBackground?: string | null;
   email?: string | null;
   password?: string;
   telegramUsername?: string | null;
   walletAddress?: string | null;
   walletChainId?: number | null;
   walletConnectorName?: string | null;
   walletProvider?: WalletProvider | null;
};

const supabaseClient = () => getSupabaseBrowserClient();
type SupabaseClientType = ReturnType<typeof supabaseClient>;
type UserRow = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type WorldIdStatus = Database['public']['Enums']['world_id_status'];
type TelegramAuthData = {
   id?: number | string;
   username?: string;
   allows_write_to_pm?: boolean | number | string;
};

const toOptionalString = (value: number | string | bigint | null | undefined): string | undefined => {
   if (value === null || value === undefined) return undefined;
   return value.toString();
};

const toOptionalNumber = (value: number | string | null | undefined): number | undefined => {
   if (value === null || value === undefined || value === '') return undefined;
   const numberValue = Number(value);
   return Number.isSafeInteger(numberValue) ? numberValue : undefined;
};

const allowsTelegramWrite = (value: TelegramAuthData['allows_write_to_pm']): boolean =>
   value === true || value === 1 || value === '1' || value === 'true';

const getTelegramProfileUpdates = (authData?: TelegramAuthData): Database['public']['Tables']['users']['Update'] => {
   const telegramId = toOptionalNumber(authData?.id);
   const updates: Database['public']['Tables']['users']['Update'] = {};

   if (telegramId !== undefined) {
      updates.telegram_id = telegramId;
      if (allowsTelegramWrite(authData?.allows_write_to_pm)) {
         updates.chat_id = telegramId;
      }
   }

   if (authData?.username) {
      updates.telegram_username = authData.username;
   }

   return updates;
};

const normalizeWorldIdStatus = (value?: string | WorldIdStatus | null): WorldIdStatus => (value as WorldIdStatus) ?? WorldId.INACTIVE;

const normalizeProfileText = (value: unknown): string | undefined => {
   if (typeof value !== 'string') return undefined;
   const trimmed = value.trim();
   return trimmed.length > 0 ? trimmed : undefined;
};

export const isObfuscatedExistingSignupUser = (user?: Pick<SupabaseAuthUser, 'identities'> | null): boolean =>
   Array.isArray(user?.identities) && user.identities.length === 0;

const EXISTING_ACCOUNT_MISMATCH_MESSAGE =
   'An account with this email already exists. Sign in instead, or reset your password if you need to regain access.';

/**
 * Handles a signup attempt against an email that already has an account.
 *
 * "Implicit login": if the password the user typed into the signup form is the
 * correct password for the existing account, we silently sign them in rather than
 * stranding them on an "account already exists" dead-end. If the password does not
 * match, we surface an actionable existing-account state (the signup form shows
 * Sign In / Reset Password links) — deliberately without firing a reset email, so
 * impatient users don't trip Supabase's reset rate limit.
 */
const resolveExistingAccount = async (supabase: SupabaseClientType, email: string, password: string) => {
   const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

   if (!signInError) {
      const user = await fetchCurrentUserProfile();
      return {
         isExistingUser: true as const,
         loggedIn: true as const,
         username: user.username,
         user
      };
   }

   return {
      isExistingUser: true as const,
      reason: 'existing' as const,
      message: EXISTING_ACCOUNT_MISMATCH_MESSAGE
   };
};

const deriveUsername = (authUser: SupabaseAuthUser, explicit?: string): string => {
   if (explicit) {
      return explicit;
   }

   const metadataUsername = authUser.user_metadata?.username;
   if (typeof metadataUsername === 'string' && metadataUsername.trim().length > 0) {
      return metadataUsername;
   }

   if (authUser.email) {
      const [local] = authUser.email.split('@');
      return `${local}-${authUser.id.slice(0, 6)}`;
   }

   return `user-${authUser.id.slice(0, 6)}`;
};

const ensureUserProfileRow = async (
   supabase: SupabaseClientType,
   authUser: SupabaseAuthUser,
   overrides?: { username?: string; email?: string; isWorldId?: string | WorldIdStatus }
): Promise<UserRow> => {
   const email = overrides?.email ?? authUser.email;

   if (!email) {
      throw new Error('Email is required to seed user profile');
   }

   // First, try to fetch existing profile
   const { data: existingProfile } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();

   // If profile exists, return it (don't update to avoid unique constraint violations)
   if (existingProfile) {
      return existingProfile;
   }

   // Profile doesn't exist, create new one
   const payload: UserInsert = {
      id: authUser.id,
      username: deriveUsername(authUser, overrides?.username),
      display_name: normalizeProfileText(authUser.user_metadata?.name) ?? null,
      email,
      is_world_id: normalizeWorldIdStatus(overrides?.isWorldId ?? authUser.user_metadata?.is_world_id),
      ...getTelegramProfileUpdates(authUser.user_metadata as TelegramAuthData | undefined)
   };

   const { data, error } = await supabase.from('users').insert(payload).select('*').single();

   if (error || !data) {
      throw error ?? new Error('Failed to ensure user profile');
   }

   return data;
};

const mapSupabaseRowToUser = (row: UserRow, avatarUrl?: string, displayName?: string, avatarBackground?: string): User => ({
   id: row.id,
   username: row.username,
   email: row.email,
   avatarUrl,
   avatarBackground,
   displayName: displayName ?? row.display_name ?? undefined,
   googleId: row.google_id ?? undefined,
   walletAddress: row.wallet_address ?? undefined,
   walletChainId: (row as UserRow & { wallet_chain_id?: number | null }).wallet_chain_id ?? undefined,
   walletConnectorName: (row as UserRow & { wallet_connector_name?: string | null }).wallet_connector_name ?? undefined,
   walletProvider: (row as UserRow & { wallet_provider?: WalletProvider | null }).wallet_provider ?? undefined,
   isWorldId: row.is_world_id,
   nullifierHash: row.nullifier_hash ?? undefined,
   isDidit: (row as UserRow & { is_didit?: WorldIdStatus | null }).is_didit ?? undefined,
   diditSubmittedAt: (row as UserRow & { didit_submitted_at?: string | null }).didit_submitted_at ?? undefined,
   diditIdStatus: (row as UserRow & { didit_id_status?: string | null }).didit_id_status ?? undefined,
   livenessStatus: (row as UserRow & { liveness_status?: LivenessStatus | null }).liveness_status ?? undefined,
   livenessSessionId: (row as UserRow & { liveness_session_id?: string | null }).liveness_session_id ?? undefined,
   telegramUsername: row.telegram_username ?? undefined,
   telegramId: toOptionalString(row.telegram_id),
   chatId: toOptionalString(row.chat_id),
   mal: row.mal,
   nal: row.nal,
   cs: row.cs,
   creditProgressionPaused: row.credit_progression_paused ?? false,
   accountStatus: (row as UserRow & { account_status?: AccountStatus | null }).account_status ?? 'active',
   userRole: row.user_role ?? undefined,
   incomeType: (row as UserRow & { income_type?: string | null }).income_type ?? undefined,
   paydayType: (row as UserRow & { payday_type?: string | null }).payday_type ?? undefined,
   paydayStart: (row as UserRow & { payday_start?: number | null }).payday_start ?? undefined,
   paydayEnd: (row as UserRow & { payday_end?: number | null }).payday_end ?? undefined,
   gapReasons: (row as UserRow & { gap_reasons?: string[] | null }).gap_reasons ?? undefined,
   monthlyIncome:   (row as any).monthly_income   ?? undefined,
   monthlyExpenses: (row as any).monthly_expenses ?? undefined,
   otherIncome:     (row as any).other_income     ?? undefined,
   profession:      (row as any).profession       ?? undefined,
   incomeDescription: (row as any).income_description ?? undefined,
   notifAccountActivity: (row as UserRow & { notif_account_activity?: boolean | null }).notif_account_activity ?? true,
   notifTransactionActivity: (row as UserRow & { notif_transaction_activity?: boolean | null }).notif_transaction_activity ?? true,
   notifBlogs: (row as UserRow & { notif_blogs?: boolean | null }).notif_blogs ?? false,
   createdAt: row.created_at,
   updatedAt: row.updated_at
});

const fetchCurrentUserProfile = async (): Promise<User> => {
   const supabase = supabaseClient();
   const {
      data: { user },
      error: sessionError
   } = await supabase.auth.getUser();

   if (sessionError || !user) {
      throw sessionError ?? new Error('Unable to resolve authenticated user');
   }

   // Fire-and-forget: log a salted hash of this session's IP for out-of-band
   // fraud detection (borrower & lender from the same place). Throttled, never blocks.
   recordSessionIp();

   const { data: profile, error: profileError } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();

   if (profileError) {
      throw profileError;
   }

   // avatar_url = manually uploaded photo (highest priority)
   // avatar_background = soft color shown behind transparent/background-removed avatars
   // picture    = Google OAuth profile photo
   // photo_url  = Telegram profile photo (written by edge function on sign-in)
   const avatarUrl = (user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? user.user_metadata?.photo_url) as string | undefined;
   const avatarBackground = user.user_metadata?.avatar_background as string | undefined;
   const displayName = normalizeProfileText(user.user_metadata?.name);

   if (!profile) {
      const ensuredProfile = await ensureUserProfileRow(supabase, user);
      return mapSupabaseRowToUser(ensuredProfile, avatarUrl, displayName, avatarBackground);
   }

   if (displayName && profile.display_name !== displayName) {
      const { data: syncedProfile, error: syncError } = await supabase
         .from('users')
         .update({ display_name: displayName })
         .eq('id', user.id)
         .select('*')
         .single();

      if (!syncError && syncedProfile) {
         return mapSupabaseRowToUser(syncedProfile, avatarUrl, displayName, avatarBackground);
      }
   }

   return mapSupabaseRowToUser(profile, avatarUrl, displayName, avatarBackground);
};

const fetchUserProfileByUsername = async (username: string): Promise<User> => {
   const supabase = supabaseClient();
   const { data: profile, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();

   if (error || !profile) {
      throw error ?? new Error('User profile not found');
   }

   return mapSupabaseRowToUser(profile);
};

/*
const fetchEmailByUsername = async (username: string): Promise<string> => {
   const supabase = supabaseClient();
   const { data, error } = await supabase.from('users').select('email').eq('username', username).maybeSingle();

   if (error || !data) {
      throw error ?? new Error('Email not found for username');
   }

   return data.email;
};
*/

const signInWithGoogleCredential = async (credential: string): Promise<User> => {
   const supabase = supabaseClient();
   const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential
   });

   if (error) {
      throw error;
   }

   return await fetchCurrentUserProfile();
};

const syncTelegramProfile = async (supabase: SupabaseClientType, userId: string, authData: TelegramAuthData): Promise<void> => {
   const updates = getTelegramProfileUpdates(authData);

   if (Object.keys(updates).length === 0) {
      return;
   }

   const { error } = await supabase.from('users').update(updates).eq('id', userId);
   if (error) throw error;
};

const completeTelegramAuth = async (telegramAuthData: string): Promise<User> => {
   const supabase = supabaseClient();
   const authData = JSON.parse(telegramAuthData) as TelegramAuthData;
   const { data, error } = await supabase.functions.invoke('telegram-login', {
      body: { authData }
   });

   if (error) throw error;
   if (data.error) throw new Error(data.error);

   const { error: sessionError } = await supabase.auth.setSession(data.session);
   if (sessionError) throw sessionError;

   const user = await fetchCurrentUserProfile();
   await syncTelegramProfile(supabase, user.id, authData);
   return await fetchCurrentUserProfile();
};

const defaultUser: User = {
   id: '',
   username: '',
   email: '',
   walletAddress: undefined,
   walletChainId: undefined,
   walletConnectorName: undefined,
   walletProvider: undefined,
   avatarBackground: undefined,
   isWorldId: WorldId.INACTIVE,
   googleId: undefined,
   telegramUsername: undefined,
   telegramId: undefined,
   chatId: undefined,
   nullifierHash: undefined,
   mal: 0,
   nal: 0,
   cs: 0,
   creditProgressionPaused: false,
   createdAt: '',
   updatedAt: ''
};

const initialState: AuthState = {
   user: defaultUser,
   username: null,
   isLoading: false,
   isAuthChecked: false,
   error: null,
   userProfiles: {}
};

export const loginUser = createAsyncThunk(
   'auth/login',
   async ({ email, password, rememberMe = true }: { email: string; password: string; rememberMe?: boolean }) => {
      const supabase = supabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
         email,
         password,
         options: { persistSession: rememberMe }
      });

      if (error) {
         if (error.code === 'email_not_confirmed') {
            // Auto-resend verification email
            const redirectUrl = getAuthRedirectUrl();
            const { error: resendError } = await supabase.auth.resend({
               type: 'signup',
               email,
               options: {
                  emailRedirectTo: redirectUrl
               }
            });

            const emailNotConfirmedError = new Error(
               resendError
                  ? 'Please verify your email before signing in. Check your inbox or request a new verification email.'
                  : 'Please verify your email before signing in. A verification email has been sent to your inbox.'
            );
            (emailNotConfirmedError as Error & { code: string }).code = 'email_not_confirmed';
            throw emailNotConfirmedError;
         }

         // For other errors, throw as-is
         throw error;
      }

      const user = await fetchCurrentUserProfile();
      setLastUsedAuth('email');
      return {
         username: user.username,
         user
      };
   }
);

export const loginWithGoogle = createAsyncThunk('auth/loginWithGoogle', async ({ googleCredential }: { googleCredential: string }) => {
   const user = await signInWithGoogleCredential(googleCredential);
   setLastUsedAuth('google');
   return {
      username: user.username,
      user
   };
});

export const loginWithTelegram = createAsyncThunk('auth/loginWithTelegram', async ({ telegramAuthData }: { telegramAuthData: string }) => {
   const user = await completeTelegramAuth(telegramAuthData);
   setLastUsedAuth('telegram');
   return {
      username: user.username,
      user
   };
});

export const registerUser = createAsyncThunk(
   'auth/register',
   async (userData: { username: string; isWorldId: string; password: string; email: string }) => {
      const supabase = supabaseClient();

      // Purge any stale session before signing up. Without this, a leftover session
      // from a previous login (e.g. the user never signed out) gets refreshed by the
      // global auth listener mid-signup and routes them back into the OLD account's
      // dashboard instead of the new email's onboarding flow.
      const {
         data: { session: staleSession }
      } = await supabase.auth.getSession();
      if (staleSession) {
         await supabase.auth.signOut();
         clearClientAuthState();
      }

      // Check if email already exists in our users table.
      // If it does, attempt an implicit login with the password they just typed.
      const { data: existingProfile } = await supabase.from('users').select('id').eq('email', userData.email).maybeSingle();

      if (existingProfile) {
         return resolveExistingAccount(supabase, userData.email, userData.password);
      }

      const redirectUrl = getAuthRedirectUrl();

      const { data, error } = await supabase.auth.signUp({
         email: userData.email,
         password: userData.password,
         options: {
            emailRedirectTo: redirectUrl,
            data: {
               username: userData.username,
               is_world_id: userData.isWorldId
            }
         }
      });

      // Handle actual signup errors (network issues, invalid data, etc.)
      if (error) {
         // If the user already exists, fall back to an implicit login with the typed password.
         if (error.message.toLowerCase().includes('already registered') || error.status === 422) {
            return resolveExistingAccount(supabase, userData.email, userData.password);
         }
         throw error;
      }

      if (isObfuscatedExistingSignupUser(data.user)) {
         return resolveExistingAccount(supabase, userData.email, userData.password);
      }

      const {
         data: { session }
      } = await supabase.auth.getSession();

      if (session?.user) {
         const user = await fetchCurrentUserProfile();
         return {
            username: user.username,
            user,
            isNewUser: true as const
         };
      }

      return {
         username: userData.username,
         isNewUser: true as const,
         needsEmailVerification: true as const
      };
   }
);

export const registerWithGoogle = createAsyncThunk(
   'auth/registerWithGoogle',
   async ({ googleCredential }: { googleCredential: string }) => {
      const user = await signInWithGoogleCredential(googleCredential);
      return {
         username: user.username,
         user
      };
   }
);

export const registerWithTelegram = createAsyncThunk(
   'auth/registerWithTelegram',
   async ({ telegramAuthData }: { telegramAuthData: string }) => {
      const user = await completeTelegramAuth(telegramAuthData);
      return {
         username: user.username,
         user
      };
   }
);

export const fetchUser = createAsyncThunk('auth/fetchUser', async () => fetchCurrentUserProfile());

export const getUserProfile = createAsyncThunk('auth/getUserProfile', async (username: string) => {
   const user = await fetchUserProfileByUsername(username);
   return { user };
});

// Batch fetch multiple user profiles by usernames in a single query
export const fetchUserProfiles = createAsyncThunk('auth/fetchUserProfiles', async (userIds: string[]) => {
   if (userIds.length === 0) return { users: [] };

   const supabase = supabaseClient();
   const uniqueUserIds = [...new Set(userIds)]; // Remove duplicates

   const { data: profiles, error } = await supabase.from('users').select('*').in('id', uniqueUserIds);

   if (error) {
      throw error;
   }

   return { users: (profiles || []).map((profile) => mapSupabaseRowToUser(profile)) };
});

export const updateUser = createAsyncThunk('auth/updateUser', async (userData: UpdateUserPayload) => {
   const supabase = supabaseClient();
   const {
      data: { user },
      error: sessionError
   } = await supabase.auth.getUser();

   if (sessionError || !user) {
      throw sessionError ?? new Error('No authenticated user to update');
   }

   if (
      userData.email ||
      userData.password ||
      userData.displayName !== undefined ||
      userData.avatarUrl !== undefined ||
      userData.avatarBackground !== undefined
   ) {
      const nextMetadata =
         userData.displayName !== undefined || userData.avatarUrl !== undefined || userData.avatarBackground !== undefined
            ? {
                 ...(user.user_metadata ?? {}),
                 ...(userData.displayName !== undefined ? { name: userData.displayName } : {}),
                 ...(userData.avatarUrl !== undefined ? { avatar_url: userData.avatarUrl } : {}),
                 ...(userData.avatarBackground !== undefined ? { avatar_background: userData.avatarBackground } : {})
              }
            : undefined;

      const { error } = await supabase.auth.updateUser({
         email: userData.email ?? undefined,
         password: userData.password ?? undefined,
         data: nextMetadata
      });

      if (error) {
         throw error;
      }
   }

   const updates: Database['public']['Tables']['users']['Update'] = {};
   if (userData.username) updates.username = userData.username;
   if (userData.displayName !== undefined) updates.display_name = userData.displayName;
   if (userData.email) updates.email = userData.email;
   if (userData.walletAddress !== undefined) updates.wallet_address = userData.walletAddress;
   if (userData.walletChainId !== undefined) updates.wallet_chain_id = userData.walletChainId;
   if (userData.walletConnectorName !== undefined) updates.wallet_connector_name = userData.walletConnectorName;
   if (userData.walletProvider !== undefined) updates.wallet_provider = userData.walletProvider;
   if (userData.walletAddress !== undefined || userData.walletProvider !== undefined || userData.walletConnectorName !== undefined) {
      updates.wallet_connected_at = userData.walletAddress === null ? null : new Date().toISOString();
   }
   if (userData.telegramUsername !== undefined) updates.telegram_username = userData.telegramUsername;

   if (Object.keys(updates).length === 0) {
      return await fetchCurrentUserProfile();
   }

   const { error: updateError } = await supabase.from('users').update(updates).eq('id', user.id);

   if (updateError) {
      const isWalletMetadataSchemaMismatch =
         updateError.code === '42703' &&
         (userData.walletProvider !== undefined || userData.walletConnectorName !== undefined || userData.walletChainId !== undefined);

      if (isWalletMetadataSchemaMismatch && userData.walletAddress) {
         const fallbackUpdates: Database['public']['Tables']['users']['Update'] = {
            wallet_address: userData.walletAddress
         };
         const { error: fallbackError } = await supabase.from('users').update(fallbackUpdates).eq('id', user.id);

         if (!fallbackError) {
            return await fetchCurrentUserProfile();
         }
      }

      throw updateError;
   }

   return await fetchCurrentUserProfile();
});

/**
 * Confirms a pending email-address change by verifying the one-time code sent to the
 * new address, then writes the new email to `public.users` only after Supabase Auth
 * has confirmed the change. This avoids the old behavior where `users.email` (and thus
 * notification routing) updated immediately, before the user ever proved they own the
 * new inbox.
 */
export const confirmEmailChange = createAsyncThunk(
   'auth/confirmEmailChange',
   async ({ email, token }: { email: string; token: string }) => {
      const supabase = supabaseClient();

      const { error: verifyError } = await supabase.auth.verifyOtp({
         email,
         token,
         type: 'email_change'
      });

      if (verifyError) {
         throw verifyError;
      }

      const {
         data: { user },
         error: sessionError
      } = await supabase.auth.getUser();

      if (sessionError || !user) {
         throw sessionError ?? new Error('No authenticated user to update');
      }

      const { error: updateError } = await supabase.from('users').update({ email }).eq('id', user.id);

      if (updateError) {
         throw updateError;
      }

      return await fetchCurrentUserProfile();
   }
);

export interface BorrowerContextPayload {
   incomeType: string;
   paydayType: string;
   paydayStart?: number | null;
   paydayEnd?: number | null;
   gapReasons?: string[];
   monthlyIncome?: string;
   monthlyExpenses?: string;
   otherIncome?: string;
   profession?: string;
   incomeDescription?: string;
}

/** Save borrower context (income/payday/gap info) to the user's profile. Done once after first loan request. */
export const updateBorrowerContext = createAsyncThunk(
   'auth/updateBorrowerContext',
   async (payload: BorrowerContextPayload) => {
      const supabase = supabaseClient();
      const {
         data: { user },
         error: sessionError
      } = await supabase.auth.getUser();

      if (sessionError || !user) throw sessionError ?? new Error('Not authenticated');

      const { data: updatedRow, error } = await supabase
         .from('users')
         .update({
            income_type:      payload.incomeType,
            payday_type:      payload.paydayType,
            payday_start:     payload.paydayStart ?? null,
            payday_end:       payload.paydayEnd ?? null,
            gap_reasons:      payload.gapReasons ?? [],
            monthly_income:   payload.monthlyIncome   ?? null,
            monthly_expenses: payload.monthlyExpenses ?? null,
            other_income:     payload.otherIncome     ?? null,
            profession:       payload.profession      ?? null,
            income_description: payload.incomeDescription ?? null
         } as Record<string, unknown>)
         .eq('id', user.id)
         .select('*')
         .single();

      if (error || !updatedRow) throw error ?? new Error('Failed to save borrower context');

      return mapSupabaseRowToUser(updatedRow);
   }
);

/** Set user_role in Supabase. Single source of truth for role-based routing. */
export const updateUserRole = createAsyncThunk('auth/updateUserRole', async (role: UserRole) => {
   const supabase = supabaseClient();
   const {
      data: { user },
      error: sessionError
   } = await supabase.auth.getUser();

   if (sessionError || !user) {
      throw sessionError ?? new Error('Not authenticated');
   }

   const { data: updatedRow, error } = await supabase.from('users').update({ user_role: role }).eq('id', user.id).select('*').single();

   if (error || !updatedRow) {
      throw error ?? new Error('Failed to update user role');
   }

   return mapSupabaseRowToUser(updatedRow);
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
   const supabase = supabaseClient();
   const { error } = await supabase.auth.signOut();

   if (error) {
      throw error;
   }

   clearAuthCookieClient();
   // Wipe persisted redux + per-user cache so the next login/signup starts on a
   // clean slate and never shows the previous account's data.
   clearClientAuthState();
   return null;
});

const authSlice = createSlice({
   name: 'auth',
   initialState,
   reducers: {
      clearError: (state) => {
         state.error = null;
      },
      setUsername: (state, action) => {
         state.username = action.payload;
      },
      clearAuth: (state) => {
         state.user = defaultUser;
         state.username = null;
         state.error = null;
         state.userProfiles = {};
      },
      setAuthChecked: (state) => {
         state.isAuthChecked = true;
      },
      setPreviewAuth: (state, action) => {
         const isFilled = action.payload === 'filled';
         const needsRoleSelection = action.payload === 'no-role';
         state.user = {
            ...defaultUser,
            id: 'preview-borrower',
            username: 'Cookiemonster1337',
            displayName: 'Cookiemonster1337',
            email: 'preview@moodeng.local',
            walletAddress: '0x71c...9d42',
            isWorldId: isFilled ? WorldId.ACTIVE : WorldId.INACTIVE,
            cs: isFilled ? 60 : 0,
            mal: isFilled ? 1 : 0,
            nal: isFilled ? 1 : 0,
            userRole: needsRoleSelection ? undefined : 'borrower',
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z'
         };
         state.username = state.user.username;
         state.isAuthChecked = true;
      }
   },
   extraReducers: (builder) => {
      builder
         .addCase(loginUser.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(loginUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.username = action.payload.username ?? null;
            state.user = action.payload.user;
         })
         .addCase(loginUser.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || null;
         })
         .addCase(loginWithGoogle.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(loginWithGoogle.fulfilled, (state, action) => {
            state.isLoading = false;
            state.username = action.payload.username ?? null;
            state.user = action.payload.user;
         })
         .addCase(loginWithGoogle.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || null;
         })
         .addCase(loginWithTelegram.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(loginWithTelegram.fulfilled, (state, action) => {
            state.isLoading = false;
            state.username = action.payload.username ?? null;
            state.user = action.payload.user;
         })
         .addCase(loginWithTelegram.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || null;
         })
         .addCase(registerUser.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(registerUser.fulfilled, (state, action) => {
            state.isLoading = false;
            const p = action.payload;
            // Implicit login (existing account, correct password) and brand-new
            // signups with an immediate session both carry a `user` — sign them in.
            if ('user' in p && p.user) {
               state.username = p.username ?? null;
               state.user = p.user;
               return;
            }
            // Existing account with a wrong/absent password — leave state untouched;
            // the signup form surfaces the actionable existing-account notice.
            if ('isExistingUser' in p && p.isExistingUser) {
               return;
            }
            if ('needsEmailVerification' in p && p.needsEmailVerification) {
               state.user = defaultUser;
               state.username = null;
            }
         })
         .addCase(registerUser.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || null;
         })
         .addCase(registerWithGoogle.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(registerWithGoogle.fulfilled, (state, action) => {
            state.isLoading = false;
            state.username = action.payload.username;
            state.user = action.payload.user;
         })
         .addCase(registerWithGoogle.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || null;
         })
         .addCase(registerWithTelegram.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(registerWithTelegram.fulfilled, (state, action) => {
            state.isLoading = false;
            state.username = action.payload.username;
            state.user = action.payload.user;
         })
         .addCase(registerWithTelegram.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || null;
         })
         .addCase(fetchUser.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(fetchUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.user = action.payload;
            state.username = action.payload.username;
         })
         .addCase(fetchUser.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || null;
         })
         .addCase(updateUser.fulfilled, (state, action) => {
            state.user = action.payload;
            state.username = action.payload.username;
         })
         .addCase(updateUser.rejected, (state, action) => {
            state.error = (action.error.message as string) || null;
         })
         .addCase(updateUserRole.fulfilled, (state, action) => {
            state.user = action.payload;
         })
         .addCase(updateUserRole.rejected, (state, action) => {
            state.error = (action.error.message as string) || null;
         })
         .addCase(updateBorrowerContext.fulfilled, (state, action) => {
            state.user = action.payload;
         })
         .addCase(fetchUserProfiles.fulfilled, (state, action) => {
            // Ensure userProfiles exists (for redux-persist rehydration compatibility)
            if (!state.userProfiles) {
               state.userProfiles = {};
            }
            // Store fetched user profiles in the userProfiles map
            for (const user of action.payload.users) {
               state.userProfiles[user.id] = user;
            }
         })
         .addCase(logoutUser.fulfilled, (state) => {
            state.user = defaultUser;
            state.username = null;
            state.error = null;
            state.userProfiles = {};
         })
         // Handle redux-persist rehydration
         .addMatcher(
            (action) => action.type === 'persist/REHYDRATE',
            (state) => {
               // Keep the last visible profile during session recovery so app navigation
               // does not flash back to the public state while Supabase confirms auth.
               // AuthInitializer still clears it when Supabase confirms there is no session.
               state.isAuthChecked = false;
            }
         );
   }
});

export const { clearError, setUsername, clearAuth, setAuthChecked, setPreviewAuth } = authSlice.actions;
export const me = fetchUser;
export const login = loginUser;
export const register = registerUser;
export const logout = logoutUser;
export const profile = getUserProfile;
export default authSlice.reducer;
