import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import { type AuthState, type User, WorldId } from '@/types/authTypes';

type UpdateUserPayload = {
   username?: string;
   email?: string | null;
   password?: string;
   telegramUsername?: string | null;
   walletAddress?: string;
};

const supabaseClient = () => getSupabaseBrowserClient();
type SupabaseClientType = ReturnType<typeof supabaseClient>;
type UserRow = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type WorldIdStatus = Database['public']['Enums']['world_id_status'];

const toOptionalBigInt = (value: number | null): bigint | undefined => (value === null || value === undefined ? undefined : BigInt(value));

const normalizeWorldIdStatus = (value?: string | WorldIdStatus | null): WorldIdStatus => (value as WorldIdStatus) ?? WorldId.INACTIVE;

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
      email,
      is_world_id: normalizeWorldIdStatus(overrides?.isWorldId ?? authUser.user_metadata?.is_world_id)
   };

   const { data, error } = await supabase.from('users').insert(payload).select('*').single();

   if (error || !data) {
      throw error ?? new Error('Failed to ensure user profile');
   }

   return data;
};

const mapSupabaseRowToUser = (row: UserRow): User => ({
   id: row.id,
   username: row.username,
   email: row.email,
   googleId: row.google_id ?? undefined,
   walletAddress: row.wallet_address ?? undefined,
   isWorldId: row.is_world_id,
   nullifierHash: row.nullifier_hash ?? undefined,
   telegramUsername: row.telegram_username ?? undefined,
   telegramId: toOptionalBigInt(row.telegram_id),
   chatId: toOptionalBigInt(row.chat_id),
   mal: row.mal,
   nal: row.nal,
   cs: row.cs,
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

   const { data: profile, error: profileError } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();

   if (profileError) {
      throw profileError;
   }

   if (!profile) {
      const ensuredProfile = await ensureUserProfileRow(supabase, user);
      return mapSupabaseRowToUser(ensuredProfile);
   }

   return mapSupabaseRowToUser(profile);
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

const defaultUser: User = {
   id: '',
   username: '',
   email: '',
   walletAddress: undefined,
   isWorldId: WorldId.INACTIVE,
   googleId: undefined,
   telegramUsername: undefined,
   telegramId: undefined,
   chatId: undefined,
   nullifierHash: undefined,
   mal: 0,
   nal: 0,
   cs: 0,
   createdAt: '',
   updatedAt: ''
};

const initialState: AuthState = {
   user: defaultUser,
   username: null,
   isLoading: false,
   error: null
};

export const loginUser = createAsyncThunk('auth/login', async ({ email, password }: { email: string; password: string }) => {
   const supabase = supabaseClient();
   const { error } = await supabase.auth.signInWithPassword({
      email,
      password
   });

   if (error) {
      if (error.code === 'email_not_confirmed') {
         // Auto-resend verification email
         const redirectUrl = import.meta.env.VITE_REDIRECT_URL || 'http://localhost:3000/auth/confirm';
         const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
               emailRedirectTo: redirectUrl
            }
         });

         if (resendError) {
            console.error('Failed to resend verification email:', resendError);
         }

         const emailNotConfirmedError = new Error(
            'Please verify your email before signing in. A verification email has been sent to your inbox.'
         );
         (emailNotConfirmedError as Error & { code: string }).code = 'email_not_confirmed';
         throw emailNotConfirmedError;
      }

      // For other errors, throw as-is
      throw error;
   }

   const user = await fetchCurrentUserProfile();
   return {
      username: user.username,
      user
   };
});

export const loginWithGoogle = createAsyncThunk('auth/loginWithGoogle', async ({ googleCredential }: { googleCredential: string }) => {
   const user = await signInWithGoogleCredential(googleCredential);
   return {
      username: user.username,
      user
   };
});

export const loginWithTelegram = createAsyncThunk('auth/loginWithTelegram', async ({ telegramAuthData }: { telegramAuthData: string }) => {
   const supabase = supabaseClient();
   const { data, error } = await supabase.functions.invoke('telegram-login', {
      body: { authData: JSON.parse(telegramAuthData) }
   });

   if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Set the session in the client
      const { error: sessionError } = await supabase.auth.setSession(data.session);
      if (sessionError) throw sessionError;

      const user = await fetchCurrentUserProfile();
      return {
         username: user.username,
         user
      };
});

export const registerUser = createAsyncThunk(
   'auth/register',
   async (userData: { username: string; isWorldId: string; password: string; email: string }) => {
      const supabase = supabaseClient();

      // Check if email already exists in our users table
      // If it does, it means they likely signed up with Google/Telegram already
      const { data: existingProfile } = await supabase.from('users').select('id').eq('email', userData.email).maybeSingle();

      if (existingProfile) {
         // Trigger password reset to allow them to "link" their email/password to the existing account
         const { error: resetError } = await supabase.auth.resetPasswordForEmail(userData.email, {
            redirectTo: `${window.location.origin}/reset-password`
         });

         if (resetError) throw resetError;

         return {
            isExistingUser: true,
            message:
               'An account with this email already exists (likely via Google). A password reset link has been sent to your email. Please use it to set a password and link your email login.'
         };
      }

      // Get the redirect URL from environment variables
      const redirectUrl = import.meta.env.VITE_REDIRECT_URL || 'http://localhost:3000/auth/confirm';

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
         // If user already exists (e.g. signed up with Google), trigger password reset to "link" accounts
         if (error.message.toLowerCase().includes('already registered') || error.status === 422) {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(userData.email, {
               redirectTo: `${window.location.origin}/reset-password`
            });

            if (resetError) throw resetError;

            return {
               isExistingUser: true,
               message:
                  'An account with this email already exists (likely via Google). A password reset link has been sent to your email. Please use it to set a password and link your email login.'
            };
         }
         throw error;
      }

      return {
         username: userData.username,
         user: data.user,
         isNewUser: true
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
      const supabase = supabaseClient();
      const { data, error } = await supabase.functions.invoke('telegram-login', {
         body: { authData: JSON.parse(telegramAuthData) }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Set the session in the client
      const { error: sessionError } = await supabase.auth.setSession(data.session);
      if (sessionError) throw sessionError;

      const user = await fetchCurrentUserProfile();
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

export const updateUser = createAsyncThunk('auth/updateUser', async (userData: UpdateUserPayload) => {
   const supabase = supabaseClient();
   const {
      data: { user },
      error: sessionError
   } = await supabase.auth.getUser();

   if (sessionError || !user) {
      throw sessionError ?? new Error('No authenticated user to update');
   }

   if (userData.email || userData.password) {
      const { error } = await supabase.auth.updateUser({
         email: userData.email ?? undefined,
         password: userData.password ?? undefined
      });

      if (error) {
         throw error;
      }
   }

   const updates: Database['public']['Tables']['users']['Update'] = {};
   if (userData.username) updates.username = userData.username;
   if (userData.email) updates.email = userData.email;
   if (userData.walletAddress) updates.wallet_address = userData.walletAddress;
   if (userData.telegramUsername !== undefined) updates.telegram_username = userData.telegramUsername;

   if (Object.keys(updates).length === 0) {
      return await fetchCurrentUserProfile();
   }

   const { data: updatedRow, error: updateError } = await supabase.from('users').update(updates).eq('id', user.id).select('*').single();

   if (updateError || !updatedRow) {
      throw updateError ?? new Error('Failed to update user profile');
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
            state.username = action.payload.username;
            state.user = action.payload.user;
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
         .addCase(logoutUser.fulfilled, (state) => {
            state.user = defaultUser;
            state.username = null;
            state.error = null;
         });
   }
});

export const { clearError, setUsername, clearAuth } = authSlice.actions;
export const me = fetchUser;
export const login = loginUser;
export const register = registerUser;
export const logout = logoutUser;
export const profile = getUserProfile;
export default authSlice.reducer;
