import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendEmail } from '../../supabase/functions/_shared/email';

// Mock values
const MOCK_API_KEY = 'test_key';
const MOCK_FROM = 'support@moodeng.app';

describe('sendEmail (Resend)', () => {
   beforeEach(() => {
      vi.clearAllMocks();

      // Stub global Deno
      vi.stubGlobal('Deno', {
         env: {
            get: vi.fn((key: string) => {
               if (key === 'RESEND_API_KEY') return MOCK_API_KEY;
               if (key === 'RESEND_FROM') return MOCK_FROM;
               return undefined;
            })
         }
      });

      // Stub global fetch
      vi.stubGlobal('fetch', vi.fn());
   });

   it('successfully sends an email via Resend API', async () => {
      // Mock successful response
      (fetch as any).mockResolvedValue({
         ok: true,
         json: async () => ({ id: '123' }),
      });

      const result = await sendEmail('to@example.com', 'Subject', 'Message');

      expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MOCK_API_KEY}`,
         },
         body: JSON.stringify({
            from: MOCK_FROM,
            to: ['to@example.com'],
            subject: 'Subject',
            text: 'Message',
         }),
      });
      expect(result).toEqual({ id: '123' });
   });

   it('throws an error if RESEND_API_KEY is missing', async () => {
      // Setup mock to return undefined for API key
      (Deno.env.get as any).mockImplementation((key: string) => {
         if (key === 'RESEND_API_KEY') return undefined;
         if (key === 'RESEND_FROM') return MOCK_FROM;
         return undefined;
      });

      await expect(sendEmail('to@example.com', 'Sub', 'Msg')).rejects.toThrow('Missing RESEND_API_KEY');
   });

   it('throws an error if Resend API returns an error', async () => {
      // Mock failure response
      (fetch as any).mockResolvedValue({
         ok: false,
         text: async () => 'Internal Server Error',
      });

      await expect(sendEmail('to@example.com', 'Sub', 'Msg')).rejects.toThrow('Failed to send email via Resend: Internal Server Error');
   });
});
