import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { apiHandler } from '@/lib/apiHandler';
import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import { type AuthState, type User, WorldId } from '@/types/authTypes';

const defaultUser: User = {
   _id: '',
   username: '',
   email: '',
   walletAddress: '',
   isWorldId: WorldId.INACTIVE,
   telegramUsername: undefined,
   chatId: undefined,
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

export const loginUser = createAsyncThunk('auth/login', async ({ username, password }: { username: string; password: string }) => {
   await apiHandler.post(API_ENDPOINTS.AUTH.LOGIN, { username, password });
   const userData = await apiHandler.get(API_ENDPOINTS.AUTH.ME);

   return {
      username,
      user: userData
   };
});

export const registerUser = createAsyncThunk(
   'auth/register',
   async (userData: { username: string; walletAddress: string; isWorldId: string; password: string; email: string }) => {
      await apiHandler.post(API_ENDPOINTS.AUTH.REGISTER, userData);
      const userResponse = await apiHandler.get(API_ENDPOINTS.AUTH.ME);
      return {
         username: userData.username,
         user: userResponse
      };
   }
);

export const fetchUser = createAsyncThunk('auth/fetchUser', async () => {
   return await apiHandler.get(API_ENDPOINTS.AUTH.ME);
});

export const updateUser = createAsyncThunk(
   'auth/updateUser',
   async (userData: { username?: string; password?: string; email?: string; telegramUsername?: string }) => {
      return await apiHandler.post(API_ENDPOINTS.AUTH.UPDATE, userData);
   }
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
   await apiHandler.post(API_ENDPOINTS.AUTH.LOGOUT);
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
      setUsername: (state, action: PayloadAction<string>) => {
         state.username = action.payload;
      },
      clearAuth: (state) => {
         state.user = defaultUser;
         state.username = null;
         state.error = null;
         clearAuthCookieClient();
      }
   },
   extraReducers: (builder) => {
      builder
         // Login
         .addCase(loginUser.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(loginUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.username = action.payload.username;
            state.user = action.payload.user;
         })
         .addCase(loginUser.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
         })
         // Register
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
            state.error = action.payload as string;
         })
         // Fetch user
         .addCase(fetchUser.pending, (state) => {
            state.isLoading = true;
         })
         .addCase(fetchUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.user = action.payload;
            state.username = action.payload.username;
         })
         .addCase(fetchUser.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
         })
         // Update user
         .addCase(updateUser.fulfilled, (state, action) => {
            state.user = action.payload;
            if (action.payload.username) {
               state.username = action.payload.username;
            }
         })
         // Logout
         .addCase(logoutUser.fulfilled, (state) => {
            state.user = defaultUser;
            state.username = null;
            state.error = null;
         });
   }
});

export const { clearError, setUsername, clearAuth } = authSlice.actions;

export const getUserProfile = createAsyncThunk('auth/getUserProfile', async (username: string) => {
   return await apiHandler.post(API_ENDPOINTS.AUTH.PROFILE, { username });
});

export const me = fetchUser;
export const login = loginUser;
export const register = registerUser;
export const logout = logoutUser;
export const profile = getUserProfile;
export const clear = clearAuth;

export default authSlice.reducer;
