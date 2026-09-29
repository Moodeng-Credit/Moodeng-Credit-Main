import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { resolveDiscordWebhook } from '../_shared/discord.ts';

// Inbound-email → support ticket.
//
// support@moodeng.app lives on Namecheap Private Email (IMAP/SMTP only, no REST API). Rather
// than poll IMAP from an edge function (a bad fit for Deno Deploy's socket model), inbound mail
// is *forwarded* into a webhook provider — Resend Inbound (MX on a reply subdomain) or a
// Cloudflare Email Worker — which POSTs the parsed message here. We mirror it into the same
// widget_conversations ticket model the live chat uses (a row + a Discord #web-support thread),
// so email and in-app chat land in one place.
//
// This function is the INBOUND half only. The OUTBOUND half — turning a team member's reply in
// the Discord thread back into an email — lives in the widget backend repo (it owns the Discord
// bot / reply relay). It reads reply_token + email_last_message_id from the row we write here to
// address and thread the outgoing email. Until that ships, the team can still reply straight from
// the PrivateEmail mailbox: the customer's address is shown on every Discord post.
//
// Auth: a shared secret in the query string (?secret=EMAIL_INBOUND_SECRET), set on the webhook
// endpoint URL when you configure Resend/Cloudflare. Provider-agnostic and unguessable; combined
// with the random function URL it is a sufficient gate for a receive-only endpoint.
//
// Expected JSON body (provider-agnostic; a Cloudflare worker can be written to match it, and
// Resend Inbound's `data` envelope is unwrapped automatically):
//   {
//     "from":    "Jane Doe <jane@example.com>"  | "jane@example.com",
//     "to":      "reply+<uuid>@reply.moodeng.app" | ["support@moodeng.app", ...],
//     "subject": "Re: World ID not working",
//     "text":    "plain body",           // preferred
//     "html":    "<p>…</p>",             // fallback if no text
//     "headers": { "message-id": "<…>", "in-reply-to": "<…>", "references": "<…> <…>" }
//                 | [ { "name": "Message-ID", "value": "<…>" }, … ]
//   }

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Constant-time string compare so the secret can't be recovered by timing.
const timingSafeEqual = (a: string, b: string): boolean => {
   if (a.length !== b.length) return false;
   let diff = 0;
   for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
   return diff === 0;
};

// Discord content is capped at 2000 chars and an embed description at 4096. Keep the body well
// under the embed cap and leave room for the "… (truncated)" note.
const DISCORD_DESC_MAX = 3800;

const REPLY_SUBDOMAIN = Deno.env.get('EMAIL_REPLY_DOMAIN')?.trim() || 'reply.moodeng.app';

type InboundEmail = {
   fromEmail: string;
   fromName: string | null;
   toList: string[];
   subject: string;
   body: string;
   messageId: string | null;
   inReplyTo: string | null;
   references: string[];
   /** Sent by a machine (no-reply sender, mailing list, auto-reply) rather than a person. */
   automated: boolean;
};

// support@ also receives service mail (Zoom meeting notices, billing, newsletters). Those are not
// support requests, so they must never become Discord tickets.
const AUTOMATED_SENDER = /^(no-?reply|do-?not-?reply|notifications?|notify|mailer-daemon|postmaster|bounces?|alerts?|news(letter)?|billing|receipts?)([@+._-]|$)/i;

const isAutomated = (fromEmail: string, headers: unknown, readHeaderFn: (h: unknown, name: string) => string | null): boolean => {
   if (AUTOMATED_SENDER.test(fromEmail)) return true;
   const autoSubmitted = readHeaderFn(headers, 'auto-submitted');
   if (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') return true;
   if (readHeaderFn(headers, 'list-unsubscribe') || readHeaderFn(headers, 'list-id')) return true;
   const precedence = readHeaderFn(headers, 'precedence')?.toLowerCase();
   return precedence === 'bulk' || precedence === 'list' || precedence === 'junk' || precedence === 'auto_reply';
};

// "Jane Doe <jane@example.com>" | "jane@example.com" -> { name, email }
const parseAddress = (raw: string): { name: string | null; email: string } => {
   const s = (raw ?? '').trim();
   const angled = s.match(/^(.*?)<([^>]+)>\s*$/);
   if (angled) {
      const name = angled[1].trim().replace(/^"|"$/g, '').trim();
      return { name: name || null, email: angled[2].trim().toLowerCase() };
   }
   return { name: null, email: s.toLowerCase() };
};

const asStringArray = (v: unknown): string[] => {
   if (Array.isArray(v)) return v.map((x) => String(x));
   if (typeof v === 'string') return [v];
   return [];
};

// headers may arrive as an object map or as an array of {name,value}. Return lowercased keys.
const readHeader = (headers: unknown, name: string): string | null => {
   const want = name.toLowerCase();
   if (Array.isArray(headers)) {
      for (const h of headers) {
         const hn = (h?.name ?? h?.key ?? '').toString().toLowerCase();
         if (hn === want) return (h?.value ?? '').toString();
      }
      return null;
   }
   if (headers && typeof headers === 'object') {
      for (const [k, val] of Object.entries(headers as Record<string, unknown>)) {
         if (k.toLowerCase() === want) return val == null ? null : String(val);
      }
   }
   return null;
};

// Extract <id> tokens from an In-Reply-To / References header value.
const extractMessageIds = (value: string | null): string[] =>
   value ? Array.from(value.matchAll(/<[^>]+>/g), (m) => m[0]) : [];

const stripHtml = (html: string): string =>
   html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

// Resend's html (and sometimes text) can arrive as a data: URI (html_format: "data_uri").
const decodeDataUri = (value: string): string => {
   if (!value.startsWith('data:')) return value;
   const comma = value.indexOf(',');
   if (comma === -1) return value;
   const meta = value.slice(5, comma);
   const data = value.slice(comma + 1);
   try {
      if (meta.includes(';base64')) {
         const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
         return new TextDecoder().decode(bytes);
      }
      return decodeURIComponent(data);
   } catch {
      return value;
   }
};

// Resend's email.received webhook carries only the envelope (data.email_id, from, to, subject);
// the body and headers have to be fetched from the Receiving API. Merge them into the payload so
// parseInbound sees one complete message. No-op for other providers or a payload that already has
// a body.
const hydrateFromResend = async (payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
   const data = payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : null;
   const emailId = typeof data?.email_id === 'string' ? data.email_id : null;
   if (!data || !emailId || typeof data.text === 'string' || typeof data.html === 'string') return payload;

   const apiKey = Deno.env.get('RESEND_API_KEY');
   if (!apiKey) {
      console.error('[email-inbound] RESEND_API_KEY not set — cannot fetch the body of', emailId);
      return payload;
   }
   try {
      const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
         headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) {
         console.error('[email-inbound] Resend fetch failed', res.status, (await res.text()).slice(0, 300));
         return payload;
      }
      const full = (await res.json()) as Record<string, unknown>;
      return {
         ...payload,
         data: {
            ...data,
            from: full.from ?? data.from,
            to: full.to ?? data.to,
            subject: full.subject ?? data.subject,
            text: typeof full.text === 'string' ? decodeDataUri(full.text) : undefined,
            html: typeof full.html === 'string' ? decodeDataUri(full.html) : undefined,
            headers: full.headers ?? data.headers,
            message_id: full.message_id ?? data.message_id
         }
      };
   } catch (err) {
      console.error('[email-inbound] Resend fetch error', err);
      return payload;
   }
};

const parseInbound = (payload: Record<string, unknown>): InboundEmail | null => {
   // Resend wraps the message in { type, data: {...} }; a bare forward posts the fields directly.
   const d = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;

   const fromRaw = asStringArray(d.from)[0] ?? '';
   const { name: fromName, email: fromEmail } = parseAddress(fromRaw);
   if (!fromEmail || !fromEmail.includes('@')) return null;

   const toList = asStringArray(d.to).map((t) => parseAddress(t).email);
   const subject = (typeof d.subject === 'string' ? d.subject : '').trim() || '(no subject)';

   const text = typeof d.text === 'string' ? d.text : '';
   const html = typeof d.html === 'string' ? d.html : '';
   const body = (text.trim() || (html ? stripHtml(html) : '')).trim();

   const headers = d.headers;
   const messageId = readHeader(headers, 'message-id') ?? (typeof d.message_id === 'string' ? d.message_id : null);
   const inReplyTo = extractMessageIds(readHeader(headers, 'in-reply-to'))[0] ?? null;
   const references = extractMessageIds(readHeader(headers, 'references'));

   const automated = isAutomated(fromEmail, headers, readHeader);

   return { fromEmail, fromName, toList, subject, body, messageId, inReplyTo, references, automated };
};

// reply+<uuid>@… in any recipient address -> the reply token.
const findReplyToken = (toList: string[]): string | null => {
   for (const addr of toList) {
      const m = addr.match(/(?:reply|support)\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i);
      if (m) return m[1].toLowerCase();
   }
   return null;
};

// "Re: Re: X" -> "X" (for a tidy thread name only; not used for matching).
const cleanSubject = (s: string): string => s.replace(/^\s*(re|fwd?):\s*/i, '').trim() || s.trim();

type Conversation = { id: string; discord_thread_id: string | null; reply_token: string; status: string };

// Post to the #web-support forum webhook. On a forum channel, thread_name creates a new thread and
// the ?wait=true response's channel_id is the new thread id. Subsequent posts pass thread_id.
// Falls back to DISCORD_TEAM_WEBHOOK_URL (a text channel) where thread_name is ignored but the
// message is still delivered — so a ticket is never silently lost.
const postToDiscord = async (opts: {
   description: string;
   fromEmail: string;
   fromName: string | null;
   subject: string;
   threadName?: string;
   threadId?: string | null;
}): Promise<string | null> => {
   const base = resolveDiscordWebhook('DISCORD_WEBSUPPORT_WEBHOOK_URL');
   if (!base) {
      console.error('[email-inbound] no Discord webhook configured (DISCORD_WEBSUPPORT_WEBHOOK_URL / DISCORD_TEAM_WEBHOOK_URL)');
      return null;
   }

   const embed = {
      title: `📧 ${opts.subject}`.slice(0, 256),
      description: opts.description,
      color: 0x6c3fe0,
      fields: [{ name: 'From', value: `${opts.fromName ? `${opts.fromName} · ` : ''}${opts.fromEmail}`.slice(0, 1024) }],
      footer: { text: 'Inbound email · reply in this thread to answer the customer' },
      timestamp: new Date().toISOString()
   };

   const url = new URL(base);
   url.searchParams.set('wait', 'true');
   if (opts.threadId) url.searchParams.set('thread_id', opts.threadId);

   const payload: Record<string, unknown> = { embeds: [embed], allowed_mentions: { parse: [] } };
   // thread_name only applies (and is only valid) when creating a new forum thread.
   if (!opts.threadId && opts.threadName) payload.thread_name = opts.threadName.slice(0, 100);

   try {
      const res = await fetch(url.toString(), {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
      });
      if (!res.ok) {
         console.error(`[email-inbound] Discord post responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
         return null;
      }
      const msg = await res.json().catch(() => null);
      // For a forum thread create, channel_id is the new thread. For a text-channel fallback it is
      // the channel itself (not a real thread) — we still return it, and replies best-effort.
      return msg?.channel_id ?? null;
   } catch (err) {
      console.error('[email-inbound] Discord post failed:', err instanceof Error ? err.message : err);
      return null;
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

   const secret = Deno.env.get('EMAIL_INBOUND_SECRET')?.trim();
   if (!secret) {
      console.error('[email-inbound] EMAIL_INBOUND_SECRET not set — refusing to accept unauthenticated mail');
      return jsonResponse({ error: 'not_configured' }, 500);
   }
   const provided = new URL(req.url).searchParams.get('secret') ?? req.headers.get('x-inbound-secret') ?? '';
   if (!timingSafeEqual(provided, secret)) {
      return jsonResponse({ error: 'unauthorized' }, 401);
   }

   let payload: Record<string, unknown>;
   try {
      payload = await req.json();
   } catch {
      return jsonResponse({ error: 'invalid_json' }, 400);
   }

   // Resend only sends the envelope; fetch the body before parsing.
   payload = await hydrateFromResend(payload);

   const email = parseInbound(payload);
   if (!email) return jsonResponse({ error: 'unparseable_email' }, 400);
   if (email.automated) {
      console.log('[email-inbound] ignored automated mail from', email.fromEmail);
      return jsonResponse({ ok: true, ignored: 'automated' });
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // --- Resolve the conversation this email belongs to -------------------------------------
   // 1) reply+<token>@ address (most reliable), 2) In-Reply-To / References message-ids.
   let conversation: Conversation | null = null;

   const replyToken = findReplyToken(email.toList);
   if (replyToken) {
      const { data } = await supabase
         .from('widget_conversations')
         .select('id, discord_thread_id, reply_token, status')
         .eq('reply_token', replyToken)
         .maybeSingle();
      conversation = (data as Conversation | null) ?? null;
   }

   if (!conversation) {
      const refIds = [email.inReplyTo, ...email.references].filter((x): x is string => !!x);
      if (refIds.length > 0) {
         const { data } = await supabase
            .from('widget_conversations')
            .select('id, discord_thread_id, reply_token, status')
            .in('email_last_message_id', refIds)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();
         conversation = (data as Conversation | null) ?? null;
      }
   }

   const bodyForDiscord =
      email.body.length > DISCORD_DESC_MAX ? `${email.body.slice(0, DISCORD_DESC_MAX)}\n\n… (truncated)` : email.body || '_(empty body)_';

   // --- New ticket ------------------------------------------------------------------------
   if (!conversation) {
      const { data: inserted, error: insertErr } = await supabase
         .from('widget_conversations')
         .insert({
            channel: 'email',
            visitor_email: email.fromEmail,
            visitor_name: email.fromName,
            email_subject: email.subject,
            email_last_message_id: email.messageId,
            status: 'open',
            bot_context: 'Inbound email',
            last_message_at: new Date().toISOString()
         })
         .select('id, discord_thread_id, reply_token, status')
         .single();

      if (insertErr || !inserted) {
         console.error('[email-inbound] failed to create conversation:', insertErr?.message);
         return jsonResponse({ error: 'db_insert_failed' }, 500);
      }

      const threadId = await postToDiscord({
         description: bodyForDiscord,
         fromEmail: email.fromEmail,
         fromName: email.fromName,
         subject: email.subject,
         threadName: `📧 ${cleanSubject(email.subject)} · ${email.fromEmail}`
      });

      if (threadId) {
         await supabase.from('widget_conversations').update({ discord_thread_id: threadId }).eq('id', inserted.id);
      }

      return jsonResponse({
         ok: true,
         conversation_id: inserted.id,
         created: true,
         reply_to: `reply+${inserted.reply_token}@${REPLY_SUBDOMAIN}`,
         discord_thread_id: threadId
      });
   }

   // --- Reply on an existing ticket -------------------------------------------------------
   await supabase
      .from('widget_conversations')
      .update({
         status: 'open', // reopen if it had been resolved
         email_last_message_id: email.messageId,
         last_message_at: new Date().toISOString()
      })
      .eq('id', conversation.id);

   const threadId = await postToDiscord({
      description: bodyForDiscord,
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      subject: email.subject,
      threadName: `📧 ${cleanSubject(email.subject)} · ${email.fromEmail}`,
      threadId: conversation.discord_thread_id
   });

   // If we never had a thread (e.g. the first post failed), backfill whatever id we just got.
   if (!conversation.discord_thread_id && threadId) {
      await supabase.from('widget_conversations').update({ discord_thread_id: threadId }).eq('id', conversation.id);
   }

   return jsonResponse({
      ok: true,
      conversation_id: conversation.id,
      created: false,
      reply_to: `reply+${conversation.reply_token}@${REPLY_SUBDOMAIN}`,
      discord_thread_id: conversation.discord_thread_id ?? threadId
   });
});
