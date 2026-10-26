-- pgTAP: 월급 체크(W-02, W-02a, W-05), 모은 돈 합, 분배표를 고치면 체크 안 한 줄만 새 금액. 찬우(시작한 사람), 예빈(합류한 사람)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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
create function pg_temp.line(k text) returns uuid language sql as $$
  select l.id from public.pay_check_line l left join public.goal g on g.id = l.goal_id
  where coalesce(g.template, l.kind::text) = k;
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select set_config('test.code', (select code from public.create_invite()), true);
update public.app_user set monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 150000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
select public.start_checklist(auth.uid());

select public.check_pay_line(pg_temp.line('home'), 'checked');
select is((select amount from public.goal_checked_sums()), 950000::bigint, '저금 줄 체크 = 목표에 더함');
select is((select state from public.pay_checklist), 'open', '남은 줄이 있으면 진행 중');

-- 분배표를 고치면 체크 안 한 줄(생활비)만 새 금액, 체크한 줄은 그대로
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 500000),
  jsonb_build_object('kind', 'living', 'amount', 700000)
), auth.uid());
select is((select planned from public.pay_check_line where id = pg_temp.line('home')), 950000::bigint, '체크한 줄은 그대로');
select is((select planned from public.pay_check_line where id = pg_temp.line('living')), 700000::bigint, '체크 안 한 줄은 새 금액');

-- 다른 금액(W-02a), 0원이면 못 함
select public.check_pay_line(pg_temp.line('living'), 'checked', 650000);
select is((select actual from public.pay_check_line where id = pg_temp.line('living')), 650000::bigint, '다른 금액 기록');
select is((select state from public.pay_checklist), 'done', '다 하면 다 했어요');
select public.check_pay_line(pg_temp.line('living'), 'checked', 0);
select is((select state from public.pay_check_line where id = pg_temp.line('living')), 'skipped', '0원이면 못 함');

-- 체크 풀기 = 목표에서 다시 뺌
select public.check_pay_line(pg_temp.line('home'), 'wait');
select is((select count(*) from public.goal_checked_sums()), 0::bigint, '풀면 목표에서 뺌');
select public.check_pay_line(pg_temp.line('home'), 'checked');
reset role;

-- 예빈(합류): 찬우 체크리스트에 대신 체크, 이미 체크한 줄은 먼저 저장된 체크 유지
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select throws_ok($$ select public.check_pay_line(pg_temp.line('home'), 'checked') $$, '40001', 'already_checked', '먼저 저장된 체크 유지');
select public.check_pay_line(pg_temp.line('living'), 'checked');
select ok((select on_behalf from public.pay_check_line where id = pg_temp.line('living')), '대신 체크 표시');
reset role;

-- 다른 부부는 체크할 수 없음
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select throws_ok(
  format('select public.check_pay_line(%L, ''wait'')', (select id from public.pay_check_line limit 1)),
  '42501', null, '다른 부부 줄은 못 고침');
reset role;

select * from finish();
rollback;
