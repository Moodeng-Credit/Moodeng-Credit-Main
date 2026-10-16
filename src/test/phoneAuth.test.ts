import { afterEach, describe, expect, it, vi } from 'vitest';

import { describeOtpError } from '@/lib/otpErrors';
import {
   checkPhPhone,
   formatPhPhone,
   generatePhoneUsername,
   isPlaceholderEmail,
   isSmsLoginEnabled,
   phonePlaceholderEmail,
   showPasswordlessSignup
} from '@/lib/phoneAuth';

describe('checkPhPhone: PH mobile numbers to E.164', () => {
   it.each([
      ['09171234567', '+639171234567'],
      ['0917 123 4567', '+639171234567'],
      ['0917-123-4567', '+639171234567'],
      ['9171234567', '+639171234567'],
      ['917 123 4567', '+639171234567'],
      ['639171234567', '+639171234567'],
      ['+639171234567', '+639171234567'],
      ['+63 917 123 4567', '+639171234567'],
      ['+63 (917) 123-4567', '+639171234567'],
      ['00639171234567', '+639171234567'],
      [' +63.917.123.4567 ', '+639171234567']
   ])('%s → %s', (input, e164) => {
      expect(checkPhPhone(input)).toEqual({ kind: 'ok', e164 });
   });

   it.each(['', '0', '09', '0917', '917123', '+', '+6', '+63', '+639', '63917'])('"%s" is still being typed', (input) => {
      expect(checkPhPhone(input).kind).toBe('incomplete');
   });

   it.each([
      ['+971 50 123 4567', 'UAE'],
      ['+81 90 1234 5678', 'Japan'],
      ['+974 3312 3456', 'Qatar'],
      ['+853 6612 3456', 'Macau'],
      ['+62 812 3456 7890', 'Indonesia'],
      ['+1 415 555 0100', 'US'],
      ['0081 90 1234 5678', 'Japan with 00'],
      ['6281234567890', 'Indonesia without +'],
      ['971501234567', 'UAE without +'],
      ['+6391712345678', 'too long after +63']
   ])('%s (%s) is not a PH number', (input) => {
      expect(checkPhPhone(input).kind).toBe('non_ph');
   });

   it.each(['02 8123 4567', '+63 2 8123 4567', '0812345', '12345'])('%s is not a PH mobile number', (input) => {
      expect(checkPhPhone(input).kind).toBe('invalid');
   });

   it('formats E.164 for display', () => {
      expect(formatPhPhone('+639171234567')).toBe('+63 917 123 4567');
      expect(formatPhPhone('+971501234567')).toBe('+971501234567');
   });
});

describe('phone account details', () => {
   it('generates a neutral username, never the number', () => {
      const name = generatePhoneUsername(() => 0.5);
      expect(name).toMatch(/^moodeng-[a-z2-9]{6}$/);
      expect(name).not.toMatch(/\d{6,}/);
   });

   it('gives phone accounts a placeholder email from the account id, recognised like Telegram/LINE ones', () => {
      const email = phonePlaceholderEmail('1b2c3d4e-0000-4000-8000-123456789abc');
      expect(email).toBe('phone_1b2c3d4e000040008000123456789abc@moodeng.app');
      expect(isPlaceholderEmail(email)).toBe(true);
      expect(isPlaceholderEmail('telegram_12345@moodeng.app')).toBe(true);
      expect(isPlaceholderEmail('line_u655@moodeng.app')).toBe(true);
      expect(isPlaceholderEmail('maria@gmail.com')).toBe(false);
      expect(isPlaceholderEmail(null)).toBe(false);
   });
});

describe('flags', () => {
   afterEach(() => {
      vi.unstubAllEnvs();
      localStorage.clear();
      window.history.replaceState(null, '', '/');
   });

   it('passwordless sign-up: Facebook/Messenger browser only (or ?passwordless=1)', () => {
      expect(showPasswordlessSignup(true)).toBe(true);
      expect(showPasswordlessSignup(false)).toBe(false);
      window.history.replaceState(null, '', '/sign-up?passwordless=1');
      expect(showPasswordlessSignup(false)).toBe(true);
   });

   it('SMS login: paused even with VITE_SMS_LOGIN_ENABLED=true, testers can opt in with ?sms=1', () => {
      expect(isSmsLoginEnabled()).toBe(false);
      window.history.replaceState(null, '', '/sign-in?sms=1');
      expect(isSmsLoginEnabled()).toBe(true);
      window.history.replaceState(null, '', '/sign-in');
      expect(isSmsLoginEnabled()).toBe(true);
      window.history.replaceState(null, '', '/sign-in?sms=0');
      expect(isSmsLoginEnabled()).toBe(false);
      vi.stubEnv('VITE_SMS_LOGIN_ENABLED', 'true');
      expect(isSmsLoginEnabled()).toBe(false);
   });
});

describe('describeOtpError', () => {
   it('non-PH refusal from the Send SMS hook moves them to email', () => {
      expect(
         describeOtpError({ message: 'SMS codes work for Philippine numbers only. Use your email instead.', status: 400 }, 'sms')
      ).toEqual({
         message: 'SMS codes work for Philippine numbers only. Use your email instead',
         switchToEmail: true,
         nonPh: true
      });
   });

   it("keeps the hook's cooldown and daily-cap wording", () => {
      expect(describeOtpError({ message: 'Wait a minute before asking for another code.', status: 429 }, 'sms')).toEqual({
         message: 'Wait a minute before asking for another code.',
         switchToEmail: false
      });
      const cap = describeOtpError({ message: 'Too many codes today. Use email, or try tomorrow.', status: 429 }, 'sms');
      expect(cap.switchToEmail).toBe(true);
      expect(cap.message).toBe('Too many codes today. Use email, or try tomorrow.');
   });

   it('the overall daily brake keeps its wording and moves them to email', () => {
      expect(
         describeOtpError({ message: 'Text codes are busy right now. Use your email instead, or try again later.', status: 429 }, 'sms')
      ).toEqual({
         message: 'Text codes are busy right now. Use your email instead, or try again later.',
         switchToEmail: true
      });
   });

   it("Supabase's own rate limit reads as plain advice", () => {
      expect(
         describeOtpError({ message: 'For security purposes, you can only request this after 42 seconds.', status: 429 }, 'email').message
      ).toBe('Please wait a minute before asking for another code.');
   });

   it('SMS not set up / failing falls back to email', () => {
      expect(describeOtpError({ message: 'Unsupported phone provider' }, 'sms').switchToEmail).toBe(true);
      expect(describeOtpError({ message: 'Text codes are not available right now. Use your email instead.' }, 'sms').switchToEmail).toBe(
         true
      );
   });

   it('banned accounts and network errors', () => {
      expect(describeOtpError({ code: 'user_banned', message: 'User is banned' }, 'email').message).toContain(
         'This account has been closed'
      );
      expect(describeOtpError({ message: 'Failed to fetch' }, 'email').message).toContain('Could not reach the server');
   });
});

describe('accountHasPassword', async () => {
   const { accountHasPassword } = await import('@/hooks/useAuthProvider');

   it('passwordless sign-ups have none until they set one; older email accounts have one', () => {
      expect(accountHasPassword({ app_metadata: { provider: 'phone' }, user_metadata: { passwordless: true } })).toBe(false);
      expect(accountHasPassword({ app_metadata: { provider: 'email' }, user_metadata: { passwordless: true } })).toBe(false);
      expect(accountHasPassword({ app_metadata: { provider: 'email' }, user_metadata: { passwordless: true, has_password: true } })).toBe(
         true
      );
      expect(accountHasPassword({ app_metadata: { provider: 'email' }, user_metadata: {} })).toBe(true);
      expect(accountHasPassword({ app_metadata: { provider: 'google' }, user_metadata: {} })).toBe(false);
   });
});

describe('guest placeholder email', () => {
   it('is a placeholder, never the typed address', async () => {
      const { guestPlaceholderEmail, isGuestEmail, isPlaceholderEmail } = await import('@/lib/phoneAuth');
      const email = guestPlaceholderEmail('3586-6cc4');
      expect(email).toBe('guest_35866cc4@moodeng.app');
      expect(isGuestEmail(email)).toBe(true);
      expect(isPlaceholderEmail(email)).toBe(true);
      expect(isGuestEmail('juan@gmail.com')).toBe(false);
      expect(isGuestEmail('phone_abc@moodeng.app')).toBe(false);
   });
});
