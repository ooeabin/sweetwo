-- pgTAP: 월급 관리 방식 바꾸기(25 S-11f, 20 ‘다시 계산되는 때’), 체크리스트 만드는 날(S-11d). 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우(350만, 25일), 우리 목표 내 집 마련, 찬우 내 목표 자기계발
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'home', '내 집 마련', 'once', 1 from public.app_user where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, owner_user_id)
  select space_id, 'hobby', '자기계발', 'once', 1, auth.uid() from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'hobby'), 'amount', 100000),
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000)
), auth.uid());
select public.start_checklist(auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

-- 예빈(270만, 10일) 합류: 각자 분배표
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 1070000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 680000),
  jsonb_build_object('kind', 'allowance', 'amount', 270000)
));

-- 합쳐서로: 같은 목표 더하고, 고정·생활 더하고, 용돈은 사람마다, 내 목표 줄 그대로
select public.set_salary_mode('joint');
select is((select count(*) from public.salary_split), 1::bigint, '분배표 하나');
select is((select amount from public.split_line where goal_id = (select id from public.goal where template = 'home')),
  2020000::bigint, '같은 목표 줄은 더함');
select is((select amount from public.split_line where kind = 'fixed'), 1560000::bigint, '고정지출 더함');
select is((select count(*) from public.split_line where kind = 'allowance'), 2::bigint, '용돈은 사람마다');
select is((select amount from public.split_line where goal_id = (select id from public.goal where template = 'hobby')),
  100000::bigint, '내 목표 줄 그대로');
-- 이번 사이클은 옛 체크리스트 그대로, 공동 체크리스트는 다음 월급날부터
select is(public.start_checklist(null), null, '이번 달은 새 체크리스트 안 만듦');
reset role;
select is((select title from public.notification where kind = 'salary_mode'), '예빈님이 월급 관리 방식을 바꿨어요', '찬우에게 알림');

-- 체크리스트 만드는 날: 두 월급날 중 하나만
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok($$ select public.set_joint_cycle_day(15::smallint) $$, '22023', 'bad_day', '두 월급날 중 하나만');
select lives_ok($$ select public.set_joint_cycle_day(10::smallint) $$, '예빈 월급날로');

-- 다시 각자로: 수입 비율로 나눔(남는 차이는 기준일 사람), 용돈·내 목표는 주인에게
select public.set_salary_mode('separate');
select is((select count(*) from public.salary_split), 2::bigint, '분배표 둘');
select is((select array_agg(l.amount order by s.owner_user_id) from public.split_line l join public.salary_split s on s.id = l.split_id
  where l.kind = 'fixed'), array[880000, 680000]::bigint[], '고정지출을 수입 비율로(156만 × 270/620 = 68만, 나머지 88만)');
select is((select s.owner_user_id::text from public.split_line l join public.salary_split s on s.id = l.split_id
  where l.goal_id = (select id from public.goal where template = 'hobby')), '11111111-1111-1111-1111-111111111111', '내 목표 줄은 주인에게');
reset role;

select * from finish();
rollback;
