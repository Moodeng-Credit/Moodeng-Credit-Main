// "REWARD" typed to the Page by a known borrower → their repay streak and what paying on time earns.
//
// Why it exists: Messenger only lets the Page message someone for 24 hours after their last message,
// and a loan runs 30 days, so the due-day reminder usually can't reach them there. The day-before
// email / Viber reminder asks them to send REWARD: that message reopens the 24 hours, this answers it,
// and the due-day Messenger reminder then gets through.
import { buildRepayRewardLine, buildRewardReply, dueLabelFor, isRewardMessage, parseRepayRewardPreview } from './repayReward.ts';
import { sendMessengerMessage } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

type OpenLoan = {
   total_repayment_amount: number | string | null;
   repaid_amount: number | string | null;
   due_date: string | null;
   due_timezone: string | null;
};

/** True when the message was a reward question and we answered it (so it isn't also a support ticket). */
export const handleRewardMessage = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      if (!isRewardMessage(text)) return false;
      const [{ data: previews }, { data: loans }] = await Promise.all([
         svc.rpc('repay_reward_previews', { p_user_ids: [userId] }),
         svc
            .from('loans')
            .select('total_repayment_amount, repaid_amount, due_date, due_timezone')
            .eq('borrower_user_id', userId)
            .eq('loan_status', 'Lent')
            .neq('repayment_status', 'Paid')
            .is('refunded_at', null)
            .order('due_date', { ascending: true })
      ]);
      const preview = parseRepayRewardPreview((previews ?? [])[0]?.preview);
      const open = ((loans ?? []) as OpenLoan[]).filter((loan) => loan.due_date);
      const owed = open.reduce(
         (sum, loan) => sum + Math.max(0, Number(loan.total_repayment_amount ?? 0) - Number(loan.repaid_amount ?? 0)),
         0
      );
      const next = open[0];
      const dueLabel = next?.due_date ? dueLabelFor(next.due_date, next.due_timezone || 'Asia/Manila', new Date()) : null;
      const isOverdue = dueLabel?.startsWith('now') ?? false;
      const reply = buildRewardReply({
         streak: preview?.current ?? 0,
         rewardLine: owed > 0 && !isOverdue ? buildRepayRewardLine(preview, dueLabel === 'today' ? 'due_today' : 'final_reminder') : null,
         owed,
         dueLabel
      });
      const res = await sendMessengerMessage(contactId, {
         text: reply,
         card:
            owed > 0
               ? { title: 'Repay on Moodeng Credit', button: { title: 'Repay now', url: 'https://moodeng.app/repay' } }
               : { title: 'Moodeng Credit', button: { title: 'Open Moodeng', url: 'https://moodeng.app/dashboard' } }
      });
      if (!res.ok) console.error('messenger-reward-reply: send failed', res.reason);
      return true;
   } catch (err) {
      console.error('messenger-reward-reply: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
