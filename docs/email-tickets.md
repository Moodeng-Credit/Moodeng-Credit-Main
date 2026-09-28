# Email → support tickets

Inbound email to **support@moodeng.app** is mirrored into the same `widget_conversations`
ticket model the live chat uses (a row + a Discord `#web-support` thread), so email and in-app
chat land in one place. The customer only ever sees **support@moodeng.app**.

## Why this shape

support@moodeng.app is on **Namecheap Private Email** (IMAP/SMTP only — no REST API). Polling
IMAP from a Supabase edge function is a poor fit (Deno Deploy socket model), so inbound mail is
**forwarded into a webhook** (Resend Inbound or a Cloudflare Email Worker) that POSTs the parsed
message to the `email-inbound` edge function. The real mailbox and the domain's MX are untouched;
we only add a `reply.moodeng.app` subdomain for the webhook + reply routing.

```
customer ──email──▶ support@moodeng.app (PrivateEmail)
                          │ forward
                          ▼
        inbound@reply.moodeng.app (Resend Inbound / Cloudflare)
                          │ webhook POST ?secret=…
                          ▼
        edge fn: email-inbound  ──▶ widget_conversations row (channel='email')
                          │                 └─ reply_token, email_last_message_id
                          ▼
        Discord #web-support thread  ◀── team reads & replies
                          │ (widget repo relay)
                          ▼
        Resend send  ──email──▶ customer   (From: support@, Reply-To: reply+<token>@…)
```

## What's in this repo (done)

- **Migration** `20260928120000_email_tickets.sql` — adds `channel`, `reply_token`,
  `email_subject`, `email_last_message_id` to `widget_conversations` (+ indexes). Applied to prod.
- **Edge function** `supabase/functions/email-inbound/` — the inbound half. Verifies a shared
  secret, parses the email, finds-or-creates the conversation, and posts into Discord (creating a
  forum thread on first contact, appending on replies). Deployed to prod (`verify_jwt=false`).

## One-time setup (external — dashboards, not code)

1. **Supabase → Edge Functions → Secrets**
   - `EMAIL_INBOUND_SECRET` = the shared secret used in the webhook URL's `?secret=`.
   - *(optional)* `DISCORD_WEBSUPPORT_WEBHOOK_URL` = a webhook on the `#web-support` forum. If
     unset, tickets fall back to `DISCORD_TEAM_WEBHOOK_URL` (already configured).
   - *(optional)* `EMAIL_REPLY_DOMAIN` = reply subdomain (default `reply.moodeng.app`).

2. **Inbound provider** (pick one), on subdomain `reply.moodeng.app`:
   - **Resend Inbound** — add `reply.moodeng.app`, set the MX records it gives you, point its
     inbound endpoint at the function URL below.
   - **Cloudflare Email Routing** — enable on `reply.moodeng.app`, route to an Email Worker that
     `fetch()`es the function URL.

3. **PrivateEmail** — forward `support@moodeng.app` → `inbound@reply.moodeng.app` (keep a copy in
   the mailbox as a fallback if the webhook is ever down).

Function URL:
```
https://qplmmxynzxzkfxtayoqr.supabase.co/functions/v1/email-inbound?secret=<EMAIL_INBOUND_SECRET>
```

Smoke test (after the secret is set, before DNS):
```bash
curl -X POST "https://qplmmxynzxzkfxtayoqr.supabase.co/functions/v1/email-inbound?secret=<SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"from":"Jane <jane@example.com>","to":"support@moodeng.app","subject":"Test","text":"hi","headers":{"message-id":"<t1@example.com>"}}'
# → {"ok":true,"created":true,...}  and a #web-support post
```

## Outbound relay — TODO in the widget repo (`web-iota-sage-38`)

The team's reply typed in a `#web-support` Discord thread must go back out as an **email** for
`channel='email'` conversations. Add this where the widget currently relays a Discord reply to the
browser. Everything it needs (`reply_token`, `email_last_message_id`, `visitor_email`,
`email_subject`) is already on the row.

```ts
// widget repo — called from the Discord reply handler with the resolved conversation + reply text.
// Requires RESEND_API_KEY (already used for outbound) and EMAIL_REPLY_DOMAIN (default below).
async function relayReplyToEmail(
  supabase: SupabaseClient,
  conversation: {
    id: string;
    visitor_email: string | null;
    email_subject: string | null;
    reply_token: string;
    email_last_message_id: string | null;
  },
  replyText: string
): Promise<void> {
  if (!conversation.visitor_email) return;

  const replyDomain = process.env.EMAIL_REPLY_DOMAIN?.trim() || 'reply.moodeng.app';
  const subject = conversation.email_subject
    ? (/^\s*re:/i.test(conversation.email_subject) ? conversation.email_subject : `Re: ${conversation.email_subject}`)
    : 'Re: your message to Moodeng Credit';

  // A Message-ID we own, so the customer's next reply threads (In-Reply-To) back to us.
  const outMessageId = `<${crypto.randomUUID()}@${replyDomain}>`;
  const refs = conversation.email_last_message_id
    ? `${conversation.email_last_message_id} ${outMessageId}`
    : outMessageId;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'Moodeng Credit <support@moodeng.app>',
      to: [conversation.visitor_email],
      reply_to: `reply+${conversation.reply_token}@${replyDomain}`,
      subject,
      text: replyText,
      headers: {
        'Message-ID': outMessageId,
        ...(conversation.email_last_message_id ? { 'In-Reply-To': conversation.email_last_message_id } : {}),
        References: refs
      }
    })
  });
  if (!res.ok) throw new Error(`Resend send failed: ${await res.text()}`);

  await supabase
    .from('widget_conversations')
    .update({ email_last_message_id: outMessageId, last_emailed_at: new Date().toISOString() })
    .eq('id', conversation.id);
}
```

Also: for `channel='email'` conversations the widget should skip the "open a browser socket" path
(there is no live visitor page). Look the conversation up by `discord_thread_id` in the reply
handler and branch on `channel`.
```
