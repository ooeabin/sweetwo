-- 2026-11-11 QA 3구간 D2(S3-02): 로그인 전 초대 미리보기(invite_preview)는 초대한 사람 호칭을 그대로 보여 주되
-- 코드 대입을 서버에서 막는다. 접속 주소(요청 머리 cf-connecting-ip → x-forwarded-for 첫 값 → x-real-ip)와
-- 앱이 보내는 기기 표시값을 각각 sha256으로 바꿔 시도마다 기록하고(원래 값은 저장 안 함), 10분 창에서 상한을 넘으면 ‘locked’.
-- 맞는 코드든 아니든 모든 시도를 센다. 기록은 하루 지나면 지움. Edge Function 없이 PostgREST 요청 머리(request.headers)로.
-- 상한(31 보안 3장): 미리보기 접속 주소 10분 40번, 기기 10분 20번 / 합류하기 사람 10분 10번, 접속 주소 10분 30번

create table if not exists public.invite_guard_attempt (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('preview_ip', 'preview_device', 'join_ip')),
  key_hash text not null check (char_length(key_hash) = 64),
  created_at timestamptz not null default now()
);
comment on table public.invite_guard_attempt is '초대 코드 시도 기록(접속 주소·기기 sha256만). 함수로만 씀, 하루 뒤 지움';
create index if not exists invite_guard_attempt_key_idx on public.invite_guard_attempt (kind, key_hash, created_at desc);
alter table public.invite_guard_attempt enable row level security;
revoke all on public.invite_guard_attempt from anon, authenticated;

-- 요청한 접속 주소의 sha256(없으면 null: 테스트, 서버 안 호출)
create or replace function public.client_ip_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  ip text;
begin
  if h is null then
    return null;
  end if;
  ip := coalesce(nullif(btrim(h->>'cf-connecting-ip'), ''),
                 nullif(btrim(split_part(h->>'x-forwarded-for', ',', 1)), ''),
                 nullif(btrim(h->>'x-real-ip'), ''));
  if ip is null then
    return null;
  end if;
  return encode(extensions.digest(ip, 'sha256'), 'hex');
end;
$$;
revoke all on function public.client_ip_key() from public, anon, authenticated;

-- 시도 하나를 기록하고, 이번 시도 전에 이미 10분 상한에 닿았으면 true. 키가 없으면 세지 않음
create or replace function public.invite_guard_hit(p_kind text, p_key text, p_limit integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_key is null or p_key = '' then
    return false;
  end if;
  if char_length(p_key) <> 64 then
    p_key := encode(extensions.digest(p_key, 'sha256'), 'hex');
  end if;
  select count(*) into n from public.invite_guard_attempt a
    where a.kind = p_kind and a.key_hash = p_key and a.created_at > now() - interval '10 minutes';
  insert into public.invite_guard_attempt (kind, key_hash) values (p_kind, p_key);
  if random() < 0.02 then
    delete from public.invite_guard_attempt where created_at < now() - interval '1 day';
  end if;
  return n >= p_limit;
end;
$$;
revoke all on function public.invite_guard_hit(text, text, integer) from public, anon, authenticated;

-- 미리보기(A-07 P-01): 기기 표시값은 앱이 이 기기에서 한 번 만든 임의 값(sweetwo.device). 상태 ‘locked’ 더함.
-- 다른 사람이 합류하는 중(잡아 둠)이면 ‘used’, 잡아 둔 본인이면 ‘ok’(이어 하기)
create or replace function public.invite_preview(p_code text, p_device text)
returns table (inviter_nickname text, status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  i public.invite;
  nick text;
  uid uuid := auth.uid();
begin
  if public.invite_guard_hit('preview_ip', public.client_ip_key(), 40)
     or public.invite_guard_hit('preview_device', nullif(btrim(coalesce(p_device, '')), ''), 20) then
    return query select null::text, 'locked'::text;
    return;
  end if;
  select * into i from public.invite where code = upper(btrim(p_code));
  if not found then
    return query select null::text, 'invalid'::text;
    return;
  end if;
  select u.nickname into nick from public.app_user u
    where u.id = i.created_by and u.status = 'active' and u.space_id = i.space_id;
  if nick is null then
    return query select null::text, 'unavailable'::text;
  elsif i.used_at is not null
     or (i.used_by is not null and i.used_by is distinct from uid)
     or (i.reserved_by is not null and i.reserved_until > now() and i.reserved_by is distinct from uid) then
    return query select nick, 'used'::text;
  elsif i.expires_at <= now() and not coalesce(i.reserved_by = uid and i.reserved_until > now(), false) then
    return query select nick, 'expired'::text;
  else
    return query select nick, 'ok'::text;
  end if;
end;
$$;
revoke all on function public.invite_preview(text, text) from public;
grant execute on function public.invite_preview(text, text) to anon, authenticated;

-- 예전 앱(기기 값 없음): 접속 주소만으로 제한
create or replace function public.invite_preview(p_code text)
returns table (inviter_nickname text, status text)
language sql
volatile
security definer
set search_path = ''
as $$
  select p.inviter_nickname, p.status from public.invite_preview(p_code, null::text) p;
$$;
revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
