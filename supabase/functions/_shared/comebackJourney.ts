// The "Repaid → come back" journey (migration 20261010100000_campaign_automations.sql): which step,
// if any, each borrower is due today. Used by campaign-automations (to send) and admin-campaigns
// (to show who's due).
//
// Rules:
//   * a step is due inside its own week: delay_days ≤ days since repayment < delay_days + 7
//     (someone who repaid long ago never gets an old step);
//   * each step at most once per repayment ("cycle" = the repaid loan's id);
//   * if two steps' weeks overlap, the later step wins, and a sent step ends all earlier ones;
//   * weekly cap: nobody gets one within 7 days of any campaign / automation message — they stay
//     due and get it on a later day of the step's week.

import { contactedWithin } from './campaignDelivery.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export const AUTOMATION_ID = 'comeback';
export const STEP_WINDOW_DAYS = 7;
export const CAP_DAYS = 7;

export type JourneyStep = { step: number; delay_days: number; subject: string; message: string };

export type ComebackCandidate = {
   user_id: string;
   email: string | null;
   display_name: string | null;
   username: string | null;
   messenger_psid: string | null;
   email_unsubscribed_at: string | null;
   cycle_key: string;
   repaid_at: string;
   days_since: number;
};

export type DueEntry = { person: ComebackCandidate; step: JourneyStep };

// The step due for someone `daysSince` days after repaying, given the steps already done this cycle.
export const dueStep = (daysSince: number, steps: JourneyStep[], doneSteps: Set<number>): JourneyStep | null => {
   // Never go backwards: once a step went out, earlier steps are over for this cycle.
   const lastDoneDelay = Math.max(-1, ...steps.filter((s) => doneSteps.has(s.step)).map((s) => s.delay_days));
   const inWindow = steps
      .filter((s) => s.delay_days > lastDoneDelay && daysSince >= s.delay_days && daysSince < s.delay_days + STEP_WINDOW_DAYS)
      .sort((a, b) => b.delay_days - a.delay_days);
   return inWindow[0] ?? null;
};

export const loadJourney = async (svc: Svc) => {
   const [{ data: automation, error }, { data: steps, error: stepsError }] = await Promise.all([
      svc.from('admin_automations').select('id, name, enabled, updated_at').eq('id', AUTOMATION_ID).maybeSingle(),
      svc.from('admin_automation_steps').select('step, delay_days, subject, message').eq('automation_id', AUTOMATION_ID).order('step')
   ]);
   if (error) throw new Error(error.message);
   if (stepsError) throw new Error(stepsError.message);
   return {
      automation: automation as { id: string; name: string; enabled: boolean; updated_at: string } | null,
      steps: (steps ?? []) as JourneyStep[]
   };
};

// Everyone due today, split into those we can message now and those held back by the weekly cap.
export const planComeback = async (svc: Svc, steps: JourneyStep[]): Promise<{ due: DueEntry[]; capped: DueEntry[] }> => {
   const { data, error } = await svc.rpc('automation_comeback_candidates');
   if (error) throw new Error(error.message);
   const candidates = (data ?? []) as ComebackCandidate[];
   if (!candidates.length || !steps.length) return { due: [], capped: [] };

   // Steps already done this cycle: any non-failed row (sent, skipped for no device / unsubscribed,
   // or mid-send) — a fully failed step is retried tomorrow.
   const ids = candidates.map((c) => c.user_id);
   const { data: sends, error: sendsError } = await svc
      .from('admin_automation_sends')
      .select('user_id, cycle_key, step, status')
      .eq('automation_id', AUTOMATION_ID)
      .in('user_id', ids)
      .neq('status', 'failed');
   if (sendsError) throw new Error(sendsError.message);
   const done = new Map<string, Set<number>>();
   for (const s of (sends ?? []) as Array<{ user_id: string; cycle_key: string; step: number }>) {
      const key = `${s.user_id}:${s.cycle_key}`;
      if (!done.has(key)) done.set(key, new Set());
      done.get(key)!.add(s.step);
   }

   const dueAll: DueEntry[] = [];
   for (const person of candidates) {
      const step = dueStep(person.days_since, steps, done.get(`${person.user_id}:${person.cycle_key}`) ?? new Set());
      if (step) dueAll.push({ person, step });
   }
   const recent = await contactedWithin(svc, dueAll.map((d) => d.person.user_id), CAP_DAYS);
   return {
      due: dueAll.filter((d) => !recent.has(d.person.user_id)),
      capped: dueAll.filter((d) => recent.has(d.person.user_id))
   };
};
