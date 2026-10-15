import { beforeEach, describe, expect, it, vi } from 'vitest';

// requestOtpCode / verifyOtpCode: the exact Supabase calls, and the profile row a phone-only
// account gets (public.users.email is NOT NULL, so a placeholder, never the number).
const h = vi.hoisted(() => ({
   authUser: null as null | Record<string, unknown>,
   inserts: [] as Record<string, unknown>[],
   signInWithOtp: vi.fn<(args: unknown) => Promise<{ error: null | { message: string } }>>(async () => ({ error: null })),
   verifyOtp: vi.fn<(args: unknown) => Promise<{ data: { user: { id: string } }; error: null | { message: string } }>>(async () => ({
      data: { user: { id: 'u-1' } },
      error: null
   }))
}));

vi.mock('@/lib/recordSessionIp', () => ({ recordSessionIp: vi.fn() }));
vi.mock('@/lib/push/webPushClient', () => ({ detachPushSubscriptionForSignOut: vi.fn() }));
vi.mock('@/lib/authRedirect', () => ({ getAuthRedirectUrl: () => 'https://moodeng.app/auth/confirm' }));
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      auth: {
         getSession: async () => ({ data: { session: null } }),
         signOut: vi.fn(),
         signInWithOtp: h.signInWithOtp,
         verifyOtp: h.verifyOtp,
         getUser: async () => ({ data: { user: h.authUser }, error: null })
      },
      from: () => {
         const builder = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: async () => ({ data: null, error: null }),
            insert: (payload: Record<string, unknown>) => {
               h.inserts.push(payload);
               return { select: () => ({ single: async () => ({ data: { ...payload, created_at: '', updated_at: '' }, error: null }) }) };
            }
         };
         return builder;
      }
   })
}));

const { requestOtpCode, verifyOtpCode } = await import('@/store/slices/authSlice');

const run = async <T>(thunk: (dispatch: never, getState: never, extra: never) => Promise<T>) =>
   thunk((() => undefined) as never, (() => ({})) as never, undefined as never);

describe('passwordless OTP thunks', () => {
   beforeEach(() => {
      h.signInWithOtp.mockClear();
      h.verifyOtp.mockClear();
      h.inserts = [];
      h.authUser = null;
      localStorage.clear();
   });

   it('phone: signInWithOtp with the E.164 number, creating the account with a neutral username', async () => {
      await run(requestOtpCode({ channel: 'sms', phone: '+639171234567' }));
      const args = h.signInWithOtp.mock.calls[0][0] as {
         phone: string;
         options: { shouldCreateUser: boolean; data: { username: string; passwordless: boolean } };
      };
      expect(args.phone).toBe('+639171234567');
      expect(args.options.shouldCreateUser).toBe(true);
      expect(args.options.data.passwordless).toBe(true);
      expect(args.options.data.username).toMatch(/^moodeng-[a-z2-9]{6}$/);
   });

   it('email: signInWithOtp with the email, redirect to /auth/confirm and the email local-part as username', async () => {
      await run(requestOtpCode({ channel: 'email', email: 'maria.santos@example.com' }));
      expect(h.signInWithOtp).toHaveBeenCalledWith({
         email: 'maria.santos@example.com',
         options: {
            shouldCreateUser: true,
            emailRedirectTo: 'https://moodeng.app/auth/confirm',
            data: { username: 'maria.santos', passwordless: true }
         }
      });
   });

   it('a refused request rejects with the Supabase error', async () => {
      h.signInWithOtp.mockResolvedValueOnce({ error: { message: 'Wait a minute before asking for another code.' } });
      const result = await run(requestOtpCode({ channel: 'sms', phone: '+639171234567' }));
      expect((result as { error?: { message?: string } }).error?.message).toBe('Wait a minute before asking for another code.');
   });

   it('phone: verifyOtp type sms; a new phone-only account gets a placeholder email, not the number', async () => {
      h.authUser = {
         id: '1b2c3d4e-0000-4000-8000-123456789abc',
         phone: '639171234567',
         email: '',
         user_metadata: { username: 'moodeng-abc234' },
         app_metadata: { provider: 'phone' }
      };
      const result = await run(verifyOtpCode({ channel: 'sms', phone: '+639171234567', token: '12345678' }));
      expect(h.verifyOtp).toHaveBeenCalledWith({ phone: '+639171234567', token: '12345678', type: 'sms' });
      expect(h.inserts[0]).toMatchObject({
         id: '1b2c3d4e-0000-4000-8000-123456789abc',
         username: 'moodeng-abc234',
         email: 'phone_1b2c3d4e000040008000123456789abc@moodeng.app'
      });
      expect(JSON.stringify(h.inserts[0])).not.toContain('9171234567');
      expect((result as { payload: { isNewUser: boolean } }).payload.isNewUser).toBe(true);
      expect(localStorage.getItem('moodeng:last-auth-method')).toBe('phone');
   });

   it('email: verifyOtp type email (covers both sign-up confirmation and sign-in codes)', async () => {
      h.authUser = { id: 'u-2', email: 'maria@example.com', user_metadata: {}, app_metadata: { provider: 'email' } };
      await run(verifyOtpCode({ channel: 'email', email: 'maria@example.com', token: '87654321' }));
      expect(h.verifyOtp).toHaveBeenCalledWith({ email: 'maria@example.com', token: '87654321', type: 'email' });
      expect(h.inserts[0]).toMatchObject({ email: 'maria@example.com' });
   });

   it('a wrong code rejects', async () => {
      h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'u-1' } }, error: { message: 'Token has expired or is invalid' } });
      const result = await run(verifyOtpCode({ channel: 'email', email: 'maria@example.com', token: '00000000' }));
      expect((result as { error?: { message?: string } }).error?.message).toBe('Token has expired or is invalid');
   });
});
