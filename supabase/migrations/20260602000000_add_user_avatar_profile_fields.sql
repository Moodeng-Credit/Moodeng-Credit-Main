alter table public.users
add column if not exists avatar_url text,
add column if not exists avatar_background text;

update public.users as u
set
  avatar_url = coalesce(u.avatar_url, nullif(btrim(au.raw_user_meta_data ->> 'avatar_url'), '')),
  avatar_background = coalesce(u.avatar_background, nullif(btrim(au.raw_user_meta_data ->> 'avatar_background'), ''))
from auth.users as au
where au.id = u.id
  and (
    u.avatar_url is null
    or u.avatar_background is null
  )
  and (
    nullif(btrim(au.raw_user_meta_data ->> 'avatar_url'), '') is not null
    or nullif(btrim(au.raw_user_meta_data ->> 'avatar_background'), '') is not null
  );
