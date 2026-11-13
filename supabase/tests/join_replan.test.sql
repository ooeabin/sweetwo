-- pgTAP: 파트너 합류 재기획(18). 관리 방식 바꾸기(P-04), 합류 완료(P-06, 대기), 첫 월급 계획 알림. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'starter2@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'joiner2@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-s', '33333333-3333-3333-3333-333333333333', '{}', 'kakao'),
  ('kakao-j', '44444444-4444-4444-4444-444444444444', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- v2.2 D1 첫 사이클 소급 없음(20261201090000): 이 테스트는 이번 사이클 목록이 필요해 월급 계획 시작일 제한을 풂
create function pg_temp.no_backdate() returns void language sql security definer as $$
  update public.salary_split set checklist_from = null;
$$;

-- 찬우: 각자, 월급 계획과 체크리스트, 초대
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 150000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000)
), auth.uid());
select pg_temp.no_backdate();
select public.start_checklist(auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
select throws_ok($$ select public.complete_join() $$, '42501', 'not_joining', '합류 중이 아니면 못 함');
reset role;

-- 예빈 합류: 합쳐서로 바꿈 → 찬우 월급 계획·체크리스트가 공동 것, 찬우 알림
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is(public.join_space(current_setting('test.code')), 'joined', '코드로 합류 시작');
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.set_join_salary_mode('joint');
reset role;
select is((select count(*) from public.salary_split where owner_user_id is null), 1::bigint, '찬우 월급 계획이 공동 월급 계획으로');
select is((select count(*) from public.pay_checklist where owner_user_id is null), 1::bigint, '찬우 체크리스트가 공동 체크리스트로');
select is((select title from public.notification where kind = 'salary_mode'), '예빈님이 월급 관리 방식을 바꿨어요', '찬우에게 알림');

-- P-06: 연 뒤에 월급 계획이 바뀌었으면 거절, 맞으면 저장 + 연결
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*)::int from public.salary_split), 0, '합류를 마치기 전에는 공동 월급 계획을 직접 못 읽음(D1)');
select set_config('test.v', public.join_context()->'joint'->>'version', true);
select throws_ok(format($$ select public.complete_join('[]'::jsonb, %s) $$, current_setting('test.v')::int - 1),
  '40001', 'split_changed', '월급 계획이 바뀌었으면 다시');
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (public.join_context()->'joint'->'items'->0->>'id')::uuid, 'amount', 2500000),
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'user_id', '11111111-1111-1111-1111-111111111111', 'amount', 350000),
  jsonb_build_object('kind', 'allowance', 'user_id', '22222222-2222-2222-2222-222222222222', 'amount', 270000)
), current_setting('test.v')::int);
select is((select onboarding_step from public.app_user where id = auth.uid()), 'P-06', '합류 완료');
reset role;
select is((select couple_state::text from public.couple_space where created_by = '11111111-1111-1111-1111-111111111111'),
  'connected', '커플 연결');
select is((select body from public.notification where kind = 'partner_joined'), '이제 월급과 저금을 같이 봐요', '합류 알림');
select is((select count(*) from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.owner_user_id is null and l.kind = 'allowance'), 0::bigint,
  'v2.2(D2): 용돈 줄은 기본으로 확인 목록에 넣지 않음');

-- 시작한 사람이 아직 온보딩 중: P-05 저장 = 대기, 시작한 사람이 끝내면 “월급 계획을 만들었어요”
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '시작' where id = auth.uid();
select set_config('test.code2', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code2'));
select public.complete_join();
select is((select onboarding_step from public.app_user where id = auth.uid()), 'P-WAIT', '대기');
reset role;
update public.app_user set onboarding_done_at = now() where id = '33333333-3333-3333-3333-333333333333';
select is((select title from public.notification where kind = 'first_goal'), '시작님이 월급 계획을 만들었어요', '첫 월급 계획 알림');

select * from finish();
rollback;
