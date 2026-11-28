-- 2026-11-28 사용자 결정(출시 전, 실사용자 데이터 없음): 20270106090000_living_as_category가 옛 생활비 기본 줄(kind living)에서
-- 바꾼 직접 추가 줄 ‘생활비’(묶음 living)는 남기지 않고 지움. 그 줄의 확인 목록 줄(확인 기록 포함)도 지움.
-- 식별 기준 = 그 마이그레이션이 바꾼 값과 같음: kind custom + 이름 ‘생활비’ + 묶음 living
--   (W-01e 칩에는 ‘생활비’ 이름 칩이 없고, ‘직접 정하기’ 글자 줄은 묶음이 없어서 이 기준에 들지 않음)
-- 저축·투자 모은 금액: 저금 줄(kind saving, goal_id)의 확인 기록만 셈하므로 영향 없음.
-- 앞으로 kind living 입력은 무시(줄을 만들지 않음). enum 값·열은 그대로(2단계 원칙).

create temporary table living_gone on commit drop as
  select id, split_id from public.split_line
  where kind = 'custom' and name = '생활비' and category = 'living';

create temporary table living_lists on commit drop as
  select distinct checklist_id from public.pay_check_line
  where split_line_id in (select id from living_gone);

delete from public.pay_check_line where split_line_id in (select id from living_gone);
delete from public.split_line where id in (select id from living_gone);

-- 확인 목록 상태(다 했어요 등)를 다시 셈
do $$
declare c uuid;
begin
  for c in select checklist_id from living_lists loop
    perform public.checklist_restate(c);
  end loop;
end;
$$;

-- kind living 입력은 무시: BEFORE 트리거가 null을 돌려주면 그 줄은 들어가지 않음(옛 앱이 보내도 오류 없이 빠짐)
create or replace function public.split_line_living_category() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'living' then
    return null;
  elsif new.kind <> 'custom' then
    new.category := null;
  end if;
  return new;
end;
$$;

create or replace function public.pay_check_line_no_living() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'living' then
    return null;
  end if;
  return new;
end;
$$;
