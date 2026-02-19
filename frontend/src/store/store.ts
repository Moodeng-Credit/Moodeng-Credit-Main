import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import authSlice from '@/store/slices/authSlice';
import loanSlice from '@/store/slices/loanSlice';
import transactionSlice from '@/store/slices/transactionSlice';
import wagmiSlice from '@/store/slices/wagmiSlice';

const persistConfig = {
   key: 'root',
   storage,
   whitelist: ['auth'] // Only persist auth slice
};

const rootReducer = combineReducers({
   auth: authSlice,
   loans: loanSlice,
   transactions: transactionSlice,
   wagmi: wagmiSlice
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
   reducer: persistedReducer,
   middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
         serializableCheck: {
            ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
         }
      }),
   devTools: import.meta.env.MODE !== 'production'
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
