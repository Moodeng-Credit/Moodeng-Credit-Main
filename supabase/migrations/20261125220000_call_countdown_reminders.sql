-- Call countdown reminders (video-call-reminders): 30 / 15 / 5 minutes before, each with a sorry.
-- A new SOON rung (15 min) slots in at 4, so STARTING / WAITING / PROMPT / AUTO_NO_SHOW move from
-- 4..7 to 5..8. Shift calls already part-way down the ladder so they don't get a rung twice.
update public.users
   set video_call_reminder_stage = video_call_reminder_stage + 1
 where video_call_reminder_stage >= 4
   and video_call_starts_at > now() - interval '6 hours';
