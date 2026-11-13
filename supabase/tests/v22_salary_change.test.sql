-- pgTAP: v2.2 날짜를 정한 월급 변경(20261202090000 계약 5, G12). 이번 달 즉시, 미래 달 적용,
-- until 다음 달 되돌림, 취소, 다른 공간은 못 읽음. 홈 띠 닫기(dismiss_home_task)도 여기서
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
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
create function pg_temp.sl(p_owner uuid, k text, p_user uuid default null) returns uuid language sql as $$
  select l.id from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is not distinct from p_owner and l.kind::text = k and (p_user is null or l.user_id = p_user) limit 1;
$$;

-- 찬우(시작한 사람, 25일), 다른 사람(혼자)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 100000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
reset role;
-- 혼자 쓰는 사람(3333): 월급날 1일 → 이번 달 변경은 바로
update public.app_user set monthly_income = 3000000, payday = 1 where id = '33333333-3333-3333-3333-333333333333';
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select isnt(public.schedule_salary_change(2000000, public.kst_today()), null, '이번 달 변경');
select is((select monthly_income from public.app_user where id = auth.uid()), 2000000::bigint, '이번 달(사이클 시작 지남)은 바로');
select is((select revert_amount from public.salary_change), 3000000::bigint, '바꾸기 전 금액');
select throws_ok(format('select public.cancel_salary_change(%L)', (select id from public.salary_change)), '22023', 'already_applied',
  '적용한 변경은 취소 못 함');
select throws_ok($$ select public.schedule_salary_change(1000000, '2020-01-01') $$, '22023', 'bad_month', '지난 달은 안 됨');
-- 미래 달 + 언제까지(육아휴직 2027-03 ~ 2027-05 → 6월 되돌림)
select public.schedule_salary_change(1500000, '2027-03-15', '2027-05-01');
select is((select effective_from || ':' || until_month from public.salary_change where applied_at is null),
  '2027-03-01:2027-05-01', '그 달 1일로 맞춤');
reset role;
select is(public.apply_salary_changes('2027-02-28'), 0, '그 전엔 그대로');
select is(public.apply_salary_changes('2027-03-01'), 1, '사이클 시작일에 적용');
select is((select monthly_income from public.app_user where id = '33333333-3333-3333-3333-333333333333'), 1500000::bigint, '휴직 월급');
select is((select count(*)::int from public.notification where kind = 'salary_changed'), 2, '월급이 바뀐 달 인앱 알림(바로 + 이번)');
select is(public.noti_inapp_only('salary_changed'), true, '푸시 없음');
select is(public.apply_salary_changes('2027-05-31'), 0, 'until 달까지는 그대로');
select is(public.apply_salary_changes('2027-06-01'), 1, 'until 다음 달 사이클 시작에 되돌림');
select is((select monthly_income from public.app_user where id = '33333333-3333-3333-3333-333333333333'), 2000000::bigint, '되돌린 금액');
-- 취소(적용 전)
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.schedule_salary_change(1000000, '2028-01-01');
select lives_ok(format('select public.cancel_salary_change(%L)', (select id from public.salary_change where applied_at is null
  and cancelled_at is null)), '적용 전 취소');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.salary_change), 0, '다른 공간 월급 변경은 못 읽음');
-- 홈 띠 닫기(G10 ‘이미 정했어요’)
select lives_ok($$ select public.dismiss_home_task('split_suggest') $$, '띠 닫기');
select is((select state from public.home_task_state where task_key = 'split_suggest'), 'dismissed', '내 기록');
select throws_ok($$ select public.dismiss_home_task('Bad Key!') $$, '22023', 'bad_key', '키 형식');
reset role;

select * from finish();
rollback;
