-- pgTAP: 초대 미리보기, 합류, 배우자 프로필, 합류 완료(P-01, P-11)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'k@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('google-k', '33333333-3333-3333-3333-333333333333', '{}', 'google');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우: 가입, 공간, 예빈 추정 수입, 초대 코드
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom', monthly_income = 3500000, payday = 25, allowance = 500000;
update public.couple_space set partner_nickname = '예빈', partner_income = 2500000, partner_income_estimated = true;
select set_config('test.code', (select code from public.create_invite()), true);
select is(public.join_space(current_setting('test.code')), 'own_code', '내가 만든 코드');
reset role;

-- 로그인 전 미리보기
set local role anon;
select is((select inviter_nickname from public.invite_preview(current_setting('test.code'))), '찬우', '익명도 초대한 사람 호칭을 본다');
select is((select status from public.invite_preview('AAAAAA')), 'invalid', '없는 코드');
reset role;

-- 예빈: 가입 → 합류
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is(public.join_space(current_setting('test.code')), 'joined', '합류');
select results_eq(
  $$ select nickname, side::text, monthly_income, onboarding_step from public.app_user $$,
  $$ values ('예빈'::text, 'bride'::text, 2500000::bigint, 'P-03'::text) $$,
  '찬우가 적은 호칭, 추정 수입이 초기값, 반대쪽');
select is(public.join_space(current_setting('test.code')), 'resume', '같은 코드로 다시 열면 이어서');
select is((select nickname from public.partner_profile()), '찬우', '배우자 프로필');
select lives_ok($$ select public.finish_join() $$, '합류 완료');
select is((select couple_state::text from public.couple_space), 'connected', '부부 연결');
select isnt((select used_at from public.invite), null, '코드 사용됨');
reset role;

-- K: 이미 쓴 코드, 5회 오류 제한, 남의 배우자 못 봄
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select is(public.join_space(current_setting('test.code')), 'used', '이미 합류가 끝난 초대');
select public.join_space('ZZZZZZ') from generate_series(1, 5);
select is(public.join_space('ZZZZZZ'), 'locked', '5회 오류면 10분 제한');
select is((select count(*)::int from public.partner_profile()), 0, '다른 부부의 배우자는 안 보인다');
select throws_ok($$ select public.finish_join() $$, '42501', null, '합류 중이 아니면 완료 못 한다');
reset role;

select * from finish();
rollback;
