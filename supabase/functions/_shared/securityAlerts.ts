// Phase 3 of the fraud-detection masterplan: ONE delivery layer for every security
// alert. The fraud scan, the risk-score engine, the heartbeat, and the Phase 4
// real-time checks all hand a SecurityAlert to deliverSecurityAlert(), which owns:
//   - destination resolution (env → fraud_alert_chat_id → kyc_alert_chat_id),
//   - the severity emoji + [source] prefix (one consistent format everywhere),
//   - the channel matrix (Discord #security always; Telegram only for high/critical, since the
//     team group is where loans arrive and routine alerts there read like a new loan; email for
//     severity ≥ warning OR when no chat channel got it, so nothing is ever silently lost —
//     masterplan §2.1 fail-loud),
//   - recording every attempt in public.security_alert_deliveries.
//
// The formatting + matrix helpers are PURE (no Deno.* at module top) so vitest can
// cover them; deliverSecurityAlert is the thin I/O wrapper (masterplan §2.8).
import { type DiscordEmbed, postDiscord } from './discord.ts';
import { sendEmail } from './email.ts';
import { sendTelegramMessage } from './telegram.ts';

export type SecuritySource = 'fraud-scan' | 'risk-score' | 'realtime' | 'heartbeat' | 'kyc';
export type SecuritySeverity = 'critical' | 'high' | 'warning' | 'info';

export type SecurityAlert = {
   source: SecuritySource;
   severity: SecuritySeverity;
   title: string; // one line, no emoji (the dispatcher adds the severity emoji)
   body: string; // plain text detail
};

export type SecurityDeliveryRecord = {
   source: SecuritySource;
   severity: SecuritySeverity;
   title: string;
   discord_ok: boolean;
   telegram_ok: boolean;
   email_ok: boolean;
   error: string | null;
};

// deno-lint-ignore no-explicit-any
type SecuritySupabase = { from: (table: string) => any };

// Masterplan §2.6 severity taxonomy — used everywhere, including message prefixes.
const SEVERITY_EMOJI: Record<SecuritySeverity, string> = {
   critical: '🔴',
   high: '🟠',
   warning: '🟡',
   info: 'ℹ️'
};

const SEVERITY_RANK: Record<SecuritySeverity, number> = {
   info: 0,
   warning: 1,
   high: 2,
   critical: 3
};

export const severityEmoji = (severity: SecuritySeverity): string => SEVERITY_EMOJI[severity] ?? 'ℹ️';

// Telegram body: «emoji» [source] title\n\nbody
// Telegram rejects messages over 4096 characters ("message is too long"), which silently dropped a
// 36-signal fraud scan on 2026-09-23. Trim the body with a pointer to the email, which always carries
// the full text (email is sent whenever the alert is a warning or worse).
const TELEGRAM_MAX_CHARS = 4096;

export const formatTelegramMessage = (alert: SecurityAlert): string => {
   const full = `${severityEmoji(alert.severity)} [${alert.source}] ${alert.title}\n\n${alert.body}`;
   if (full.length <= TELEGRAM_MAX_CHARS) return full;
   const note = '\n\n… (truncated — full details in the alert email)';
   return full.slice(0, TELEGRAM_MAX_CHARS - note.length) + note;
};

// Email subject: «emoji» Moodeng [source]: title
export const formatEmailSubject = (alert: SecurityAlert): string =>
   `${severityEmoji(alert.severity)} Moodeng [${alert.source}]: ${alert.title}`;

// Channel matrix. Discord #security gets everything. Telegram (the team group, where new loans
// land) only gets what needs someone now: high and critical. Email is the redundant channel —
// sent for anything at least a warning, OR whenever no chat channel got it through, so a delivery
// failure can never be fully silent.
export const shouldTelegram = (severity: SecuritySeverity): boolean => SEVERITY_RANK[severity] >= SEVERITY_RANK.high;

export const shouldEmail = (severity: SecuritySeverity, chatDelivered: boolean): boolean =>
   SEVERITY_RANK[severity] >= SEVERITY_RANK.warning || !chatDelivered;

const SEVERITY_COLOR: Record<SecuritySeverity, number> = {
   critical: 0xdc2626,
   high: 0xea580c,
   warning: 0xeab308,
   info: 0x6b7280
};

// Discord embed: same «emoji» [source] title, body in the description (Discord caps it at 4096).
export const formatDiscordEmbed = (alert: SecurityAlert): DiscordEmbed => {
   const description =
      alert.body.length > 4000 ? `${alert.body.slice(0, 3960)}\n… (truncated — full details in the alert email)` : alert.body;
   return {
      title: `${severityEmoji(alert.severity)} [${alert.source}] ${alert.title}`.slice(0, 256),
      description,
      color: SEVERITY_COLOR[alert.severity],
      timestamp: new Date().toISOString()
   };
};

// Destination resolution, shared by every caller: env override, then the
// fraud_alert_chat_id setting (seeded from the KYC group), then kyc_alert_chat_id.
export const resolveSecurityChatId = async (supabase: SecuritySupabase): Promise<string | undefined> => {
   const fromEnv = Deno.env.get('FRAUD_ALERT_TELEGRAM_CHAT_ID')?.trim();
   if (fromEnv) return fromEnv;

   const { data } = await supabase
      .from('telegram_bot_settings')
      .select('key, value')
      .in('key', ['fraud_alert_chat_id', 'kyc_alert_chat_id']);
   const settings = (data ?? []) as Array<{ key: string; value?: string | null }>;
   const byKey = (key: string) => settings.find((s) => s.key === key)?.value?.trim();
   return byKey('fraud_alert_chat_id') || byKey('kyc_alert_chat_id') || undefined;
};

const alertEmailRecipient = (): string => Deno.env.get('FRAUD_ALERT_EMAIL')?.trim() || 'georgemlerner@gmail.com';

// The one delivery entrypoint. Never throws — a delivery/ledger failure must not
// crash the job that raised the alert. Returns the recorded delivery outcome.
export const deliverSecurityAlert = async (supabase: SecuritySupabase, alert: SecurityAlert): Promise<SecurityDeliveryRecord> => {
   const errors: string[] = [];
   let discordOk = false;
   let telegramOk = false;
   let emailOk = false;

   // --- Discord #security (always) ---
   discordOk = await postDiscord({ embeds: [formatDiscordEmbed(alert)] }, { prefer: ['DISCORD_SECURITY_WEBHOOK_URL'] });
   if (!discordOk) errors.push('discord: post failed or DISCORD_SECURITY_WEBHOOK_URL not set');

   // --- Telegram (high / critical only) ---
   if (shouldTelegram(alert.severity)) {
      try {
         const chatId = await resolveSecurityChatId(supabase);
         if (chatId) {
            await sendTelegramMessage(chatId, formatTelegramMessage(alert));
            telegramOk = true;
         } else {
            errors.push('telegram: no fraud_alert_chat_id (or kyc_alert_chat_id) configured');
         }
      } catch (err) {
         errors.push(`telegram: ${err instanceof Error ? err.message : String(err)}`);
      }
   }

   // --- Email (severity ≥ warning, or no chat channel got it) ---
   if (shouldEmail(alert.severity, discordOk || telegramOk)) {
      try {
         await sendEmail(alertEmailRecipient(), formatEmailSubject(alert), alert.body);
         emailOk = true;
      } catch (err) {
         errors.push(`email: ${err instanceof Error ? err.message : String(err)}`);
      }
   }

   const record: SecurityDeliveryRecord = {
      source: alert.source,
      severity: alert.severity,
      title: alert.title,
      discord_ok: discordOk,
      telegram_ok: telegramOk,
      email_ok: emailOk,
      error: errors.length ? errors.join(' | ') : null
   };

   // Record the attempt. Never let a ledger failure surface to the caller.
   try {
      await supabase.from('security_alert_deliveries').insert(record);
   } catch (err) {
      console.error('[securityAlerts] failed to record delivery:', err instanceof Error ? err.message : err);
   }

   return record;
};
