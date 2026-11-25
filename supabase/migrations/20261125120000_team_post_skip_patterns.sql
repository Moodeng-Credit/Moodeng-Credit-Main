-- team_post_log: skip_patterns (regex on the first line) on top of skip_prefixes.
-- George 2026-11-25: one booking showed twice (the short "📅 New Moodeng call booked" + the full
-- "📞 … booked their … call" card) and every Messenger message relayed to the team became its own row.
-- Rules stay in the database: no function redeploy.

update public.telegram_bot_settings
   set value = (value::jsonb || jsonb_build_object('skip_patterns', jsonb_build_array(
         '^💬 New Messenger chat from ',
         '^💬 .+ on Messenger:?$',
         '^📅 New Moodeng call booked'
       )))::text
 where key = 'team_post_log';

create or replace function public.log_team_post(
  p_chat_id text,
  p_message_id bigint,
  p_text text,
  p_about uuid[] default '{}',
  p_mentioned uuid[] default '{}',
  p_is_edit boolean default false
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  cfg jsonb;
  v_body text;
  v_title text;
  fp text;
  subjects uuid[];
  who uuid;
  existing bigint;
  saved integer := 0;
  prefix text;
begin
  begin
    select value::jsonb into cfg from public.telegram_bot_settings where key = 'team_post_log';
  exception when others then
    return 0; -- unreadable switch = off
  end;
  if cfg is null or coalesce((cfg->>'on')::boolean, false) is not true then
    return 0;
  end if;

  -- Store the post as the team read it, minus the Facebook line callTelegramApi appends.
  v_body := left(btrim(regexp_replace(coalesce(p_text, ''), E'\\n\\n👤 Facebook[^\\n]*(\\n👤 Facebook[^\\n]*)*$', '')), 4000);
  if length(v_body) < 8 then
    return 0;
  end if;
  v_title := left(btrim(regexp_replace(split_part(v_body, E'\n', 1), '<[^>]+>', '', 'g')), 200);

  for prefix in select jsonb_array_elements_text(coalesce(cfg->'skip_prefixes', '[]'::jsonb)) loop
    if v_title like prefix || '%' then
      return 0;
    end if;
  end loop;
  -- skip_patterns: case-insensitive regexes on the first line, for titles that start with a name
  -- (Messenger relays) or that repeat a richer card sent to another chat.
  for prefix in select jsonb_array_elements_text(coalesce(cfg->'skip_patterns', '[]'::jsonb)) loop
    begin
      if v_title ~* prefix then
        return 0;
      end if;
    exception when others then
      null; -- a bad pattern never blocks logging
    end;
  end loop;

  -- Who it's about: ids the sender passed, plus people found in the text who aren't on the team.
  select coalesce(array_agg(distinct u), '{}') into subjects
  from (
    select unnest(coalesce(p_about, '{}')) as u
    union
    select m from unnest(coalesce(p_mentioned, '{}')) as m
    where not exists (select 1 from public.admin_users a where a.user_id = m and a.active)
  ) s
  where exists (select 1 from public.users x where x.id = s.u);

  if cardinality(subjects) = 0 or cardinality(subjects) > coalesce((cfg->>'max_people')::int, 3) then
    return 0;
  end if;

  fp := private.team_post_fingerprint(v_body);

  foreach who in array subjects loop
    existing := null;

    -- An edited card (✅ tapped, status added): update that card's row.
    if p_message_id is not null then
      select id into existing from public.team_posts
      where chat_id = p_chat_id and message_id = p_message_id and user_id = who;
    end if;
    if existing is not null then
      update public.team_posts
         set title = v_title, body = v_body, fingerprint = fp,
             edited_at = case when p_is_edit then now() else edited_at end
       where id = existing;
      saved := saved + 1;
      continue;
    end if;
    if p_is_edit then
      continue; -- an edit of a card we never saved (posted before logging began): nothing to update
    end if;

    -- The same message again soon (a reminder, a repeat alert): one row, counted, newest text kept.
    select id into existing from public.team_posts
    where user_id = who and fingerprint = fp
      and last_at > now() - make_interval(hours => coalesce((cfg->>'fold_hours')::int, 24))
    order by last_at desc limit 1;
    if existing is not null then
      update public.team_posts
         set times = times + 1, last_at = now(), body = v_body, title = v_title,
             chat_id = p_chat_id, message_id = coalesce(p_message_id, message_id)
       where id = existing;
      saved := saved + 1;
      continue;
    end if;

    insert into public.team_posts (user_id, chat_id, message_id, title, body, fingerprint)
    values (who, p_chat_id, p_message_id, v_title, v_body, fp)
    on conflict (chat_id, message_id, user_id) where message_id is not null do nothing;
    saved := saved + 1;

    -- Keep the newest N per person.
    delete from public.team_posts t
    where t.user_id = who
      and t.id in (
        select id from public.team_posts where user_id = who
        order by last_at desc offset coalesce((cfg->>'keep_per_user')::int, 100)
      );
  end loop;

  return saved;
end;
$function$;

revoke all on function public.log_team_post(text, bigint, text, uuid[], uuid[], boolean) from public, anon, authenticated;
grant execute on function public.log_team_post(text, bigint, text, uuid[], uuid[], boolean) to service_role;

-- Drop rows saved before these rules.
delete from public.team_posts
 where title ~* '^💬 New Messenger chat from '
    or title ~* '^💬 .+ on Messenger:?$'
    or title ~* '^📅 New Moodeng call booked';
