-- pgTAP: 목표 넣기·빼기·꺼내 쓰기, 모은 돈, 목표를 만들고 지우면 분배표 저금 줄이 따라감, 내 목표는 주인만. 찬우, 예빈
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

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select set_config('test.code', (select code from public.create_invite()), true);
update public.app_user set monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount, other_held)
  select space_id, 'home', '내 집 마련', 'once', 1, 150000000, 1000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 880000)
), auth.uid());

-- 넣기·빼기·꺼내 쓰기
select public.move_goal((select id from public.goal where template = 'home'), 'in', 500000);
select set_config('test.out', public.move_goal((select id from public.goal where template = 'home'), 'out', 200000)::text, true);
select is((select saved from public.goal_saved_sums() where goal_id = (select id from public.goal where template = 'home')),
  1300000::bigint, '모은 돈 = 이미 모은 돈 + 넣기 − 빼기');
select throws_ok($$ select public.move_goal((select id from public.goal where template = 'home'), 'use', 99999999) $$,
  '22023', 'too_much', '모은 돈보다 많이 꺼낼 수 없음');
select public.undo_goal_move(current_setting('test.out')::uuid);
select is((select saved from public.goal_saved_sums() where goal_id = (select id from public.goal where template = 'home')),
  1500000::bigint, '되돌리기');

-- 새 목표 → 분배표 저금 묶음 맨 아래 0원 줄(쓰는 돈 줄보다 앞)
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'travel', '여행', 'once', 2 from public.app_user where id = auth.uid();
select is((select amount from public.split_line where goal_id = (select id from public.goal where template = 'travel')),
  0::bigint, '새 목표는 0원 줄');
select is((select array_agg(kind::text order by sort) from public.split_line),
  array['saving', 'saving', 'fixed'], '저금 묶음 맨 아래, 쓰는 돈 앞');

-- 보류하면 줄이 빠지고, 다시 모으면 0원으로 돌아옴
update public.goal set status = 'paused' where template = 'travel';
select is((select count(*) from public.split_line where goal_id = (select id from public.goal where template = 'travel')),
  0::bigint, '보류하면 줄이 빠짐');
update public.goal set status = 'active' where template = 'travel';
select is((select count(*) from public.split_line where goal_id = (select id from public.goal where template = 'travel')),
  1::bigint, '다시 모으면 0원 줄');

-- 내 목표(찬우 주인)
insert into public.goal (space_id, template, name, kind, priority, owner_user_id)
  select space_id, 'hobby', '자기계발', 'once', 1, auth.uid() from public.app_user where id = auth.uid();
reset role;

-- 예빈 합류: 분배표를 만들면 우리 목표 줄만 생기고 찬우 내 목표는 없음
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.save_split('[{"kind":"fixed","amount":500000}]', auth.uid());
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'car', '자동차', 'once', 3 from public.app_user where id = auth.uid();
select is((select count(*) from public.split_line where goal_id = (select id from public.goal where template = 'car')),
  2::bigint, '각자 모드 우리 목표는 두 사람 분배표 모두에');
select is((select count(*) from public.split_line l join public.salary_split s on s.id = l.split_id
  where l.goal_id = (select id from public.goal where template = 'hobby') and s.owner_user_id = auth.uid()),
  0::bigint, '찬우 내 목표는 예빈 분배표에 없음');
select throws_ok($$ select public.move_goal((select id from public.goal where template = 'hobby'), 'in', 10000) $$,
  '42501', 'not_owner', '배우자 내 목표는 넣기 못 함');
update public.goal set name = '바꿈' where template = 'hobby';
select is((select name from public.goal where template = 'hobby'), '자기계발', '배우자 내 목표는 고칠 수 없음');
select is((select saved from public.goal_saved_sums() where goal_id = (select id from public.goal where template = 'home')),
  1500000::bigint, '배우자도 같은 모은 돈');
reset role;

select * from finish();
rollback;
