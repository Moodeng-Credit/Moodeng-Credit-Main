-- #new-users: flag sign-ups whose names overlap a banned account.
--
-- At sign-up there's no KYC and no IP yet — only username, display name, email and Telegram handle.
-- Ban evaders keep reusing their names (diosuganda / sugandadio85@gmail.com / @diosuganda after
-- "Dio Suganda" and "Yoshua Suganda" were banned). Each banned account contributes name words of 6+
-- letters (display name, Telegram handle, and the full name on every KYC attempt in kyc_identities);
-- words that also belong to any non-banned account are dropped, since those are ordinary first names
-- ("vincent", "christian"), not a family marker. The new account's handles are searched for the rest
-- with separators stripped ("sugandadio85" contains "suganda").
--
-- Tested against every existing account: all Suganda accounts hit, plus one active user
-- ("christoferjonquinto", via the Christofer KTP dio tried) — so a hit is 🟠 "check this one", not
-- proof. The check is wrapped so it can never fail a sign-up; on any error the post goes out without it.

create or replace function private.notify_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook text := (select decrypted_secret from vault.decrypted_secrets where name = 'DISCORD_NEW_USERS_WEBHOOK_URL' limit 1);
  display text := coalesce(nullif(trim(new.display_name), ''), nullif(trim(new.username), ''), 'Someone');
  fields jsonb := jsonb_build_array(jsonb_build_object('name', 'Email', 'value', coalesce(nullif(trim(new.email), ''), '—'), 'inline', true));
  haystack text;
  banned_hits text;
begin
  if webhook is null then
    return new;
  end if;
  if nullif(trim(new.telegram_username), '') is not null then
    fields := fields || jsonb_build_object('name', 'Telegram', 'value', '@' || ltrim(trim(new.telegram_username), '@'), 'inline', true);
  end if;
  if new.username is not null and new.username <> display then
    fields := fields || jsonb_build_object('name', 'Username', 'value', new.username, 'inline', true);
  end if;

  begin
    haystack := regexp_replace(
      lower(concat(new.username, ' ', new.display_name, ' ', split_part(coalesce(new.email, ''), '@', 1), ' ', new.telegram_username)),
      '[^a-z]', '', 'g'
    );
    with name_words as (
      select b.id, b.username, b.account_status, t.word
        from public.users b
        cross join lateral regexp_split_to_table(
          lower(concat_ws(' ', b.display_name, b.telegram_username,
            (select string_agg(k.full_name, ' ') from public.kyc_identities k where k.user_id = b.id))),
          '[^a-z]+'
        ) as t(word)
       where length(t.word) >= 6 and b.id <> new.id
    )
    select string_agg(distinct w.word || ' → ' || w.username, ', ')
      into banned_hits
      from name_words w
     where w.account_status = 'banned'
       and not exists (select 1 from name_words a where a.word = w.word and a.account_status <> 'banned')
       and position(w.word in haystack) > 0;
  exception when others then
    banned_hits := null;
  end;

  if banned_hits is not null then
    fields := fields || jsonb_build_object('name', '🟠 Name overlaps a banned account — check before approving', 'value', left(banned_hits, 1000), 'inline', false);
  end if;

  perform net.http_post(
    url := webhook,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('embeds', jsonb_build_array(jsonb_build_object(
      'title', case when banned_hits is not null then '⚠️ New user — name overlaps a banned account' else '👤 New user' end,
      'description', '**' || display || '** just joined.',
      'color', case when banned_hits is not null then 15105570 else 5763719 end,
      'fields', fields,
      'timestamp', coalesce(new.created_at, now())
    )))
  );
  return new;
end;
$$;
