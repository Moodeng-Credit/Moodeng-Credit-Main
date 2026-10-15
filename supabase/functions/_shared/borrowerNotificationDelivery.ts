import { sendEmail } from './email.ts';
import {
   buildLoanNotificationEmail,
   buildLoanNotificationTelegram,
   LoanNotificationAggregate,
   LoanNotificationLoan,
   LoanNotificationRecipient,
   LoanNotificationType
} from './loanNotifications.ts';
import { sendPushToUser } from './pushDelivery.ts';
import {
   buildDuePushPayload,
   buildFundedPushPayload,
   buildRepaymentReceivedPushPayload,
   buildRequestExpiredPushPayload,
   type PushLocale,
   type PushPayload
} from './pushMessages.ts';
import { type MessengerCard, sendMessengerMessage, sendWhatsAppTemplate, type WhatsAppTemplate } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// WhatsApp reminders: the Meta-approved Utility templates (created in SendPulse → WhatsApp bot →
// Templates). Every template takes the same three body variables: {{1}} name, {{2}} amount in USDC,
// {{3}} when: "tomorrow" / "today" for the due ones, how late for overdue ("2 days", read as
// "… is overdue (2 days late)"), and has a static "Repay now" URL button to https://moodeng.app/repay.
// "Due in 3 days" gets no WhatsApp: push, email and Messenger cover it, and every message costs money.
export const WHATSAPP_REMINDER_TEMPLATES: Partial<Record<LoanNotificationType, string>> = {
   final_reminder: 'moodeng_due_tomorrow',
   due_today: 'moodeng_due_today',
   overdue: 'moodeng_overdue'
};

// Kill switch, starts 'false': WhatsApp only goes out once the templates are approved and someone turns
// it on (telegram_bot_settings, like the Telegram one).
export const BORROWER_WHATSAPP_SETTING_KEY = 'borrower_whatsapp_enabled';

export const buildWhatsAppReminderTemplate = (
   type: LoanNotificationType,
   recipient: LoanNotificationRecipient,
   aggregate: LoanNotificationAggregate | undefined
): WhatsAppTemplate | null => {
   const name = WHATSAPP_REMINDER_TEMPLATES[type];
   if (!name || !aggregate) return null;
   // The overdue job's label is "N day(s)", or "overdue" when it has no deadline to measure from.
   const lateBy = aggregate.dueLabel && aggregate.dueLabel !== 'overdue' ? aggregate.dueLabel : 'a little';
   const when = type === 'due_today' ? 'today' : type === 'final_reminder' ? 'tomorrow' : lateBy;
   return {
      name,
      language: { code: 'en' },
      components: [
         {
            type: 'body',
            parameters: [
               { type: 'text', text: recipient.username?.trim() || 'there' },
               { type: 'text', text: formatUsdcAmount(aggregate.totalAmount) },
               { type: 'text', text: when }
            ]
         }
      ]
   };
};

/** Telegram/LINE/phone sign-ups get a placeholder address nobody reads (telegram_<id>@moodeng.app, line_<id>@…, phone_<id>@…). */
export const isPlaceholderEmail = (email: string | null | undefined): boolean =>
   /^(telegram|line|phone)_[^@]+@moodeng\.(app|credit)$/i.test((email ?? '').trim());

export type BorrowerNotificationDeliveryResult = {
   emailSent: boolean;
   telegramSent: boolean;
   pushSent: boolean;
   messengerSent: boolean;
   whatsappSent: boolean;
};

const REMINDER_TYPES: LoanNotificationType[] = ['urgent_reminder', 'final_reminder', 'due_today', 'overdue'];

const formatUsdcAmount = (value: number | string | null | undefined) =>
   toNumber(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatDueDate = (value: string | null | undefined) =>
   value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;

// The "Welcome to the community, Moo-borrower!" poster, sent with a borrower's FIRST funded loan (George,
// 2026-10-13). Served from the app's public folder; square so Messenger's card doesn't crop it.
export const MOO_BORROWER_POSTER_URL = `${(Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '')}/messenger/moo-borrower-welcome.jpg`;

/** What goes to Messenger for this notification type, or null for the types we don't send there. */
export const buildMessengerContent = (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   aggregate: LoanNotificationAggregate | undefined,
   { firstLoan = false }: { firstLoan?: boolean } = {}
): { text: string; card?: MessengerCard } | null => {
   if (type === 'funded' && loan) {
      const dashboardUrl = buildPushPayloadForType('funded', loan, aggregate, 'en')?.url;
      const due = formatDueDate(loan.due_date);
      const repay = toNumber(loan.total_repayment_amount) > 0 ? `Repay ${formatUsdcAmount(loan.total_repayment_amount)} USDC` : 'Repay on time';
      if (firstLoan) {
         return {
            text:
               `🎉 Welcome to the community, Moo-borrower! Your first loan is funded: ${formatUsdcAmount(loan.loan_amount)} USDC has been sent to your wallet.\n\n` +
               `${repay}${due ? ` by ${due}` : ''} to build your record and level up to bigger loans. We're cheering for you! 🦛`,
            card: {
               title: 'Welcome, Moo-borrower! 🎉',
               subtitle: 'Your first loan is funded. Repay on time to level up.',
               imageUrl: MOO_BORROWER_POSTER_URL,
               button: { title: 'Open Moodeng', url: dashboardUrl ?? 'https://moodeng.app' }
            }
         };
      }
      return {
         text:
            `🎉 Great news, your loan is funded! ${formatUsdcAmount(loan.loan_amount)} USDC has been sent to your wallet.\n\n` +
            `${repay}${due ? ` by ${due}` : ''} to build your repayment record. Tip: borrow your full limit and repay it to unlock bigger loans.`,
         ...(dashboardUrl ? { card: { title: 'Your loan is funded', button: { title: 'Open Moodeng', url: dashboardUrl } } } : {})
      };
   }

   if (REMINDER_TYPES.includes(type)) {
      const payload = buildPushPayloadForType(type, loan, aggregate, 'en');
      return payload
         ? { text: `${payload.title}\n${payload.body}`, card: { title: 'Repay on Moodeng Credit', button: { title: 'Repay now', url: payload.url } } }
         : null;
   }

   return null;
};

/** True when no earlier funded (non-test) loan exists for this borrower. */
export const isFirstFundedLoan = async (supabase: any, loan: LoanNotificationLoan): Promise<boolean> => {
   if (!loan.borrower_user_id || !loan.funded_at) return false;
   const { count, error } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('borrower_user_id', loan.borrower_user_id)
      .eq('loan_status', 'Lent')
      .eq('is_test', false)
      .lt('funded_at', loan.funded_at);
   if (error) throw error;
   return (count ?? 0) === 0;
};

const toNumber = (value: number | string | null | undefined) => {
   const amount = Number(value ?? 0);
   return Number.isFinite(amount) ? amount : 0;
};

/**
 * Maps a loan notification onto its push payload, or null for the types that
 * have no business interrupting someone's lock screen (the weekly digest and the
 * internal team feed).
 *
 * The due/overdue reminders need the aggregate — a borrower with three loans
 * closing on the same day should get one notification naming the combined
 * amount, not three that each look like the whole debt.
 */
const buildPushPayloadForType = (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   aggregate: LoanNotificationAggregate | undefined,
   locale: PushLocale
): PushPayload | null => {
   switch (type) {
      case 'final_reminder':
      case 'urgent_reminder':
      case 'due_today':
      case 'overdue': {
         if (!aggregate) {
            return null;
         }
         return buildDuePushPayload(
            type,
            { loanCount: aggregate.count, totalAmount: aggregate.totalAmount, dueLabel: aggregate.dueLabel ?? '' },
            locale
         );
      }
      case 'funded':
         return buildFundedPushPayload({ amount: toNumber(loan?.loan_amount ?? aggregate?.totalAmount) }, locale);
      case 'repayment_received':
         return buildRepaymentReceivedPushPayload(
            { amount: toNumber(loan?.repaid_amount ?? loan?.total_repayment_amount ?? aggregate?.totalAmount) },
            locale
         );
      case 'request_expired':
         return buildRequestExpiredPushPayload(locale);
      default:
         return null;
   }
};

export const getTelegramBotSettingEnabled = async (supabase: any, key: string) => {
   const { data, error } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();

   if (error) {
      throw new Error(error.message);
   }

   return data?.value === 'true';
};

export const getBorrowerTelegramNotificationsEnabled = async (supabase: any) =>
   getTelegramBotSettingEnabled(supabase, 'borrower_notifications_enabled');

export const sendBorrowerLoanNotification = async (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   recipient: LoanNotificationRecipient,
   aggregate?: LoanNotificationAggregate,
   options: {
      telegramEnabled: boolean;
      /** If false the notification is suppressed entirely for this recipient */
      notifEnabled?: boolean;
      /**
       * Supply both to also deliver over Web Push. Omitted by callers that have
       * no Supabase client to hand, in which case behaviour is unchanged.
       */
      push?: { supabase: any; userId: string };
   } = { telegramEnabled: false }
): Promise<BorrowerNotificationDeliveryResult> => {
   // If the user has opted out of this notification category, skip silently
   if (options.notifEnabled === false) {
      return { emailSent: false, telegramSent: false, pushSent: false, messengerSent: false, whatsappSent: false };
   }

   let whatsappSent = false;
   let emailSent = false;
   let telegramSent = false;
   let pushSent = false;
   let messengerSent = false;
   // Telegram/LINE sign-ups get a placeholder address (telegram_<id>@moodeng.app, line_<id>@…) that
   // nobody reads: mailing it bounces, hurts the domain's reputation, and wrongly counted as "delivered".
   const rawEmail = recipient.email?.trim();
   const recipientEmail = rawEmail && !isPlaceholderEmail(rawEmail) ? rawEmail : undefined;
   const telegramActionLabel =
      type === 'request_expired'
         ? 'Contact Support'
         : type === 'weekly_digest' || type === 'repayment_received'
           ? 'Open Dashboard'
           : 'Open Repay';

   // Each channel is attempted independently: a broken email provider (e.g. a revoked Resend key)
   // must not stop the Telegram and push copies going out. Only when nothing at all was delivered
   // does the first channel error propagate, so callers still see a hard failure.
   let firstError: unknown = null;

   if (recipientEmail) {
      try {
         const { subject, text, html } = buildLoanNotificationEmail(type, loan, recipient, aggregate);
         await sendEmail(recipientEmail, subject, text, html);
         emailSent = true;
      } catch (error) {
         firstError = error;
         console.error('Borrower email notification failed', {
            type,
            error: error instanceof Error ? error.message : String(error)
         });
      }
   }

   if (options.telegramEnabled && recipient.chat_id) {
      try {
         const { text, actionUrl } = buildLoanNotificationTelegram(type, loan, recipient, aggregate);
         await sendTelegramMessage(recipient.chat_id, text, {
            inlineKeyboard: [
               [
                  {
                     text: telegramActionLabel,
                     url: actionUrl
                  }
               ]
            ]
         });
         telegramSent = true;
      } catch (error) {
         console.error('Borrower Telegram notification failed', {
            type,
            chat_id: recipient.chat_id,
            error: error instanceof Error ? error.message : String(error)
         });
         firstError = firstError ?? error;
      }
   }

   // `buildPushPayloadForType` returns null for the types that get no push (and
   // for a due reminder with no aggregate), so probe once before fanning out.
   const hasPushCopy = buildPushPayloadForType(type, loan, aggregate, 'en') !== null;

   // Push is additive: it never blocks or fails the email/Telegram result, and a
   // recipient with no registered device simply gets nothing here.
   if (options.push && recipient.notif_push !== false && hasPushCopy) {
      try {
         const result = await sendPushToUser(
            options.push.supabase,
            options.push.userId,
            (locale) => buildPushPayloadForType(type, loan, aggregate, locale) as PushPayload,
            { urgency: type === 'overdue' || type === 'final_reminder' ? 'high' : 'normal' }
         );
         pushSent = result.sent > 0;
      } catch (error) {
         console.error('Borrower push notification failed', {
            type,
            error: error instanceof Error ? error.message : String(error)
         });
      }
   }

   // Messenger, for borrowers who confirmed their Facebook with the Page. Messenger only allows
   // free-form messages within 24h of the borrower's last message to the Page, so this lands only
   // for someone who wrote to us recently (sendMessengerMessage checks and skips otherwise). Like
   // push, it's additive and never fails the other channels.
   // First funded loan → the Moo-borrower welcome (poster card) instead of the plain funded message.
   const firstLoan =
      type === 'funded' && recipient.messenger_psid && options.push?.supabase && loan
         ? await isFirstFundedLoan(options.push.supabase, loan).catch(() => false)
         : false;
   const messengerContent = recipient.messenger_psid ? buildMessengerContent(type, loan, aggregate, { firstLoan }) : null;
   if (recipient.messenger_psid && messengerContent) {
      const result = await sendMessengerMessage(recipient.messenger_psid, messengerContent);
      messengerSent = result.ok;
      // Every outcome is logged, so "did the bot tell them?" is one log search (kryshia's funded
      // message on 2026-10-01 was skipped with no trace).
      console.log(`[borrowerNotification] Messenger "${type}" for ${loan?.tracking_id ?? '?'} → ${result.ok ? 'sent' : `not sent (${result.reason})`}`);
   } else if (messengerContent) {
      console.log(`[borrowerNotification] Messenger "${type}" for ${loan?.tracking_id ?? '?'} → not sent (no Facebook connected)`);
   }

   // WhatsApp, for borrowers who opted in by sending their code to our business number (usually because
   // notifications can't work on their phone, e.g. Facebook's in-app browser). Push goes first: "due
   // tomorrow" only goes to WhatsApp when no push landed; "due today" and "overdue" go to both, since
   // those are the ones that matter. Off until the kill switch is on (templates approved). Additive,
   // like push and Messenger: never fails the other channels.
   const whatsappTemplate =
      recipient.whatsapp_contact_id && recipient.notif_whatsapp !== false && options.push?.supabase
         ? buildWhatsAppReminderTemplate(type, recipient, aggregate)
         : null;
   if (whatsappTemplate && !(type === 'final_reminder' && pushSent)) {
      const enabled = await getTelegramBotSettingEnabled(options.push!.supabase, BORROWER_WHATSAPP_SETTING_KEY).catch(() => false);
      if (enabled) {
         const result = await sendWhatsAppTemplate(recipient.whatsapp_contact_id, whatsappTemplate);
         whatsappSent = result.ok;
         console.log(`[borrowerNotification] WhatsApp "${type}" (${whatsappTemplate.name}) → ${result.ok ? 'sent' : `not sent (${result.reason})`}`);
      }
   }

   if (firstError && !emailSent && !telegramSent && !pushSent && !messengerSent && !whatsappSent) {
      throw firstError;
   }

   return { emailSent, telegramSent, pushSent, messengerSent, whatsappSent };
};
