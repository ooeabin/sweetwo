-- pgTAP: v2.2 공개 단계(20261202090000 계약 3). 세 단계마다 파트너 응답(partner_plan_view)과 RLS 행,
-- 같이 계열은 모두, 해제 대기면 가림, S-13p 미리 보기 = 같은 함수, 남의 공간 거절
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
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
delete from public.notification;
create function pg_temp.view_kinds() returns text language sql as $$
  select string_agg((x->>'kind') || ':' || coalesce(x->>'amount', '-'), ',' order by ord)
  from jsonb_array_elements(public.partner_plan_view()->'lines') with ordinality t(x, ord);
$$;
create function pg_temp.rls_kinds() returns text language sql as $$
  select coalesce(string_agg(l.kind::text, ',' order by l.sort), '') from public.split_line l
  join public.salary_split s on s.id = l.split_id where s.owner_user_id = '11111111-1111-1111-1111-111111111111';
$$;

-- 1. 기본 ‘저금만 보여 주기’: 저금 줄 금액만, 수입 없음
select is((select plan_share::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'), 'saving_only', '기본값(Q1)');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(pg_temp.view_kinds(), 'saving:950000', '저금만: 저금 줄 금액');
select is((public.partner_plan_view()->>'income'), null, '저금만: 수입 없음');
select is(pg_temp.rls_kinds(), 'saving', '저금만: RLS도 저금 줄만');
select is((select monthly_income from public.partner_profile()), null, '저금만: partner_profile 수입 없음');
reset role;

-- 2. ‘했어요만’: 확인 여부만(이름·금액 없음, 2026-11-13 P1 = A), RLS 행 없음
update public.app_user set plan_share = 'done_only' where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(pg_temp.view_kinds(), 'saving:-', '했어요만: 금액 없음');
select is((public.partner_plan_view()->'lines'->0->>'name'), null, '했어요만: 저금 이름도 없음');
select is(pg_temp.rls_kinds(), '', '했어요만: RLS 행 없음');
reset role;

-- 3. ‘모두 보여 주기’: 모든 줄 + 수입
update public.app_user set plan_share = 'all' where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(pg_temp.view_kinds(), 'saving:950000,fixed:680000,living:880000', '모두: 모든 줄');
select is((public.partner_plan_view()->>'income')::bigint, 3500000::bigint, '모두: 수입');
select is(pg_temp.rls_kinds(), 'saving,fixed,living', '모두: RLS도');
select is((select monthly_income from public.partner_profile()), 3500000::bigint, '모두: partner_profile 수입');
reset role;

-- 4. S-13p 미리 보기: 찬우가 ‘예빈으로서’ 부르면 예빈이 보는 것과 같음
update public.app_user set plan_share = 'saving_only' where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('test.as_yebin', public.partner_plan_view()::text, true);
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.partner_plan_view('22222222-2222-2222-2222-222222222222'::uuid)::text, current_setting('test.as_yebin'),
  '미리 보기 = 상대가 보는 것');
reset role;
-- 다른 공간 사람은 부를 수 없음
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select throws_ok($$ select public.partner_plan_view('22222222-2222-2222-2222-222222222222'::uuid) $$, '42501', 'not_found',
  '남의 공간 거절');
reset role;

-- 5. 해제 대기: 가림
update public.couple_space set couple_state = 'unlink_pending' where created_by = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((public.partner_plan_view()->>'hidden')::boolean, true, '해제 대기면 가림');
select is(pg_temp.rls_kinds(), '', '해제 대기면 RLS 행 없음');
reset role;
update public.couple_space set couple_state = 'connected' where created_by = '11111111-1111-1111-1111-111111111111';

-- 6. 같이 계열: 공개 단계와 상관없이 공동 월급 계획 모두
update public.app_user set plan_share = 'done_only';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
reset role; select public.set_salary_mode('joint'); set local role authenticated; -- 앱 역할은 못 부름(20261205090000)
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((public.partner_plan_view()->>'mode'), 'joint', '같이 계열');
select ok(jsonb_array_length(public.partner_plan_view()->'lines') >= 3 and (public.partner_plan_view()->>'income') is not null,
  '같이 계열은 모든 줄과 수입');
select ok((select monthly_income from public.partner_profile()) is not null, '같이 계열 partner_profile 수입');
reset role;

select * from finish();
rollback;
