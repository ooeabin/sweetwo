-- pgTAP: QA 9구간 캘린더·경조사(2026-11-12). 서프라이즈·21자 넘는 이름 거절(S9-13 D2), 옛 행은 그대로 고침·기록,
-- Realtime 발행(S9-03)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();

-- 이름 20자까지는 됨, 21자는 거절(앞뒤 공백은 안 셈)
select lives_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day)
  select space_id, 'couple', 'birthday', '  ' || repeat('가', 20) || '  ', 'solar_yearly', 3, 9 from public.app_user $$,
  '이름 20자는 됨');
select throws_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day)
  select space_id, 'couple', 'birthday', repeat('가', 21), 'solar_yearly', 3, 9 from public.app_user $$,
  '23514', 'care_name_too_long', '이름 21자는 거절');
select throws_ok($$ update public.care_day set name = repeat('나', 21) $$,
  '23514', 'care_name_too_long', '고칠 때도 21자는 거절');
select throws_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day, secret)
  select space_id, 'couple', 'birthday', '서프라이즈', 'solar_yearly', 3, 9, true from public.app_user $$,
  '23514', 'care_secret_removed', '새 서프라이즈 거절');
select throws_ok($$ update public.care_day set secret = true $$,
  '23514', 'care_secret_removed', '있는 경조사를 서프라이즈로 못 바꿈');
reset role;

-- 지금 있는 옛 행(서버로 넣음): 긴 이름, 서프라이즈
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, secret, created_by)
  select space_id, 'couple', 'birthday', repeat('다', 25), 'solar_yearly', 5, 1, true, id
  from public.app_user where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ update public.care_day set memo = '메모', status = 'preparing' where name = repeat('다', 25) $$,
  '옛 긴 이름·서프라이즈 행도 메모·준비 상황은 고침');
select lives_ok(format($$ select public.record_care(%L, '2026-05-01', 10000, 'personal', '{}', null, null, 0) $$,
  (select id from public.care_day where name = repeat('다', 25))), '옛 행도 기록함');
select lives_ok($$ update public.care_day set secret = false where name = repeat('다', 25) $$,
  '서프라이즈 끄기는 됨');
select lives_ok($$ update public.care_day set name = '어머니 생신' where name = repeat('다', 25) $$,
  '긴 이름을 20자 안으로 고치기는 됨');
reset role;

-- 함수 안(security definer)은 걸리지 않음: 서버가 넣는 행
select lives_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day)
  select space_id, 'couple', 'event', repeat('라', 25), 'solar_yearly', 6, 1 from public.app_user
  where id = '11111111-1111-1111-1111-111111111111' $$,
  '서버(함수 주인)는 그대로');

-- Realtime 발행
select ok(exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'care_day'), 'care_day 발행');
select ok(exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'care_record'), 'care_record 발행');

select * from finish();
rollback;
