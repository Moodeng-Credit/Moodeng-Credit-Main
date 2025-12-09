with missing_profiles as (
    select
        au.id,
        coalesce(
            nullif(au.raw_user_meta_data->>'username', ''),
            concat('user_', replace(au.id::text, '-', ''))
        ) as desired_username,
        au.email,
        coalesce(
            (au.raw_user_meta_data->>'is_world_id')::world_id_status,
            'INACTIVE'::world_id_status
        ) as desired_world_id
    from auth.users au
    left join public.users pu on pu.id = au.id
    where pu.id is null
      and au.email is not null
)
insert into public.users (id, username, email, is_world_id)
select
    id,
    case
        when exists (select 1 from public.users existing where existing.username = desired_username)
            then concat(desired_username, '_', replace(id::text, '-', ''))
        else desired_username
    end as username,
    email,
    desired_world_id
from missing_profiles;
