-- pgTAP: 알림 설정. 내 설정만 바꿈, 앞당기기는 부부 공통으로 바꿈, 알림 묶음 열
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select lives_ok($$ update public.app_user set noti_prefs = '{"push":false}', quiet_start = 23, quiet_end = 7 $$, '알림 설정 저장');
select throws_ok($$ update public.app_user set quiet_start = 24 $$, '23514', null, '시각은 0~23');
select lives_ok($$ update public.couple_space set holiday_shift = false $$, '앞당기기 끄기');
reset role;

select public.notify('11111111-1111-1111-1111-111111111111', null, 'care_day', '추석이 일주일 남았어요', null,
  '/calendar', 'gift', null, 'care:x:2026-09-25:7:11111111-1111-1111-1111-111111111111');
select public.notify('11111111-1111-1111-1111-111111111111', null, 'proposal_arrived', '제안', null,
  '/proposals/x', null, null, 'proposal:x:arrived');
select results_eq($$ select topic from public.notification order by kind $$,
  $$ values ('care_7'), ('proposal') $$, '알림 묶음');
select is((select noti_prefs->>'push' from public.app_user), 'false', '저장된 값');

select * from finish();
rollback;
