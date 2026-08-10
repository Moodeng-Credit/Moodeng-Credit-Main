import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendTelegramMessage } from '../_shared/telegram.ts';

// tawk.to webhook receiver → Telegram team alert.
//
// tawk.to notifies agents by email and by mobile push, but neither lands where
// the team actually watches: the MoodengCreditAlerts group. This bridges the
// gap, so a borrower opening a support chat pings the same feed as loan
// requests and fraud alerts, and nobody has to remember to check a second app.
//
// Outbound only. tawk.to's REST API is access-request gated and its documented
// surface is agent/property administration, not "post this message into that
// chat" — so replying still happens in the tawk.to dashboard or mobile app (or
// by email, via Ticketing). This function notifies; it does not relay replies.
//
// Setup:
//   1. Deploy, then take the function URL.
//   2. tawk.to → Administration → Webhooks → add the URL, tick the events.
//   3. Copy the secret tawk.to shows and set it as the Supabase secret
//      TAWK_WEBHOOK_SECRET.
// Until step 3 the function rejects everything — an unverified webhook is an
// open relay into the team's Telegram, so a missing secret fails closed.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'content-type, x-tawk-signature',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Constant-time comparison of two lowercase hex strings. */
const timingSafeEqualHex = (a: string, b: string) => {
   if (a.length !== b.length) return false;
   let diff = 0;
   for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
   return diff === 0;
};

// tawk.to signs the raw body with HMAC-SHA1 and sends it hex-encoded in
// X-Tawk-Signature. Web Crypto covers SHA-1 HMAC natively, so no extra dep.
const signBody = async (secret: string, rawBody: string): Promise<string> => {
   const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
   );
   const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
   return toHex(new Uint8Array(signature));
};

type TawkSender = { type?: string };
type TawkVisitor = { name?: string; email?: string; city?: string; country?: string };
type TawkMessage = { text?: string; type?: string; sender?: TawkSender };
type TawkTicket = { id?: string; humanId?: number; subject?: string; message?: string; requester?: TawkVisitor };

type TawkWebhookPayload = {
   event?: string;
   chatId?: string;
   time?: string;
   property?: { id?: string; name?: string };
   visitor?: TawkVisitor;
   message?: TawkMessage;
   ticket?: TawkTicket;
};

/** Trim to keep a runaway paste from blowing past Telegram's 4096-char limit. */
const clip = (value: string | undefined, max: number): string => {
   const text = (value ?? '').trim();
   if (!text) return '';
   return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const describeVisitor = (visitor: TawkVisitor | undefined): string => {
   const name = clip(visitor?.name, 80) || 'Someone';
   const email = clip(visitor?.email, 120);
   const place = [clip(visitor?.city, 60), clip(visitor?.country, 60)].filter(Boolean).join(', ');
   const details = [email, place].filter(Boolean).join(' · ');
   return details ? `${name} (${details})` : name;
};

/**
 * Build the Telegram alert, or null for events not worth waking anyone for.
 *
 * chat:end and chat:transcript_created are deliberately dropped: they fire on
 * every conversation, carry no new ask, and a feed that pings twice per chat is
 * a feed people mute.
 */
const buildAlert = (payload: TawkWebhookPayload): string | null => {
   const event = payload.event ?? '';

   if (event === 'chat:start') {
      // A chat:start whose first message came from an agent is us opening a
      // proactive conversation — no need to alert ourselves about it.
      if (payload.message?.sender?.type === 'agent') return null;
      const lines = [
         '💬 New support chat',
         describeVisitor(payload.visitor),
         '',
         clip(payload.message?.text, 900) || '(no message text)',
         '',
         'Reply in the tawk.to app or dashboard.'
      ];
      return lines.join('\n');
   }

   if (event === 'ticket:create') {
      const ticket = payload.ticket;
      const reference = ticket?.humanId ? `#${ticket.humanId}` : '';
      const lines = [
         `🎫 New support ticket ${reference}`.trim(),
         describeVisitor(ticket?.requester ?? payload.visitor),
         '',
         clip(ticket?.subject, 200) || '(no subject)',
         clip(ticket?.message, 700),
         '',
         'Reply to the ticket email and it syncs back to the borrower.'
      ].filter((line) => line !== undefined);
      return lines.join('\n');
   }

   return null;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'method-not-allowed' }, 405);

   const secret = Deno.env.get('TAWK_WEBHOOK_SECRET');
   if (!secret) {
      console.error('[tawk-webhook] TAWK_WEBHOOK_SECRET is not set — rejecting');
      return jsonResponse({ error: 'not-configured' }, 503);
   }

   // Read the body once, as text: the signature covers the exact bytes sent, so
   // re-serialising parsed JSON would not reproduce it.
   const rawBody = await req.text();
   const provided = (req.headers.get('x-tawk-signature') ?? '').trim().toLowerCase();
   if (!provided) return jsonResponse({ error: 'missing-signature' }, 401);

   const expected = await signBody(secret, rawBody);
   if (!timingSafeEqualHex(provided, expected)) {
      console.warn('[tawk-webhook] signature mismatch — rejecting');
      return jsonResponse({ error: 'bad-signature' }, 401);
   }

   let payload: TawkWebhookPayload;
   try {
      payload = JSON.parse(rawBody) as TawkWebhookPayload;
   } catch {
      return jsonResponse({ error: 'bad-json' }, 400);
   }

   const alert = buildAlert(payload);
   // Always 200 on a verified-but-uninteresting event: a non-2xx makes tawk.to
   // retry for 12 hours over something we chose to ignore.
   if (!alert) return jsonResponse({ ok: true, skipped: payload.event ?? 'unknown' });

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const { data: setting } = await supabase
      .from('telegram_bot_settings')
      .select('value')
      .eq('key', 'team_group_chat_id')
      .maybeSingle();

   const chatId = setting?.value;
   if (!chatId) {
      console.error('[tawk-webhook] telegram_bot_settings.team_group_chat_id is unset — cannot notify');
      return jsonResponse({ ok: true, delivered: false, reason: 'no-team-chat-id' });
   }

   try {
      await sendTelegramMessage(chatId, alert);
   } catch (error) {
      // Swallow rather than 500: a Telegram outage should not make tawk.to
      // retry this webhook for 12 hours, and the chat is already safe in the
      // tawk.to inbox — the alert is a convenience, not the system of record.
      console.error('[tawk-webhook] Telegram delivery failed', error);
      return jsonResponse({ ok: true, delivered: false });
   }

   return jsonResponse({ ok: true, delivered: true });
});
