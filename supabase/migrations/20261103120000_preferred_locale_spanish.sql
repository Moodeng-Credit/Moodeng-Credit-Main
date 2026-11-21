-- The language picker gained Spanish ('es'). set_my_preferred_locale only accepted the earlier four, so a
-- Spanish choice failed to save to the account and did not follow the person to their other devices.
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
  if p_locale not in ('en', 'fil', 'id', 'th', 'vi', 'es') then
    raise exception 'unsupported locale %', p_locale;
  end if;
  update public.users set preferred_locale = p_locale, preferred_locale_at = now() where id = auth.uid();
end;
$$;
