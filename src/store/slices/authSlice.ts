import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import { type User, WorldId } from '@/types/authTypes';

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
   mal: 0,
   nal: 0,
   cs: 0,
   createdAt: '',
   updatedAt: ''
};

interface AuthState {
   user: User;
   username: string | null;
}

const initialState: AuthState = {
   user: defaultUser,
   username: null
};

const authSlice = createSlice({
   name: 'auth',
   initialState,
   reducers: {
      setUser: (state, action: PayloadAction<User>) => {
         state.user = action.payload;
         state.username = action.payload.username;
      },
      setUsername: (state, action: PayloadAction<string>) => {
         state.username = action.payload;
      },
      clearAuth: (state) => {
         state.user = defaultUser;
         state.username = null;
         clearAuthCookieClient();
      }
   }
});

export const { setUser, setUsername, clearAuth } = authSlice.actions;

export default authSlice.reducer;
