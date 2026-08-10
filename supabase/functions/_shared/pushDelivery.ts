// Fan-out layer between the edge functions and the raw Web Push transport.
//
// Responsibilities: load a user's registered devices, render the copy in each
// device's own locale, send in parallel, and keep the subscription table clean.
// Everything here is best-effort by design — push is an additive channel on top
// of email/Telegram, so a dead device or an unconfigured VAPID key must never
// fail the notification run that called it.

import { getVapidKeysFromEnv, sendWebPush, type PushSubscriptionKeys } from './webPush.ts';
import { resolvePushLocale, type PushLocale, type PushPayload } from './pushMessages.ts';

type SupabaseClient = any;

export type PushSubscriptionRow = PushSubscriptionKeys & {
   id: string;
   user_id: string;
   locale: string | null;
};

export type PushFanoutResult = {
   sent: number;
   failed: number;
   pruned: number;
   /** True when push is unconfigured or switched off — callers can log and move on. */
   skipped: boolean;
};

const EMPTY_RESULT: PushFanoutResult = { sent: 0, failed: 0, pruned: 0, skipped: true };

export const isPushConfigured = () => getVapidKeysFromEnv() !== null;

export const loadPushSubscriptions = async (
   supabase: SupabaseClient,
   userIds: string[]
): Promise<Map<string, PushSubscriptionRow[]>> => {
   const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
   if (!uniqueIds.length) {
      return new Map();
   }

   const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, locale')
      .in('user_id', uniqueIds);

   if (error) {
      // A push lookup failure is not worth aborting an email run over.
      console.error('Failed to load push subscriptions', error.message);
      return new Map();
   }

   const byUser = new Map<string, PushSubscriptionRow[]>();
   for (const row of (data ?? []) as PushSubscriptionRow[]) {
      const existing = byUser.get(row.user_id) ?? [];
      existing.push(row);
      byUser.set(row.user_id, existing);
   }

   return byUser;
};

const pruneSubscriptions = async (supabase: SupabaseClient, ids: string[]) => {
   if (!ids.length) {
      return;
   }

   const { error } = await supabase.from('push_subscriptions').delete().in('id', ids);
   if (error) {
      console.error('Failed to prune expired push subscriptions', error.message);
   }
};

const markDelivered = async (supabase: SupabaseClient, ids: string[]) => {
   if (!ids.length) {
      return;
   }

   const { error } = await supabase
      .from('push_subscriptions')
      .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
      .in('id', ids);

   if (error) {
      console.error('Failed to record push delivery', error.message);
   }
};

/**
 * Sends one notification to every device a set of subscriptions represents.
 *
 * `buildPayload` is called per device rather than per user so each device gets
 * copy in the locale it subscribed with — the same person may have a Tagalog
 * phone and an English laptop.
 */
export const sendPushToSubscriptions = async (
   supabase: SupabaseClient,
   subscriptions: PushSubscriptionRow[],
   buildPayload: (locale: PushLocale) => PushPayload,
   options: { urgency?: 'very-low' | 'low' | 'normal' | 'high'; ttlSeconds?: number } = {}
): Promise<PushFanoutResult> => {
   const keys = getVapidKeysFromEnv();

   if (!keys) {
      console.warn('Push skipped: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set.');
      return { ...EMPTY_RESULT };
   }

   if (!subscriptions.length) {
      return { sent: 0, failed: 0, pruned: 0, skipped: false };
   }

   const results = await Promise.all(
      subscriptions.map(async (subscription) => {
         const payload = buildPayload(resolvePushLocale(subscription.locale));
         const result = await sendWebPush(subscription, JSON.stringify(payload), {
            keys,
            urgency: options.urgency ?? 'high',
            ttlSeconds: options.ttlSeconds
         });

         if (!result.ok && !result.expired) {
            console.error('Push delivery failed', {
               subscriptionId: subscription.id,
               status: result.status,
               error: result.error
            });
         }

         return { subscription, result };
      })
   );

   const expiredIds = results.filter((entry) => entry.result.expired).map((entry) => entry.subscription.id);
   const deliveredIds = results.filter((entry) => entry.result.ok).map((entry) => entry.subscription.id);

   await pruneSubscriptions(supabase, expiredIds);
   await markDelivered(supabase, deliveredIds);

   return {
      sent: deliveredIds.length,
      failed: results.length - deliveredIds.length - expiredIds.length,
      pruned: expiredIds.length,
      skipped: false
   };
};

/** Convenience wrapper for the single-user case. */
export const sendPushToUser = async (
   supabase: SupabaseClient,
   userId: string,
   buildPayload: (locale: PushLocale) => PushPayload,
   options: { urgency?: 'very-low' | 'low' | 'normal' | 'high'; ttlSeconds?: number } = {}
): Promise<PushFanoutResult> => {
   const byUser = await loadPushSubscriptions(supabase, [userId]);
   return sendPushToSubscriptions(supabase, byUser.get(userId) ?? [], buildPayload, options);
};
