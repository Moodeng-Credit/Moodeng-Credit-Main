import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { type Channel, deliverToPerson, EMAIL_GAP_MS, loadFirstNames, type Outcome, type SendStatus } from '../_shared/campaignDelivery.ts';
import { postDiscord } from '../_shared/discord.ts';
import { AUTOMATION_ID, loadJourney, planComeback } from '../_shared/comebackJourney.ts';
import { isInternalRequest } from '../_shared/internalAuth.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// The automatic journeys (Admin → Campaigns → Automations). pg_cron calls { action: 'run' } daily at
// 10:00 Manila (migration 20261010100000_campaign_automations.sql). Scheduler only.
//
// Today: "Repaid → come back" — see _shared/comebackJourney.ts for who's due. Does nothing while the
// journey is switched off. Every send is claimed per (step, person, repayment, channel) first, so a
// re-run the same day never double-sends. Posts a one-line summary to the admin Telegram + Discord
// when anyone was reached.

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// One run stays well inside the function time limit (email is ~0.6 s per person).
const MAX_PER_RUN = 100;

// The admins-only KYC channel, falling back to the team channel (same as _shared/loanAccess.ts).
// deno-lint-ignore no-explicit-any
const getAdminChatId = async (svc: any): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('key, value').in('key', ['kyc_alert_chat_id', 'team_group_chat_id']);
   const byKey = new Map<string, string>(((data ?? []) as Array<{ key: string; value: string }>).map((row) => [row.key, row.value]));
   return byKey.get('kyc_alert_chat_id') || Deno.env.get('TEAM_TELEGRAM_CHAT_ID') || byKey.get('team_group_chat_id') || null;
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
   const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false }
   });
   if (!(await isInternalRequest(svc, req))) return json({ error: 'unauthorized' }, 401);

   try {
      const { automation, steps } = await loadJourney(svc);
      if (!automation?.enabled) return json({ ok: true, ran: false, reason: 'switched_off' });

      const { due, capped } = await planComeback(svc, steps);
      const batch = due.slice(0, MAX_PER_RUN);
      const names = await loadFirstNames(svc, batch.map((d) => d.person.user_id));

      const outcomes: Array<Outcome & { step: number }> = [];
      let first = true;
      for (const { person, step } of batch) {
         const row = { automation_id: AUTOMATION_ID, step: step.step, user_id: person.user_id, cycle_key: person.cycle_key };
         const claim = async (_userId: string, channel: Channel) => {
            const { data } = await svc
               .from('admin_automation_sends')
               .upsert({ ...row, channel, status: 'pending' }, { onConflict: 'automation_id,step,user_id,cycle_key,channel', ignoreDuplicates: true })
               .select('id');
            if (data?.length) return true;
            // A failed earlier attempt is retried; a sent / skipped / in-flight one is not.
            const { data: retry } = await svc
               .from('admin_automation_sends')
               .update({ status: 'pending', detail: null })
               .match({ ...row, channel, status: 'failed' })
               .select('id');
            return Boolean(retry?.length);
         };
         const finish = async (_userId: string, channel: Channel, status: SendStatus, detail?: string) => {
            await svc.from('admin_automation_sends').update({ status, detail: detail ?? null }).match({ ...row, channel });
         };

         if (!first) await sleep(EMAIL_GAP_MS);
         first = false;
         const firstName = names.get(person.user_id) || person.display_name?.trim() || 'there';
         const result = await deliverToPerson(
            svc,
            person,
            firstName,
            { subject: step.subject, message: step.message, pushTag: `comeback-${step.step}` },
            { claim, finish }
         );
         outcomes.push(...result.map((o) => ({ ...o, step: step.step })));
      }

      const sent = (channel: Channel) => outcomes.filter((o) => o.channel === channel && o.status === 'sent').length;
      const reached = new Set(outcomes.filter((o) => o.status === 'sent').map((o) => o.userId)).size;
      const failed = outcomes.filter((o) => o.status === 'failed').length;
      const summary = {
         ok: true,
         ran: true,
         due: due.length,
         capped: capped.length,
         reached,
         messenger: sent('messenger'),
         email: sent('email'),
         push: sent('push'),
         failed
      };

      if (reached || failed) {
         const text = [
            `🤖 ${automation.name}: reached ${reached} ${reached === 1 ? 'borrower' : 'borrowers'} (Messenger ${summary.messenger} · Email ${summary.email} · Push ${summary.push})`,
            failed ? `⚠️ ${failed} send${failed === 1 ? '' : 's'} failed — retried tomorrow.` : null,
            capped.length ? `${capped.length} waiting for the weekly limit.` : null,
            'Admin → Campaigns → Automations for who got what.'
         ]
            .filter(Boolean)
            .join('\n');
         try {
            const chat = await getAdminChatId(svc);
            if (chat) await sendTelegramMessage(chat, text);
         } catch (err) {
            console.error('campaign-automations: telegram summary failed', err instanceof Error ? err.message : err);
         }
         await postDiscord({ content: text }, { prefer: ['DISCORD_TEAM_WEBHOOK_URL'] });
      }
      return json(summary);
   } catch (err) {
      console.error('campaign-automations failed:', err instanceof Error ? err.message : err);
      return json({ ok: false, error: 'internal_error' }, 500);
   }
});
