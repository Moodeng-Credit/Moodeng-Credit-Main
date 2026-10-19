import { beforeEach, describe, expect, it, vi } from 'vitest';

// requestOtpCode / verifyOtpCode: the exact Supabase calls, and the profile row a phone-only
// account gets (public.users.email is NOT NULL, so a placeholder, never the number).
const h = vi.hoisted(() => ({
   authUser: null as null | Record<string, unknown>,
   session: null as null | Record<string, unknown>,
   signOut: vi.fn<(options?: unknown) => Promise<{ error: null }>>(async () => ({ error: null })),
   inserts: [] as Record<string, unknown>[],
   signInWithOtp: vi.fn<(args: unknown) => Promise<{ error: null | { message: string } }>>(async () => ({ error: null })),
   verifyOtp: vi.fn<(args: unknown) => Promise<{ data: { user: { id: string } }; error: null | { message: string } }>>(async () => ({
      data: { user: { id: 'u-1' } },
      error: null
   })),
   signInAnonymously: vi.fn<(args: unknown) => Promise<{ error: null }>>(async () => ({ error: null })),
   updateUser: vi.fn<(args: unknown, options?: unknown) => Promise<{ error: null | { message: string; code?: string } }>>(async () => ({
      error: null
   })),
   rpc: vi.fn<(name: string, args?: unknown) => Promise<{ data: unknown; error: null }>>(async () => ({ data: false, error: null })),
   signUp: vi.fn<(args: unknown) => Promise<{ data: { user: unknown }; error: null }>>(async () => ({
      data: { user: { id: 'u-new', identities: [{ id: 'i-1' }] } },
      error: null
   }))
}));

vi.mock('@/lib/recordSessionIp', () => ({ recordSessionIp: vi.fn() }));
vi.mock('@/lib/push/webPushClient', () => ({ detachPushSubscriptionForSignOut: vi.fn() }));
vi.mock('@/lib/authRedirect', () => ({ getAuthRedirectUrl: () => 'https://moodeng.app/auth/confirm' }));
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      auth: {
         getSession: async () => ({ data: { session: h.session } }),
         signOut: h.signOut,
         signInWithOtp: h.signInWithOtp,
         verifyOtp: h.verifyOtp,
         signInAnonymously: h.signInAnonymously,
         updateUser: h.updateUser,
         signUp: h.signUp,
         getUser: async () => ({ data: { user: h.authUser }, error: null })
      },
      rpc: h.rpc,
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

const { registerUser, requestOtpCode, startGuestPhoneSignup, startGuestSignup, verifyOtpCode } = await import('@/store/slices/authSlice');

const run = async <T>(thunk: (dispatch: never, getState: never, extra: never) => Promise<T>) =>
   thunk((() => undefined) as never, (() => ({})) as never, undefined as never);

describe('passwordless OTP thunks', () => {
   beforeEach(() => {
      h.signInWithOtp.mockClear();
      h.verifyOtp.mockClear();
      h.inserts = [];
      h.authUser = null;
      h.session = null;
      h.signOut.mockClear();
      h.signInAnonymously.mockClear();
      h.updateUser.mockClear();
      h.rpc.mockReset();
      h.rpc.mockImplementation(async () => ({ data: false, error: null }));
      h.signUp.mockClear();
      localStorage.clear();
      sessionStorage.clear();
   });

   it('phone sign-up: signInWithOtp with the E.164 number, creating the account with a neutral username', async () => {
      await run(requestOtpCode({ channel: 'sms', phone: '+639171234567', mode: 'signup' }));
      const args = h.signInWithOtp.mock.calls[0][0] as {
         phone: string;
         options: { shouldCreateUser: boolean; data: { username: string; passwordless: boolean } };
      };
      expect(args.phone).toBe('+639171234567');
      expect(args.options.shouldCreateUser).toBe(true);
      expect(args.options.data.passwordless).toBe(true);
      expect(args.options.data.username).toMatch(/^moodeng-[a-z2-9]{6}$/);
   });

   it('email sign-up: signInWithOtp with the email, redirect to /auth/confirm and the email local-part as username', async () => {
      await run(requestOtpCode({ channel: 'email', email: 'maria.santos@example.com', mode: 'signup' }));
      expect(h.signInWithOtp).toHaveBeenCalledWith({
         email: 'maria.santos@example.com',
         options: {
            shouldCreateUser: true,
            emailRedirectTo: 'https://moodeng.app/auth/confirm',
            data: { username: 'maria.santos', passwordless: true }
         }
      });
   });

   it('sign-in never creates an account (shouldCreateUser false), by phone or email', async () => {
      await run(requestOtpCode({ channel: 'sms', phone: '+639171234567', mode: 'signin' }));
      await run(requestOtpCode({ channel: 'email', email: 'maria@example.com', mode: 'signin' }));
      const calls = h.signInWithOtp.mock.calls.map(
         ([args]) => (args as { options: { shouldCreateUser: boolean } }).options.shouldCreateUser
      );
      expect(calls).toEqual([false, false]);
   });

   it('a leftover session is signed out on this device only, keeping a pending invite code', async () => {
      h.session = { user: { id: 'old' } };
      localStorage.setItem('moodeng.pendingInviteCode', JSON.stringify({ code: 'MARIA5' }));
      localStorage.setItem('persist:root', 'old account data');
      sessionStorage.setItem('pendingSharedRequestId', 'loan-1');
      await run(requestOtpCode({ channel: 'email', email: 'maria@example.com', mode: 'signin' }));
      expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(localStorage.getItem('moodeng.pendingInviteCode')).toContain('MARIA5');
      expect(sessionStorage.getItem('pendingSharedRequestId')).toBe('loan-1');
      expect(localStorage.getItem('persist:root')).toBeNull();
   });

   it('signs a leftover session out only after the code is sent', async () => {
      h.session = { user: { id: 'old' } };
      h.signInWithOtp.mockImplementationOnce(async () => {
         expect(h.signOut).not.toHaveBeenCalled();
         return { error: null };
      });
      await run(requestOtpCode({ channel: 'email', email: 'maria@example.com', mode: 'signin' }));
      expect(h.signOut).toHaveBeenCalledTimes(1);
   });

   it('a refused code request never signs anyone out', async () => {
      h.session = { user: { id: 'old' } };
      localStorage.setItem('persist:root', 'their data');
      h.signInWithOtp.mockResolvedValueOnce({ error: { message: 'Signups not allowed for otp' } });
      const result = await run(requestOtpCode({ channel: 'email', email: 'maria@example.com', mode: 'signin' }));
      expect((result as { error?: { message?: string } }).error?.message).toBe('Signups not allowed for otp');
      expect(h.signOut).not.toHaveBeenCalled();
      expect(localStorage.getItem('persist:root')).toBe('their data');
   });

   // Oct 16 2026: a guest back on /sign-in typed her pending email; the session was signed out
   // first, then the code was refused (422), and she was locked out of her guest account.
   it('a guest (anonymous) session survives a code request, refused or sent', async () => {
      h.session = { user: { id: 'guest-1', is_anonymous: true } };
      localStorage.setItem('persist:root', 'guest progress');
      h.signInWithOtp.mockResolvedValueOnce({ error: { message: 'Signups not allowed for otp' } });
      await run(requestOtpCode({ channel: 'email', email: 'emma@example.com', mode: 'signin' }));
      await run(requestOtpCode({ channel: 'email', email: 'emma@example.com', mode: 'signup' }));
      expect(h.signInWithOtp).toHaveBeenCalledTimes(2);
      expect(h.signOut).not.toHaveBeenCalled();
      expect(localStorage.getItem('persist:root')).toBe('guest progress');
   });

   it("a kept guest session's cached data is cleared once the code signs someone else in", async () => {
      h.session = { user: { id: 'guest-1', is_anonymous: true } };
      localStorage.setItem('persist:root', 'guest progress');
      localStorage.setItem('moodeng.pendingInviteCode', JSON.stringify({ code: 'MARIA5' }));
      h.authUser = { id: 'u-1', email: 'maria@example.com', user_metadata: {}, app_metadata: { provider: 'email' } };
      await run(verifyOtpCode({ channel: 'email', email: 'maria@example.com', token: '87654321' }));
      expect(localStorage.getItem('persist:root')).toBeNull();
      expect(localStorage.getItem('moodeng.pendingInviteCode')).toContain('MARIA5');
   });

   it('a wrong code keeps the guest session and its data', async () => {
      h.session = { user: { id: 'guest-1', is_anonymous: true } };
      localStorage.setItem('persist:root', 'guest progress');
      h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'u-1' } }, error: { message: 'Token has expired or is invalid' } });
      await run(verifyOtpCode({ channel: 'email', email: 'maria@example.com', token: '00000000' }));
      expect(h.signOut).not.toHaveBeenCalled();
      expect(localStorage.getItem('persist:root')).toBe('guest progress');
   });

   it('guest sign-up again on a browser that already has a guest: same account, no sign-out', async () => {
      h.session = { user: { id: 'guest-1', is_anonymous: true, new_email: 'emma@example.com', user_metadata: {} } };
      h.authUser = { id: 'guest-1', is_anonymous: true, user_metadata: { username: 'emma' }, app_metadata: {} };
      const result = await run(startGuestSignup({ email: 'Emma@example.com' }));
      expect((result as { payload: { user: { id: string } } }).payload.user.id).toBe('guest-1');
      expect(h.signOut).not.toHaveBeenCalled();
      expect(h.signInAnonymously).not.toHaveBeenCalled();
      // Same email: nothing re-sent.
      expect(h.updateUser).not.toHaveBeenCalled();
   });

   it('guest sign-up with a different email on an existing guest moves the pending email', async () => {
      h.session = { user: { id: 'guest-1', is_anonymous: true, new_email: 'emma@example.com', user_metadata: {} } };
      h.authUser = { id: 'guest-1', is_anonymous: true, user_metadata: { username: 'emma' }, app_metadata: {} };
      await run(startGuestSignup({ email: 'emma.new@example.com' }));
      expect(h.updateUser).toHaveBeenCalledWith(
         { email: 'emma.new@example.com', data: { guest_email: 'emma.new@example.com' } },
         { emailRedirectTo: 'https://moodeng.app/auth/confirm' }
      );
      expect(h.signOut).not.toHaveBeenCalled();
      expect(h.signInAnonymously).not.toHaveBeenCalled();
   });

   it("guest sign-up over another (real) account's session still signs that one out first", async () => {
      h.session = { user: { id: 'old', is_anonymous: false } };
      h.authUser = { id: 'guest-2', is_anonymous: true, user_metadata: { username: 'emma' }, app_metadata: {} };
      await run(startGuestSignup({ email: 'emma@example.com' }));
      expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(h.signInAnonymously).toHaveBeenCalledTimes(1);
      expect(h.updateUser).toHaveBeenCalledWith({ email: 'emma@example.com' }, { emailRedirectTo: 'https://moodeng.app/auth/confirm' });
   });

   it('guest sign-up frees an unfinished earlier sign-up with that email before attaching it', async () => {
      h.authUser = { id: 'guest-3', is_anonymous: true, user_metadata: { username: 'emma' }, app_metadata: {} };
      const order: string[] = [];
      h.rpc.mockImplementation(async (name: string) => {
         order.push(name);
         return { data: name === 'release_unfinished_signup', error: null };
      });
      h.updateUser.mockImplementationOnce(async () => {
         order.push('updateUser');
         return { error: null };
      });
      const result = await run(startGuestSignup({ email: 'emma@example.com' }));
      expect(h.rpc).toHaveBeenCalledWith('release_unfinished_signup', { p_email: 'emma@example.com' });
      expect(order.indexOf('release_unfinished_signup')).toBeLessThan(order.indexOf('updateUser'));
      expect((result as { payload: { user: { id: string } } }).payload.user.id).toBe('guest-3');
   });

   it('guest sign-up still goes ahead when freeing the email fails', async () => {
      h.authUser = { id: 'guest-4', is_anonymous: true, user_metadata: { username: 'emma' }, app_metadata: {} };
      h.rpc.mockImplementation(async (name: string) => {
         if (name === 'release_unfinished_signup') throw new Error('network');
         return { data: false, error: null };
      });
      const result = await run(startGuestSignup({ email: 'emma@example.com' }));
      expect(h.signInAnonymously).toHaveBeenCalledTimes(1);
      expect(h.updateUser).toHaveBeenCalledWith({ email: 'emma@example.com' }, { emailRedirectTo: 'https://moodeng.app/auth/confirm' });
      expect((result as { payload: { user: { id: string } } }).payload.user.id).toBe('guest-4');
   });

   it('phone-first sign-up: a guest login with the number attached, no code sent, guest placeholder email', async () => {
      h.authUser = { id: 'guest-p1', is_anonymous: true, phone: '639569967993', user_metadata: { username: 'moodeng-abc123' }, app_metadata: {} };
      const calls: string[] = [];
      h.rpc.mockImplementation(async (name: string) => {
         calls.push(name);
         return { data: name === 'claim_guest_phone' ? 'ok' : false, error: null };
      });
      const result = await run(startGuestPhoneSignup({ phone: '+639569967993' }));
      expect(calls).toEqual(['phone_has_account', 'claim_guest_phone']);
      expect(h.rpc).toHaveBeenCalledWith('claim_guest_phone', { p_phone: '+639569967993' });
      expect(h.signInAnonymously).toHaveBeenCalledTimes(1);
      expect(h.signInWithOtp).not.toHaveBeenCalled();
      // A guest, not a phone account: the gate asks for an email after approval.
      expect(h.inserts[0]?.email).toBe('guest_guestp1@moodeng.app');
      expect((result as { payload: { user: { id: string } } }).payload.user.id).toBe('guest-p1');
   });

   it('phone-first sign-up with a number that has an account: refused before any guest is made', async () => {
      h.rpc.mockImplementation(async (name: string) => ({ data: name === 'phone_has_account', error: null }));
      const result = await run(startGuestPhoneSignup({ phone: '+639569967993' }));
      expect((result as { error?: { name?: string } }).error?.name).toBe('GuestPhoneTakenError');
      expect(h.signInAnonymously).not.toHaveBeenCalled();
   });

   it('phone-first sign-up: number taken in a race after the guest login, the empty guest is deleted', async () => {
      h.rpc.mockImplementation(async (name: string) => ({ data: name === 'claim_guest_phone' ? 'taken' : false, error: null }));
      const result = await run(startGuestPhoneSignup({ phone: '+639569967993' }));
      expect((result as { error?: { name?: string } }).error?.name).toBe('GuestPhoneTakenError');
      expect(h.rpc).toHaveBeenCalledWith('discard_empty_guest');
      expect(h.inserts).toHaveLength(0);
   });

   it('a taken email after signing in as a guest deletes that empty guest and signs it out', async () => {
      h.updateUser.mockResolvedValueOnce({
         error: { message: 'A user with this email address has already been registered', code: 'email_exists' }
      });
      const result = await run(startGuestSignup({ email: 'taken@example.com' }));
      expect((result as { error?: { name?: string } }).error?.name).toBe('GuestEmailTakenError');
      expect(h.rpc).toHaveBeenCalledWith('discard_empty_guest');
      expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
      // No profile row was created for the throwaway guest.
      expect(h.inserts).toHaveLength(0);
   });

   it('email+password sign-up frees an unfinished earlier sign-up before checking the email', async () => {
      const order: string[] = [];
      h.rpc.mockImplementation(async (name: string) => {
         order.push(name);
         return { data: false, error: null };
      });
      await run(registerUser({ username: 'emma', isWorldId: 'INACTIVE', password: 'Secret123!', email: 'emma@example.com' }));
      expect(order.slice(0, 2)).toEqual(['release_unfinished_signup', 'email_exists']);
      expect(h.rpc).toHaveBeenCalledWith('release_unfinished_signup', { p_email: 'emma@example.com' });
      expect(h.signUp).toHaveBeenCalledTimes(1);
   });

   it('a refused request rejects with the Supabase error', async () => {
      h.signInWithOtp.mockResolvedValueOnce({ error: { message: 'Wait a minute before asking for another code.' } });
      const result = await run(requestOtpCode({ channel: 'sms', phone: '+639171234567', mode: 'signin' }));
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
      // Not a Telegram login: the metadata username must not become a (unique) Telegram username.
      expect(h.inserts[0]).not.toHaveProperty('telegram_username');
      expect((result as { payload: { isNewUser: boolean } }).payload.isNewUser).toBe(true);
      expect(localStorage.getItem('moodeng:last-auth-method')).toBe('phone');
   });

   it('email: verifyOtp type email (covers both sign-up confirmation and sign-in codes)', async () => {
      h.authUser = { id: 'u-2', email: 'maria@example.com', user_metadata: {}, app_metadata: { provider: 'email' } };
      await run(verifyOtpCode({ channel: 'email', email: 'maria@example.com', token: '87654321' }));
      expect(h.verifyOtp).toHaveBeenCalledWith({ email: 'maria@example.com', token: '87654321', type: 'email' });
      expect(h.inserts[0]).toMatchObject({ email: 'maria@example.com' });
   });

   it('email sign-up with a username in its metadata: no fake Telegram username (it is unique)', async () => {
      h.authUser = { id: 'u-3', email: 'gayporn123@atomicmail.io', user_metadata: { username: 'gayporn123' }, app_metadata: { provider: 'email' } };
      await run(verifyOtpCode({ channel: 'email', email: 'gayporn123@atomicmail.io', token: '87654321' }));
      expect(h.inserts[0]).toMatchObject({ email: 'gayporn123@atomicmail.io' });
      expect(h.inserts[0]).not.toHaveProperty('telegram_username');
   });

   it('a wrong code rejects', async () => {
      h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'u-1' } }, error: { message: 'Token has expired or is invalid' } });
      const result = await run(verifyOtpCode({ channel: 'email', email: 'maria@example.com', token: '00000000' }));
      expect((result as { error?: { message?: string } }).error?.message).toBe('Token has expired or is invalid');
   });
});
