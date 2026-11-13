-- pgTAP: v2.2 해제·탈퇴 때 남는 것(20261204090000 계약 1·2·3). 각 행 종류가 어디로 가는지, 같이 쓰던 것은 원래 공간째 보관,
-- 묶음 해체, 해제 대기 중 상대 개인 저금 가림, 상대 계정 삭제 때 내 것은 남음
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
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
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
delete from public.notification;
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'del@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values ('kakao-d', '44444444-4444-4444-4444-444444444444', '{}', 'kakao');
select set_config('test.space', (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'), true);

-- 찬우: 내 명의 자산, 공동 명의 자산, 내 저금(묶음), 돈 들어왔어요, 월급 변경. 공동 저금 ‘내 집 마련’(주인 없음)은 준비에서
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'invest', 'stock', '찬우 주식', 10000000, 'person', auth.uid(), 'all' from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'cash', 'bank', '생활비 통장', 3000000, 'joint' from public.app_user where id = auth.uid();
select set_config('test.cg', public.add_saving_item('결혼 비용', 500000, 30000000, null, 10000000)::text, true);
select public.log_money_in(500000, public.kst_today(), 'bonus');
select public.schedule_salary_change(3600000, '2027-01-01');
insert into public.care_day (space_id, category, kind, name, date_rule, month, day)
  select space_id, 'couple', 'anniversary', '사귄 날', 'solar_yearly', 5, 1 from public.app_user where id = auth.uid();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'debt', 'loan', 'credit', '예빈 대출', 5000000, 'person', auth.uid(), 'all' from public.app_user where id = auth.uid();
select set_config('test.yg', public.add_saving_item('결혼 비용', 300000, 20000000, null, 5000000)::text, true);
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.b', public.bundle_create(current_setting('test.cg')::uuid)::text, true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.bundle_join(current_setting('test.b')::uuid, current_setting('test.yg')::uuid);
reset role;

-- 1. 해제 요청 → 대기: 예빈은 찬우 개인 저금을 못 봄, 묶음은 멈춤
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_unlink('연결 해제');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*)::int from public.goal where id = current_setting('test.cg')::uuid), 0, '해제 대기: 상대 개인 저금 가림');
select is((select (v->>'paused')::boolean from jsonb_array_elements(public.bundle_view()) v), true, '해제 대기: 묶음 멈춤');
-- 2. 확정
select public.agree_unlink();
reset role;
select set_config('test.cs', (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'), true);
select set_config('test.ys', (select space_id::text from public.app_user where id = '22222222-2222-2222-2222-222222222222'), true);
select isnt(current_setting('test.cs'), current_setting('test.space'), '찬우 새 공간');
select results_eq($$ select name from public.asset where space_id = current_setting('test.cs')::uuid $$,
  $$ values ('찬우 주식') $$, '찬우: 내 명의 자산만');
select is((select count(*)::int from public.asset_history h join public.asset a on a.id = h.asset_id
  where a.name = '찬우 주식' and h.space_id = current_setting('test.cs')::uuid), 1, '자산 이력도 함께');
select results_eq($$ select name, bundle_id from public.goal where space_id = current_setting('test.cs')::uuid $$,
  $$ values ('결혼 비용', null::uuid) $$, '찬우: 내 저금(묶음에서 빠짐)');
select is(public.goal_saved(current_setting('test.cg')::uuid), 10000000::bigint, '모은 금액 그대로');
select results_eq($$ select l.kind::text, g.name from public.split_line l join public.salary_split s on s.id = l.split_id
    left join public.goal g on g.id = l.goal_id where s.space_id = current_setting('test.cs')::uuid and l.kind = 'saving' $$,
  $$ values ('saving', '결혼 비용') $$, '찬우 월급 계획(공동 저금 줄은 빠짐)');
select is((select count(*)::int from public.money_in where space_id = current_setting('test.cs')::uuid), 1, '돈 들어왔어요 옮김');
select is((select count(*)::int from public.salary_change where space_id = current_setting('test.cs')::uuid), 1, '월급 변경 옮김');
select results_eq($$ select name from public.asset where space_id = current_setting('test.ys')::uuid $$,
  $$ values ('예빈 대출') $$, '예빈: 내 명의 부채');
-- 같이 쓰던 것은 원래 공간에(보관 뒤 지움)
select results_eq($$ select (select count(*)::int from public.asset where space_id = current_setting('test.space')::uuid),
    (select count(*)::int from public.goal where space_id = current_setting('test.space')::uuid),
    (select count(*)::int from public.care_day where space_id = current_setting('test.space')::uuid),
    (select deleted_at is not null from public.couple_space where id = current_setting('test.space')::uuid) $$,
  $$ values (1, 1, 1, true) $$, '공동 명의·공동 저금·경조사는 원래 공간(보관)');
select is((select status from public.saving_bundle), 'closed', '묶음 해체');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.asset where name = '생활비 통장'), 0, '찬우는 공동 명의를 못 봄');
reset role;

-- 3. 상대 계정 삭제: 남은 사람 것은 그대로(3333 시작, 4444 합류 뒤 삭제)
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'cash', 'bank', '내 통장', 1000000, 'person', auth.uid(), 'all' from public.app_user where id = auth.uid();
select set_config('test.code2', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code2'));
select public.complete_join('[]'::jsonb);
reset role;
update auth.users set last_sign_in_at = now() where id = '44444444-4444-4444-4444-444444444444';
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select public.request_account_deletion();
reset role;
select is((select a.space_id = u.space_id from public.asset a join public.app_user u on u.id = '33333333-3333-3333-3333-333333333333'
  where a.name = '내 통장'), true, '상대가 탈퇴해도 내 명의 자산은 내 새 공간에');
select is((select couple_state::text from public.couple_space s join public.app_user u on u.space_id = s.id
  where u.id = '33333333-3333-3333-3333-333333333333'), 'solo', '혼자 쓰기로');

select * from finish();
rollback;
