import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import authReducer, { fetchUserProfiles } from '@/store/slices/authSlice';

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: vi.fn()
}));

describe('auth user profiles', () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it('maps fetched borrower profiles without passing Array.map metadata as display names', async () => {
      const inMock = vi.fn().mockResolvedValue({
         data: [
            {
               id: 'borrower-1',
               username: 'borrower-one',
               email: 'borrower@example.com',
               display_name: null,
               avatar_url: 'https://example.com/avatar.png',
               avatar_background: '#f3eefb',
               is_world_id: 'ACTIVE',
               nullifier_hash: null,
               google_id: null,
               telegram_id: null,
               telegram_username: null,
               chat_id: null,
               mal: 3,
               nal: 0,
               cs: 20,
               credit_progression_paused: false,
               account_status: 'active',
               user_role: 'borrower',
               wallet_address: null,
               wallet_chain_id: null,
               wallet_connector_name: null,
               wallet_provider: null,
               created_at: '2026-06-01T00:00:00.000Z',
               updated_at: '2026-06-01T00:00:00.000Z'
            }
         ],
         error: null
      });
      const selectMock = vi.fn().mockReturnValue({ in: inMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      vi.mocked(getSupabaseBrowserClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof getSupabaseBrowserClient>);

      const store = configureStore({
         reducer: {
            auth: authReducer
         }
      });

      await store.dispatch(fetchUserProfiles(['borrower-1']));

      const profile = store.getState().auth.userProfiles['borrower-1'];
      expect(profile.username).toBe('borrower-one');
      expect(profile.displayName).toBeUndefined();
      expect(profile.avatarUrl).toBe('https://example.com/avatar.png');
      expect(profile.avatarBackground).toBe('#f3eefb');
      expect(Array.isArray(profile.displayName)).toBe(false);
   });
});
