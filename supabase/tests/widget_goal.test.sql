-- pgTAP: S-22 위젯에 보일 저축·투자(app_user.widget_goal_id). 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 100000000 from public.app_user where id = auth.uid();
select set_config('test.goal', (select id::text from public.goal where template = 'home'), true);
select is((select widget_goal_id from public.app_user where id = auth.uid()), null, '처음엔 비움(대표 저금)');
select lives_ok($$ update public.app_user set widget_goal_id = current_setting('test.goal')::uuid where id = auth.uid() $$, '내 공간 저금 항목을 고름');
select is((select widget_goal_id::text from public.app_user where id = auth.uid()), current_setting('test.goal'), '저장됨');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select throws_ok($$ update public.app_user set widget_goal_id = current_setting('test.goal')::uuid where id = auth.uid() $$, '23514', null, '남의 공간 항목은 못 고름');
reset role;

delete from public.goal where template = 'home';
select is((select widget_goal_id from public.app_user where id = '11111111-1111-1111-1111-111111111111'), null, '항목을 지우면 비움으로 돌아감');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ update public.app_user set nickname = 'x', status = 'deleted' where id = auth.uid() $$, '42501', null, '다른 열은 여전히 못 고침');
select * from finish();
rollback;
