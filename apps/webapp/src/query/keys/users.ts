import { createQueryKeys } from '@lukemorales/query-key-factory';

const dummyUser = {
   id: 'user_12345',
   wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
   username: 'john_doe',
   email: 'john@example.com',
   google_id: null,
   telegram_id: 123456789,
   telegram_username: 'johndoe_telegram',
   chat_id: 987654321,
   is_world_id: 'verified', // or whatever enum your WorldIdStatus uses
   nullifier_hash: 'abc123nullifier',
   mal: 5, // max active loans
   nal: 2, // number active loans
   cs: 720, // credit score
   reset_token: null,
   reset_token_expiry: null,
   created_at: '2025-01-01T00:00:00.000Z',
   updated_at: '2025-01-02T00:00:00.000Z'
};

export const users = createQueryKeys('users', {
   all: null,
   detail: (userId: string) => ({
      queryKey: [userId],
      queryFn: () => dummyUser
   })
});
