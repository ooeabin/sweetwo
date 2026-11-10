-- pgTAP: 가입 동의 버전(시행 중 버전), 가입을 끝내지 않은 계정 정리, 마케팅 결과 통지(15 A-05, 31 5-1)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com', now() - interval '25 hours'),
  ('33333333-3333-3333-3333-333333333333', 'new@example.com', now() - interval '2 hours'),
  ('44444444-4444-4444-4444-444444444444', 'admin@sweetwo.kr', now() - interval '3 days');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('google-y', '22222222-2222-2222-2222-222222222222', '{}', 'google'),
  ('apple-n', '33333333-3333-3333-3333-333333333333', '{}', 'apple'),
  ('admin@sweetwo.kr', '44444444-4444-4444-4444-444444444444', '{}', 'email');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 이용약관 v3이 어제부터 시행(AD-15 승인). 개인정보는 등록된 버전이 없음
insert into public.terms_version (kind, version, effective_on, reconsent, status, approved_at) values
  ('terms', 'v3', (now() at time zone 'Asia/Seoul')::date - 1, false, 'approved', now()),
  ('terms', 'v4', (now() at time zone 'Asia/Seoul')::date + 7, false, 'approved', now());

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(
  $$ select public.complete_signup_v2('kakao', null, true, '{"terms":"v2","privacy":"v1"}'::jsonb) $$,
  'terms_version_required', '문서 버전이 빠지면 거부');
select public.complete_signup_v2('kakao', null, true,
  '{"terms":"v2","privacy":"v1","space_sharing":"v1","marketing":"v1"}'::jsonb);
select results_eq(
  $$ select kind::text, terms_version, agreed from public.consent order by kind::text $$,
  $$ values ('marketing', 'v1', true), ('privacy', 'v1', true), ('space_sharing', 'v1', true), ('terms', 'v3', true) $$,
  '이용약관은 시행 중 버전(v3), 나머지는 앱이 보여 준 버전');
select isnt((select adult_confirmed_at from public.app_user), null, '만 18세 확인 시각');
reset role;

-- 마케팅 결과 통지: 가입 때 ‘받기’ → 동의 알림 1건
select results_eq(
  $$ select kind, title from public.notification where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('marketing_result', '마케팅 정보 받기에 동의했어요') $$, '가입 때 받기면 동의 결과 알림');
select matches(
  (select body from public.notification where kind = 'marketing_result' limit 1),
  '^\d{4}년 \d{1,2}월 \d{1,2}일 sweeTwo가 처리했어요$', '날짜와 보낸 곳');

-- 설정 S-14에서 끔 → 거부 결과 알림
set local role authenticated;
insert into public.consent (user_id, kind, terms_version, agreed, source)
  values ('11111111-1111-1111-1111-111111111111', 'marketing', 'v1', false, 'settings');
reset role;
select is((select distinct target from public.notification where kind = 'marketing_result'), '/settings/notifications',
  '누르면 S-14 알림 설정');
select is((select count(*)::int from public.notification where title = '마케팅 정보 받기를 거부했어요'), 1, '끄면 거부 결과 알림');
-- 다른 동의 종류는 알리지 않음
insert into public.consent (user_id, kind, terms_version, agreed, source)
  values ('11111111-1111-1111-1111-111111111111', 'photo', 'v1', true, 'care_day_first');
select is((select count(*)::int from public.notification where kind = 'marketing_result'), 2, '마케팅만');

-- 예전 함수(옛 앱)도 같은 규칙
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('apple', null, false, '2026-10-v1');
select results_eq(
  $$ select kind::text, terms_version from public.consent order by kind::text $$,
  $$ values ('marketing', '2026-10-v1'), ('privacy', '2026-10-v1'), ('space_sharing', '2026-10-v1'), ('terms', 'v3') $$,
  '옛 함수도 이용약관은 시행 중 버전');
reset role;
select is((select count(*)::int from public.notification where user_id = '33333333-3333-3333-3333-333333333333'), 0,
  '가입 때 안 받기는 알리지 않음');

-- 가입을 끝내지 않은 계정: 24시간 지난 소셜 계정만 지움(가입한 사람, 24시간 안, 관리자 로그인은 그대로)
delete from public.app_user where id = '33333333-3333-3333-3333-333333333333';
select is(public.purge_abandoned_signups(), 1, '24시간 지난 미가입 소셜 계정 1개');
select results_eq($$ select id::text from auth.users order by id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'), ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444') $$,
  '가입한 계정, 24시간 안 계정, 관리자는 남음');

select * from finish();
rollback;
