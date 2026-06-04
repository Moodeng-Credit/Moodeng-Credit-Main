alter table public.users
add column if not exists display_name text;

update public.users as u
set display_name = nullif(btrim(au.raw_user_meta_data ->> 'name'), '')
from auth.users as au
where au.id = u.id
  and u.display_name is null
  and nullif(btrim(au.raw_user_meta_data ->> 'name'), '') is not null;
