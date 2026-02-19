import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

interface WagmiState {
   isConnected: boolean;
   address?: string;
   chainId?: number;
}

const initialState: WagmiState = {
   isConnected: false,
   address: undefined,
   chainId: undefined
};

const wagmiSlice = createSlice({
   name: 'wagmi',
   initialState,
   reducers: {
      setConnection: (
         state,
         action: PayloadAction<{
            isConnected: boolean;
            address?: string;
            chainId?: number;
         }>
      ) => {
         state.isConnected = action.payload.isConnected;
         state.address = action.payload.address;
         state.chainId = action.payload.chainId;
      },
      clearConnection: (state) => {
         state.isConnected = false;
         state.address = undefined;
         state.chainId = undefined;
      }
   }
});

export const { setConnection, clearConnection } = wagmiSlice.actions;
export default wagmiSlice.reducer;
