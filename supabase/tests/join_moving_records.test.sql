-- pgTAP: P-02a 혼자 쓰던 기록 옮기기(18). 예빈이 혼자 쓰다가 찬우 초대로 합류: 내 명의 자산만 옮김
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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
update public.app_user set nickname = '찬우', side = 'groom' where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

-- 예빈: 혼자 시작(목표, 내 명의 적금, 월급)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10,
  onboarding_done_at = now() where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'travel', '혼자 여행', 'once', 1 from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  select space_id, 'asset', 'deposit', 'saving', '예빈 적금', 5000000, 'person', id from public.app_user where id = auth.uid();
select set_config('test.old', (select space_id::text from public.app_user where id = auth.uid()), true);
select set_config('test.a', (select id::text from public.asset where name = '예빈 적금'), true);
select is(public.join_space(current_setting('test.code')), 'has_records', '그냥 합류하면 기록 있음');
select is(public.join_moving_records(current_setting('test.code'),
  jsonb_build_object(current_setting('test.a'), 'all')), 'joined', '옮기고 합류');
reset role;

select is((select space_id from public.app_user where nickname = '예빈'),
  (select space_id from public.app_user where nickname = '찬우'), '찬우 공간으로');
select results_eq(
  $$ select space_id = (select space_id from public.app_user where nickname = '찬우'), visibility::text
     from public.asset where name = '예빈 적금' $$,
  $$ values (true, 'all') $$, '내 명의 자산은 옮기고 공개 범위는 고른 값');
select is((select space_id::text from public.goal where name = '혼자 여행'), current_setting('test.old'),
  '목표는 원래 공간에 남음');
select isnt((select deleted_at from public.couple_space where id = current_setting('test.old')::uuid), null,
  '원래 공간은 30일 보관(지움 표시)');

select * from finish();
rollback;
