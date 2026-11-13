-- pgTAP: v2.2 관리 형태(20261202090000 계약 1·2). 2-5 표 6줄, 혼자일 때 바로, 수락이 필요한 경로(각자 → 합쳐서,
-- 관리하는 사람을 상대로), 거절·만료·취소 뒤 그대로, 바로 적용 경로(합쳐서 → 각자)
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);
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
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25, onboarding_done_at = now() where id = auth.uid();
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

-- 1. 2-5 표
select results_eq(
  $$ select r.salary_mode::text, r.manager, r.style from (values
       (true, null::boolean, 'me'), (true, true, 'partner'), (true, false, 'together'),
       (true, true, 'each'), (true, false, 'each'), (false, true, null), (false, false, 'me')) v(a, b, c)
     cross join lateral public.resolve_manage_style(v.a, v.b, v.c) r $$,
  $$ values ('joint', 'me', 'one_manager'), ('joint', 'partner', 'one_manager'), ('joint', null, 'together'),
            ('separate', null, 'living_saving'), ('separate', null, 'living_only'), ('separate', null, 'saving_only'),
            ('separate', null, 'separate') $$,
  '2-5 표 여섯 줄(생활비 아니요면 누가 관리는 무시)');
select throws_ok($$ select * from public.resolve_manage_style(true, true, null) $$, '22023', 'need_manager', '생활비 네면 누가 관리 필요');

-- 2. 합류 전(혼자): 바로 적용
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.request_mode_change(true, true, 'each'), 'applied', '혼자면 바로');
select results_eq($$ select salary_mode::text, shared_living, shared_saving, manager_user_id, style from public.my_manage_style() $$,
  $$ values ('separate', true, true, null::uuid, 'living_saving') $$, '생활비와 저금을 같이 해요');
reset role;

-- 3. 합류 뒤 각자 → 합쳐서(P-04 ‘월급은 대부분 찬우님에게 보내요’) = 요청
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
delete from public.notification;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.request_mode_change(true, true, 'partner', 'p04_send'), 'requested', '각자 → 합쳐서는 요청');
reset role;
select results_eq($$ select to_mode::text, to_manager, status from public.mode_change_request $$,
  $$ values ('joint', '11111111-1111-1111-1111-111111111111'::uuid, 'open') $$, '관리하는 사람 = 찬우');
select is((select title from public.notification where kind = 'mode_request' and user_id = '11111111-1111-1111-1111-111111111111'),
  '예빈님이 월급은 대부분 찬우님에게 보낸다고 했어요', '요청 알림 문구(4-3 3번)');
select is((select salary_mode::text from public.couple_space where created_by = '11111111-1111-1111-1111-111111111111'),
  'separate', '수락 전에는 그대로');
-- 보낸 사람은 답 못 함, 받은 사람은 취소 못 함
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(format('select public.answer_mode_change(%L, true)', (select id from public.mode_change_request)),
  '42501', 'not_found', '보낸 사람은 답 못 함');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format('select public.cancel_mode_change(%L)', (select id from public.mode_change_request)),
  '42501', 'not_found', '받은 사람은 취소 못 함');
-- 거절 → 그대로 + 결과 알림
select is(public.answer_mode_change((select id from public.mode_change_request), false), 'declined', '지금처럼 할게요');
reset role;
select is((select salary_mode::text from public.couple_space where created_by = '11111111-1111-1111-1111-111111111111'),
  'separate', '거절이면 각자 그대로');
select is((select title from public.notification where kind = 'mode_result'), '지금처럼 각자 관리해요', '거절 결과 알림');

-- 4. 만료: 답하면 expired, 그대로
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_mode_change(true, true, 'together');
reset role;
update public.mode_change_request set expires_at = now() - interval '1 minute' where status = 'open';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.answer_mode_change((select id from public.mode_change_request where status = 'open'), true), 'expired', '만료');
reset role;
select is((select salary_mode::text from public.couple_space where created_by = '11111111-1111-1111-1111-111111111111'),
  'separate', '만료면 그대로');

-- 5. 취소
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_mode_change(true, true, 'together');
select lives_ok(format('select public.cancel_mode_change(%L)', (select id from public.mode_change_request where status = 'open')),
  '보낸 사람이 취소');
reset role;
select is((select count(*)::int from public.mode_change_request where status = 'open'), 0, '열린 요청 없음');

-- 6. 수락 → 한 사람 관리형(관리하는 사람 = 찬우)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_mode_change(true, true, 'partner', 'p04_send');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.answer_mode_change((select id from public.mode_change_request where status = 'open'), true), 'accepted', '좋아요');
select results_eq($$ select salary_mode::text, manager_user_id, style from public.my_manage_style() $$,
  $$ values ('joint', '11111111-1111-1111-1111-111111111111'::uuid, 'one_manager') $$, '한 사람이 관리해요');
-- 같이 계열 안에서 관리하는 사람을 상대(예빈)로 = 요청, 나로·없음 = 바로
select is(public.request_mode_change(true, true, 'partner'), 'requested', '관리를 상대에게 넘기면 수락 필요');
select is(public.request_mode_change(true, true, 'together'), 'applied', '둘이 같이(관리하는 사람 없음)는 바로');
select is((select count(*)::int from public.mode_change_request where status = 'open'), 0, '바로 적용하면 열린 요청은 닫힘');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.request_mode_change(true, true, 'me'), 'applied', '내가 관리하기는 바로(상대에게 일을 넘기지 않음)');
-- 7. 같이 계열 → 각자 계열: 바로 + 상대 알림
select is(public.request_mode_change(false, false, null), 'applied', '합쳐서 → 각자는 바로');
reset role;
select results_eq($$ select salary_mode::text, manager_user_id from public.couple_space
    where created_by = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('separate', null::uuid) $$, '각자 따로, 관리하는 사람 없음');

select * from finish();
rollback;
