// LEGACY — the bot's webhook moved to telegram-webhook on 2026-09-29. This endpoint stays only so an
// old setWebhook doesn't 404, and it does NOTHING: the old handler had no secret check, so anyone could
// POST a fake "/start <user id>" and re-point that user's Telegram notifications to their own chat.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(() => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
