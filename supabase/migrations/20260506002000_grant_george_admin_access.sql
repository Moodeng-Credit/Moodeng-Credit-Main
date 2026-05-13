insert into public.admin_users (user_id, role, active, display_name)
select u.id, 'owner', true, coalesce(nullif(u.username, ''), au.email, 'George admin')
from public.users u
join auth.users au on au.id = u.id
where lower(au.email) = 'georgemlerner@gmail.com'
on conflict (user_id) do update
set role = 'owner',
    active = true,
    display_name = excluded.display_name;

insert into public.admin_users (user_id, role, active, display_name)
select u.id, 'owner', true, coalesce(nullif(u.username, ''), 'Cookiemonster admin')
from public.users u
where lower(coalesce(u.username, '')) in ('cookiemonster1337', 'cookiemonster admin', 'cookiemonster')
on conflict (user_id) do update
set role = 'owner',
    active = true,
    display_name = excluded.display_name;
