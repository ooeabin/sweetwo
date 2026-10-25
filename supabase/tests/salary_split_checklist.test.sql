-- pgTAP: 월급 분배표 저장(O-50, W-01)과 첫 체크리스트(O-60 직후). 찬우(시작한 사람), 예빈(합류한 사람)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우: 각자, 실수령 350만, 월급날 25일, 목표 비상금·내 집 마련
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'emergency', '비상금', 'once', 0 from public.app_user where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 150000000 from public.app_user where id = auth.uid();

select is((select salary_mode::text from public.couple_space), 'separate', '관리 방식 기본은 각자');
select throws_ok($$ select public.save_split(null, '[]') $$, '22023', 'bad_owner', '각자면 주인이 있어야 함');

select set_config('test.split', public.save_split(auth.uid(), jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'emergency'), 'amount', 440000),
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000),
  jsonb_build_object('kind', 'custom', 'name', '부모님 용돈', 'amount', 0)
))::text, true);
select is((select count(*) from public.split_line), 6::bigint, '줄 6개 저장');
select is((select user_id::text from public.split_line where kind = 'allowance'), '11111111-1111-1111-1111-111111111111', '용돈 줄 주인 = 나');
select is((select array_agg(amount order by sort) from public.split_line),
  array[440000, 950000, 880000, 880000, 350000, 0]::bigint[], '줄 순서 = 배열 순서');
select throws_ok($$ select public.save_split(auth.uid(), '[{"kind":"fixed","amount":12345}]') $$, '23514', null, '1만 원 단위만');
select throws_ok($$ insert into public.split_line (split_id, space_id, kind, amount, sort)
  select id, space_id, 'fixed', 10000, 9 from public.salary_split $$, '42501', null, '직접 쓰기는 막음');

-- 첫 체크리스트: 오늘이 든 사이클, 0원 줄 빼고 5줄
select isnt(public.start_checklist(auth.uid()), null, '체크리스트 생김');
select ok((select cycle_start <= public.kst_today() and cycle_end >= public.kst_today() from public.pay_checklist), '오늘이 사이클 안');
select is((select extract(day from cycle_start)::int from public.pay_checklist), 25, '기준일 = 월급날 25일');
select is((select count(*) from public.pay_check_line), 5::bigint, '0원 줄은 빠짐');
select is(public.start_checklist(auth.uid()), (select id from public.pay_checklist), '두 번 불러도 하나');

-- 저장하면 줄이 바뀜(통째로 교체)
select public.save_split(auth.uid(), '[{"kind":"fixed","amount":1000000}]');
select is((select count(*) from public.split_line), 1::bigint, '다시 저장하면 줄 교체');
reset role;

-- 다른 부부는 볼 수 없음
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select is((select count(*) from public.split_line) + (select count(*) from public.pay_check_line), 0::bigint, '다른 부부 분배표·체크리스트는 안 보임');
reset role;

select * from finish();
rollback;
