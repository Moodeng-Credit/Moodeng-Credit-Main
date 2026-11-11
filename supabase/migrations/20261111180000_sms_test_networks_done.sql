-- SMS test page: once someone on Smart, TNT or Sun types back a code that arrived, that network is done.
-- sms_test_status returns the done networks so the page greys their buttons out, and sms_test_send
-- refuses them ('network_done') so they don't use up more ₱50 links. "Not sure" always stays open.

create or replace function private.sms_test_networks_done()
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(distinct network order by network), '{}')
  from private.sms_tests
  where status = 'arrived' and network in ('smart', 'tnt', 'sun');
$$;

revoke all on function private.sms_test_networks_done() from public, anon, authenticated;

-- Is the link good, are rewards still open, and which networks are done? {ok, open, done}
create or replace function public.sms_test_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.sms_test_token_ok(p_token) then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;
  return jsonb_build_object(
    'ok', true,
    'open', private.sms_test_rewards_left() > 0,
    'done', to_jsonb(private.sms_test_networks_done()));
end;
$$;

-- Text a code. {ok, test_id} or {ok:false, error: bad_link|bad_phone|bad_network|covered|network_done|already_done|closed|wait|too_many}
create or replace function public.sms_test_send(p_token text, p_phone text, p_network text, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone   text := private.sms_test_phone(p_phone);
  v_network text := lower(btrim(coalesce(p_network, '')));
  v_ip      text;
  v_creds   jsonb;
  v_code    text;
  v_id      uuid;
  v_req     bigint;
begin
  if not private.sms_test_token_ok(p_token) then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;
  if v_network not in ('smart', 'tnt', 'sun', 'not_sure') then
    return jsonb_build_object('ok', false, 'error', 'bad_network');
  end if;
  -- UniSMS already reaches Globe (incl. TM/GOMO) and DITO, so those numbers don't use up a reward.
  if substr(v_phone, 3, 3) in (
    '817', '904', '905', '906', '915', '916', '917', '926', '927', '935', '936', '937', '945', '952', '953',
    '954', '955', '956', '965', '966', '967', '975', '976', '977', '978', '979', '995', '996', '997',
    '895', '896', '897', '898', '991', '992', '993', '994') then
    return jsonb_build_object('ok', false, 'error', 'covered');
  end if;
  if v_network <> 'not_sure' and v_network = any(private.sms_test_networks_done()) then
    return jsonb_build_object('ok', false, 'error', 'network_done');
  end if;
  if exists (select 1 from private.sms_tests where phone = v_phone and (reward_code_id is not null or reward_owed)) then
    return jsonb_build_object('ok', false, 'error', 'already_done');
  end if;
  if private.sms_test_rewards_left() <= 0 then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if exists (select 1 from private.sms_tests where phone = v_phone and created_at > now() - interval '60 seconds') then
    return jsonb_build_object('ok', false, 'error', 'wait');
  end if;

  begin
    v_ip := btrim(split_part(coalesce(
      current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip',
      current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1));
  exception
    when others then v_ip := null;
  end;

  if (select count(*) from private.sms_tests where phone = v_phone) >= 3
     or (nullif(v_ip, '') is not null
         and (select count(*) from private.sms_tests where ip = v_ip and created_at > now() - interval '1 day') >= 6)
     or (select count(*) from private.sms_tests where created_at > now() - interval '1 day') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;

  select decrypted_secret::jsonb into v_creds from vault.decrypted_secrets where name = 'SPRINT_SMS' limit 1;
  if v_creds is null then
    raise exception 'SPRINT_SMS missing from vault';
  end if;

  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');

  insert into private.sms_tests (phone, network, tester_name, ip, code)
  values (v_phone, v_network, nullif(left(btrim(coalesce(p_name, '')), 60), ''), nullif(v_ip, ''), v_code)
  returning id into v_id;

  v_req := net.http_get(
    url := 'https://pxapi.sprintsmsservice.com/api/SendSms',
    params := jsonb_build_object(
      'api_id', v_creds ->> 'api_id',
      'api_password', v_creds ->> 'api_password',
      'sms_type', 'T',
      'encoding', 'T',
      'sender_id', 'Moodeng',
      'phonenumber', v_phone,
      'textmessage', 'Your Moodeng code is ' || v_code,
      'uid', v_id::text),
    timeout_milliseconds := 20000);

  update private.sms_tests set sprint_request = v_req where id = v_id;
  return jsonb_build_object('ok', true, 'test_id', v_id);
end;
$$;
