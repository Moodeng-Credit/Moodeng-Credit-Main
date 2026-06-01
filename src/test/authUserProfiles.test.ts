import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import authReducer, { fetchUserProfiles } from '@/store/slices/authSlice';

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: vi.fn()
}));

const makeUserRow = (overrides: Record<string, unknown>) => ({
   id: 'user-1',
   username: 'borrower-one',
   email: 'borrower@example.com',
   display_name: null,
   google_id: null,
   wallet_address: null,
   wallet_chain_id: null,
   wallet_connector_name: null,
   wallet_provider: null,
   is_world_id: 'ACTIVE',
   nullifier_hash: null,
   telegram_username: null,
   telegram_id: null,
   chat_id: null,
   mal: 3,
   nal: 0,
   cs: 20,
   credit_progression_paused: false,
   account_status: 'active',
   user_role: 'borrower',
   created_at: '2026-06-01T00:00:00.000Z',
   updated_at: '2026-06-01T00:00:00.000Z',
   ...overrides
});

describe('fetchUserProfiles', () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it('maps Supabase rows without treating Array.map callback arguments as display names', async () => {
      const rows = [
         makeUserRow({ id: 'user-1', display_name: null }),
         makeUserRow({ id: 'user-2', username: 'borrower-two', display_name: 'Borrower Two' })
      ];
      const inMock = vi.fn().mockResolvedValue({ data: rows, error: null });
      const selectMock = vi.fn().mockReturnValue({ in: inMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      vi.mocked(getSupabaseBrowserClient).mockReturnValue({ from: fromMock } as ReturnType<typeof getSupabaseBrowserClient>);

      const store = configureStore({
         reducer: {
            auth: authReducer
         }
      });

      await store.dispatch(fetchUserProfiles(['user-1', 'user-2']));

      expect(store.getState().auth.userProfiles['user-1']?.displayName).toBeUndefined();
      expect(store.getState().auth.userProfiles['user-2']?.displayName).toBe('Borrower Two');
   });
});
