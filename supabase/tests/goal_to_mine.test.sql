-- pgTAP: 우리 → 내 목표는 상대가 체크한 저금 줄·직접 넣은 돈이 없을 때만, 비상금은 안 됨(22 ‘목표 종류’)
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

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
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'travel', '여행', 'once', 1, 3000000 from public.app_user;
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'car', '차', 'once', 2, 30000000 from public.app_user;
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'emergency', '비상금', 'once', 0 from public.app_user;
reset role;

-- 예빈이 ‘여행’에 직접 넣은 돈(되돌린 넣기는 세지 않음)
insert into public.goal_move (space_id, goal_id, kind, amount, created_by)
  select space_id, id, 'in', 100000, '22222222-2222-2222-2222-222222222222' from public.goal where name = '여행';

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ update public.goal set owner_user_id = '11111111-1111-1111-1111-111111111111' where name = '여행' $$,
  '42501', 'partner_saved', '예빈이 넣은 돈이 있으면 내 목표로 못 바꿈');
select throws_ok($$ update public.goal set owner_user_id = '11111111-1111-1111-1111-111111111111' where name = '비상금' $$,
  '42501', 'emergency_is_ours', '비상금은 우리 목표로만');
update public.goal set owner_user_id = '11111111-1111-1111-1111-111111111111' where name = '차';
select is((select owner_user_id::text from public.goal where name = '차'), '11111111-1111-1111-1111-111111111111',
  '상대가 모은 것이 없으면 바꿈');
reset role;

-- 예빈이 넣은 돈을 되돌렸으면(deleted_at) 바꿀 수 있음
update public.goal_move set deleted_at = now();
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.goal set owner_user_id = '11111111-1111-1111-1111-111111111111' where name = '여행';
select is((select owner_user_id::text from public.goal where name = '여행'), '11111111-1111-1111-1111-111111111111',
  '되돌린 넣기는 세지 않음');
reset role;

select * from finish();
rollback;
