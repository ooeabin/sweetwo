-- pgTAP: v2.2 합류 보완(20261206090000 계약 1~3). 합류 전 ‘파트너가 주로 해요’ → 합류한 사람이 관리하는 사람,
-- join_context 관리 형태, 대기 ‘알려 주기’ 24시간 1번
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우: 생활비 네 + ‘파트너가 주로 해요’(합류 전), 월급 계획은 아직 없음
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select is(public.request_mode_change(true, false, 'partner'), 'applied', '혼자면 바로');
select results_eq($$ select salary_mode::text, manager_user_id, style from public.my_manage_style() $$,
  $$ values ('joint', null::uuid, 'one_manager') $$, '합류 전 파트너가 주로: 합쳐서, 관리하는 사람은 아직 없음, 이름은 한 사람 관리형');
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

-- 예빈: 합류하는 중 join_context에 관리 형태
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select results_eq(
  $$ select x->>'style', x->>'manager', (x->>'shared_living')::boolean, (x->>'has_plan')::boolean
     from (select public.join_context() x) t $$,
  $$ values ('one_manager', 'joiner', true, false) $$, 'join_context: 형태 이름, 합류한 사람이 관리, 월급 계획 없음');
-- 같이 계열 대기: 합류만(월급 계획 없이)
select public.complete_join(null);
select is((select manager_user_id from public.couple_space where created_by = '11111111-1111-1111-1111-111111111111'),
  '22222222-2222-2222-2222-222222222222'::uuid, '합류를 마치면 합류한 사람이 관리하는 사람');
select is((select manager_pending_partner from public.couple_space where created_by = '11111111-1111-1111-1111-111111111111'),
  false, '기억은 지움');
-- 알려 주기
select is(public.nudge_starter(), 'sent', '대기 중 알려 주기');
select is(public.nudge_starter(), 'too_soon', '24시간에 1번');
reset role;
select is((select title from public.notification where kind = 'join_nudge'),
  '예빈님이 기다리고 있어요. 월급 계획을 마쳐 주세요', '시작한 사람에게 알림');
update public.notification set created_at = now() - interval '25 hours' where kind = 'join_nudge';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.nudge_starter(), 'sent', '24시간 뒤 다시');
reset role;

-- 찬우가 월급 계획을 만들면 더는 대기가 아님. 찬우는 관리하지 않는 쪽이라 보내기 줄이 생김
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 1000000),
  jsonb_build_object('kind', 'allowance', 'amount', 300000, 'user_id', '11111111-1111-1111-1111-111111111111')), null);
reset role;
select results_eq($$ select l.user_id, l.amount, l.auto_pay from public.split_line l where l.kind = 'send' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 3200000::bigint, true) $$, '찬우 보내기 = 월급 − 용돈');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.nudge_starter(), 'not_waiting', '월급 계획이 생기면 대기 아님');
reset role;

-- 계약 4: 온보딩을 마치기 전(찬우는 아직 onboarding_done_at 없음)이면 연결돼 있어도 각자 → 합쳐서를 바로
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_mode_change(true, false, 'each');
select is(public.request_mode_change(true, true, 'together'), 'applied', '온보딩 중 답은 연결돼 있어도 바로');
reset role;

-- 다른 답으로 바꾸면 기억을 지움
update public.couple_space set manager_pending_partner = true, manager_user_id = null, couple_state = 'not_joined';
update public.app_user set space_id = null where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_mode_change(true, false, 'together');
reset role;
select is((select manager_pending_partner from public.couple_space where created_by = '11111111-1111-1111-1111-111111111111'),
  false, '둘이 같이로 바꾸면 기억 지움');

select * from finish();
rollback;
