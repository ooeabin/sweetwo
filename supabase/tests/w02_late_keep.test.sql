-- pgTAP: 사이클이 넘어가도 지난 달 손 줄은 다음 사이클 끝까지 대기로 남음(2026-11-23 W-02 135, 20261226090000)
-- 월급날 1일 혼자 쓰는 사람(날짜는 make_checklist(p_today)로). 1월 목록은 2월 시작에도 대기, 3월 시작에 건너뜀 + 닫힘
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'late@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-l', '44444444-4444-4444-4444-444444444444', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.couple_space set holiday_shift = false;
update public.app_user set monthly_income = 3000000, payday = 1 where id = auth.uid();
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', '공과금', 'category', 'housing', 'amount', 500000),
  jsonb_build_object('kind', 'custom', 'name', '관리비', 'amount', 200000)), auth.uid());
reset role;
update public.salary_split set checklist_from = null;
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', '2027-01-05');
-- 1월 목록의 줄 하나는 확인, 하나는 대기로 둠
update public.pay_check_line set state = 'checked', checked_by = '44444444-4444-4444-4444-444444444444', checked_at = now()
  where (kind = 'custom' and name = '공과금');
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', '2027-02-05');
select is((select l.state::text from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.cycle_start = '2027-01-01' and l.kind = 'custom' and l.name = '관리비'), 'wait', '2월이 되어도 1월 손 줄은 대기로 남음');
select isnt((select state::text from public.pay_checklist where cycle_start = '2027-01-01'), 'closed', '1월 목록은 안 닫힘');
select is(public.late_check_until((select id from public.pay_checklist where cycle_start = '2027-01-01')), '2027-02-28'::date,
  '늦은 확인 마지막 날 = 2월 끝');
select is((select count(*)::int from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.cycle_start = '2027-01-01' and l.state = 'skipped'), 0, '건너뜀 처리된 줄 없음');
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', '2027-03-05');
select is((select l.state::text from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.cycle_start = '2027-01-01' and l.kind = 'custom' and l.name = '관리비'), 'skipped', '3월이 되면(늦은 확인 기간 끝) 남은 줄이 건너뜀');
select is((select l.state::text from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.cycle_start = '2027-01-01' and (l.kind = 'custom' and l.name = '공과금')), 'checked', '확인한 줄은 그대로');
select is((select state::text from public.pay_checklist where cycle_start = '2027-01-01'), 'closed', '1월 목록 닫힘');
select is((select l.state::text from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.cycle_start = '2027-02-01' and l.kind = 'custom' and l.name = '관리비'), 'wait', '2월 목록은 3월 시작에도 대기(다음 사이클 끝까지)');

select * from finish();
rollback;
