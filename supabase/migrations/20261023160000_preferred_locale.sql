-- The language a person chose, saved on their account so it follows them: picked in the Messenger
-- bot (sendpulse-messenger-verify action 'locale') or in the app's language picker, the app opens in it next time
-- on any device, and the bot's automatic replies use it. The newest choice wins (preferred_locale_at).
--
-- messenger_contacts.locale holds the bot's choice for people without a linked account yet.

alter table public.users add column if not exists preferred_locale text;
alter table public.users add column if not exists preferred_locale_at timestamptz;
alter table public.messenger_contacts add column if not exists locale text;

-- The signed-in person's saved language (null when they never chose one).
create or replace function public.my_preferred_locale()
returns table (locale text, chosen_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $$
  select u.preferred_locale, u.preferred_locale_at from public.users u where u.id = auth.uid();
$$;

-- Save the signed-in person's choice from the app's language picker.
create or replace function public.set_my_preferred_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_locale not in ('en', 'fil', 'id', 'th', 'vi') then
    raise exception 'unsupported locale %', p_locale;
  end if;
  update public.users set preferred_locale = p_locale, preferred_locale_at = now() where id = auth.uid();
end;
$$;

revoke execute on function public.my_preferred_locale() from public, anon;
revoke execute on function public.set_my_preferred_locale(text) from public, anon;
grant execute on function public.my_preferred_locale() to authenticated;
grant execute on function public.set_my_preferred_locale(text) to authenticated;
