-- Y-05 ‘기록 고치기’ → Y-08 고치기(2026-11-24 구역 4 캘린더 검토 9번): 이미 쓴 기록의 쓴 돈·드린 것·선물 이름·메모를 고침.
-- 추가만(기존 함수 record_care는 그대로). 같은 공간 사람만, 비밀 경조사는 만든 사람만(record_care와 같은 규칙). 기록만, 다른 표는 안 건드림.
create or replace function public.update_care_record(
  p_record uuid,
  p_amount bigint,
  p_gifts text[],
  p_gift_name text,
  p_memo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  r public.care_record;
  c public.care_day;
begin
  select * into me from public.app_user where id = uid and status = 'active';
  select * into r from public.care_record where id = p_record and deleted_at is null;
  if r.id is null or me.space_id is distinct from r.space_id then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into c from public.care_day where id = r.care_day_id;
  if c.secret and c.created_by is distinct from uid then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  update public.care_record
    set amount = p_amount,
        gifts = coalesce(p_gifts, '{}'),
        gift_name = nullif(btrim(p_gift_name), ''),
        memo = nullif(btrim(p_memo), '')
    where id = r.id;
  return jsonb_build_object('record', r.id, 'line', 0);
end;
$$;

revoke execute on function public.update_care_record(uuid, bigint, text[], text, text) from public, anon;
grant execute on function public.update_care_record(uuid, bigint, text[], text, text) to authenticated;
