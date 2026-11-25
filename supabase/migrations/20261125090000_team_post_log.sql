-- Team Telegram posts about a person, saved so their account page (Admin → Users → name) shows what
-- the team was told. callTelegramApi calls log_team_post() after a team post goes out; every rule
-- lives HERE so changing what counts never needs a 30-function redeploy:
--   * only posts about 1–3 people (lists and digests are skipped),
--   * team members named on a card ("by @jimmymoodengcredit") aren't its subject unless passed explicitly,
--   * the same message again within fold_hours (numbers ignored) folds into one row with times+1,
--   * an edit of a card updates that card's row,
--   * skip_prefixes drops chat relays and system alerts,
--   * keep_per_user caps rows per person.
-- Switch: telegram_bot_settings.team_post_log = {"on": true, ...}. Off = nothing is saved.

create table if not exists public.team_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  chat_id text not null,
  message_id bigint,
  title text not null,
  body text not null,
  fingerprint text not null,
  times integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists team_posts_user_last_idx on public.team_posts (user_id, last_at desc);
create index if not exists team_posts_fold_idx on public.team_posts (user_id, fingerprint, last_at desc);
create unique index if not exists team_posts_card_idx on public.team_posts (chat_id, message_id, user_id) where message_id is not null;

alter table public.team_posts enable row level security;
revoke all on public.team_posts from anon, authenticated;

insert into public.telegram_bot_settings (key, value, description)
values (
  'team_post_log',
  jsonb_build_object(
    'on', true,
    'fold_hours', 24,
    'keep_per_user', 100,
    'max_people', 3,
    'skip_prefixes', jsonb_build_array('TikTok ·', '⛽', '🇮🇩 Rupiah moved', '🛡', '🚨 [', '🔴 [', '🟠 [', '🟡 [')
  )::text,
  'Save team Telegram posts on each person''s Admin page (log_team_post). on, fold_hours, keep_per_user, max_people, skip_prefixes.'
)
on conflict (key) do nothing;

-- Numbers, links and Telegram HTML don't make a message new: "still no ✅ after 3h" = "after 6h".
create or replace function private.team_post_fingerprint(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  select md5(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '<[^>]+>', '', 'g'),
          'https?://\S+', '', 'g'),
        '[0-9]+', '#', 'g'),
      '\s+', ' ', 'g')
  );
$$;

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
