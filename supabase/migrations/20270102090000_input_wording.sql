-- 사용자 문구 ‘적다’ → ‘입력하다’(2026-11-26 사용자 결정, docs/spec/README.md ‘용어 적다 정리’).
-- 서버가 만드는 사용자 문구 중 ‘적다’(기록 뜻)는 대신 입력 정리 알림(purge_proxy_entries, 20261204090000 계약 9) 한 곳.
-- 본문만 바꾸고 동작은 그대로. 이미 보낸 알림 행은 고치지 않는다.
create or replace function public.purge_proxy_entries(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  r record;
  cnt integer := 0;
begin
  for r in
    select distinct on (i.space_id) i.space_id, i.created_by, (i.expires_at at time zone 'Asia/Seoul')::date as exp
    from public.invite i
    join public.couple_space s on s.id = i.space_id and s.deleted_at is null and s.couple_state = 'not_joined'
    where i.used_at is null
    order by i.space_id, i.expires_at desc
  loop
    continue when not exists (select 1 from public.asset a where a.space_id = r.space_id and a.owner = 'person'
                                and a.owner_user_id is null and a.deleted_at is null);
    if today = r.exp + 23 and r.created_by is not null then
      perform public.notify(r.created_by, r.space_id, 'proxy_purge_soon', '대신 입력한 파트너 자산이 7일 뒤 지워져요', -- [확인 필요] R-13
        '파트너가 합류하면 그대로 남아요', '/assets', 'clock', null, 'proxy_purge:' || r.space_id || ':' || r.exp);
      cnt := cnt + 1;
    elsif today >= r.exp + 30 then
      update public.asset set deleted_at = now()
        where space_id = r.space_id and owner = 'person' and owner_user_id is null and deleted_at is null;
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.purge_proxy_entries(date) from public, anon, authenticated;
