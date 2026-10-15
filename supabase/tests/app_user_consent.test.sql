-- pgTAP: 가입(complete_signup), 로그인 판단(login_state), app_user와 consent 권한
-- 찬우(카카오, 이메일 있음, 구글도 같은 이메일로 연결됨), 예빈(카카오, 이메일 제공 거부)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ChanWoo@Example.com'),
  ('22222222-2222-2222-2222-222222222222', null);
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('google-c', '11111111-1111-1111-1111-111111111111', '{}', 'google'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 익명
set local role anon;
select throws_ok($$ select public.login_state('kakao') $$, '42501', null, '익명은 login_state를 못 부른다');
select throws_ok($$ select public.complete_signup('kakao', null, false, 'v1') $$, '42501', null, '익명은 가입 함수를 못 부른다');
select is((select count(*)::int from public.app_user), 0, '익명은 사용자를 못 본다');
reset role;

-- 예빈: 가입 전, 이메일 없음
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.login_state('kakao') ->> 'state', 'new', '가입 전이면 new');
select is((public.login_state('kakao') ->> 'needs_email')::boolean, true, '카카오 이메일 거부면 A-04 필요');
select throws_ok($$ select public.complete_signup('kakao', null, false, 'v1') $$, 'P0001', 'email_required', '이메일 없이 가입 못 함');
select throws_ok($$ select public.complete_signup('google', 'a@b.co', false, 'v1') $$, 'P0001', 'provider_mismatch', '로그인하지 않은 제공자로 가입 못 함');
select is((select notify_email from public.complete_signup('kakao', '  YeBin@Mail.com ', true, 'v1')), 'yebin@mail.com', 'A-04 입력값은 공백 제거, 소문자');
reset role;

-- 찬우: 가입
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select notify_email_source::text from public.complete_signup('kakao', null, false, 'v1')), 'provider', '소셜 이메일로 가입');
select throws_ok($$ select public.complete_signup('kakao', null, false, 'v1') $$, 'P0001', 'already_signed_up', '두 번 가입 못 함');
select is(public.login_state('kakao') ->> 'state', 'existing', '같은 제공자면 existing');
select is(public.login_state('google') ->> 'state', 'provider_conflict', '다른 소셜이면 provider_conflict(자동 합치기 없음)');
select is(public.login_state() ->> 'state', 'existing', '누른 버튼이 없으면(재방문) 제공자 비교 안 함');
select is((select count(*)::int from public.app_user), 1, '본인 행만 보인다');
select is((select count(*)::int from public.consent where agreed), 3, '필수 3종 동의, 마케팅은 안 함');

-- 바꿀 수 없는 열과 다른 사람 행
select throws_ok($$ update public.app_user set status = 'deleted' $$, '42501', null, '상태는 못 바꾼다');
select throws_ok($$ update public.app_user set is_internal_tester = true $$, '42501', null, '테스터 표시는 못 바꾼다');
select is((select version from public.app_user where id = '11111111-1111-1111-1111-111111111111'), 1, '버전 시작은 1');
update public.app_user set onboarding_step = 'O-05';
update public.app_user set onboarding_step = 'x' where id = '22222222-2222-2222-2222-222222222222';
select is((select version from public.app_user), 2, '온보딩 단계는 바꿀 수 있고 version이 오른다');

-- 동의 기록은 추가만
select throws_ok($$ update public.consent set agreed = false $$, '42501', null, '동의 기록 수정 못 함');
select throws_ok(
  $$ insert into public.consent (user_id, kind, terms_version, agreed, source)
     values ('22222222-2222-2222-2222-222222222222', 'marketing', 'v1', false, 'settings') $$,
  '42501', null, '다른 사람 이름으로 동의 추가 못 함');
reset role;

select is((select onboarding_step from public.app_user where id = '22222222-2222-2222-2222-222222222222'), null, '찬우는 예빈 행을 못 바꿨다');

select * from finish();
rollback;
