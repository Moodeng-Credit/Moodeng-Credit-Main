import { describe, expect, it } from 'vitest';

import authReducer from '@/store/slices/authSlice';
import { type AuthState, WorldId } from '@/types/authTypes';

describe('auth persistence', () => {
   it('keeps the last visible profile while Supabase confirms the live session', () => {
      const staleState: AuthState = {
         user: {
            id: 'stale-user',
            username: 'stale',
            email: 'stale@example.com',
            walletAddress: '0xc00Faf87cfC411675edAc57CD6a46A1385b9C45D',
            walletProvider: 'unknown',
            isWorldId: WorldId.INACTIVE,
            mal: 3,
            nal: 0,
            cs: 20,
            userRole: 'borrower',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
         },
         username: 'stale',
         isLoading: false,
         isAuthChecked: true,
         error: null,
         userProfiles: {
            'stale-user': {
               id: 'stale-user',
               username: 'stale',
               email: 'stale@example.com',
               isWorldId: WorldId.INACTIVE,
               mal: 3,
               nal: 0,
               cs: 20,
               createdAt: '2026-01-01T00:00:00.000Z',
               updatedAt: '2026-01-01T00:00:00.000Z'
            }
         }
      };

      const state = authReducer(staleState, { type: 'persist/REHYDRATE' });

      expect(state.user.id).toBe('stale-user');
      expect(state.username).toBe('stale');
      expect(state.userProfiles['stale-user']?.username).toBe('stale');
      expect(state.isAuthChecked).toBe(false);
   });
});
