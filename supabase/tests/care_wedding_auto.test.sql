-- pgTAP: 자동으로 만드는 결혼기념일(24). 결혼한 날을 넣으면 하나 만들고, 바꾸면 옮기고, 직접 고치거나 지우면 그대로. 찬우
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();

-- 준비 중(예정일)은 만들지 않음
update public.couple_space set marriage_status = 'engaged', wedding_date = '2027-05-15';
select is((select count(*) from public.care_day), 0::bigint, '준비 중이면 없음');

-- 결혼했어요 + 결혼한 날 → 결혼기념일 하나
update public.couple_space set marriage_status = 'married', wedding_date = '2025-05-17';
select is((select name || ' ' || month || '-' || day || ' ' || date_rule from public.care_day where auto = 'wedding'),
  '결혼기념일 5-17 solar_yearly', '결혼기념일 자동 생성');
select is((select alerts from public.care_day where auto = 'wedding'), '{30,7}'::smallint[], '미리 알림은 기본값');

-- 결혼한 날을 바꾸면 날짜도 옮김, 하나만
update public.couple_space set wedding_date = '2025-06-07';
select is((select month || '-' || day from public.care_day where auto = 'wedding'), '6-7', '결혼한 날을 바꾸면 옮김');
select is((select count(*) from public.care_day), 1::bigint, '하나만');

-- 사람이 날짜를 직접 고치면 더는 옮기지 않음
update public.care_day set day = 8 where auto = 'wedding';
update public.couple_space set wedding_date = '2025-06-14';
select is((select month || '-' || day from public.care_day where auto = 'wedding'), '6-8', '직접 고친 날짜는 그대로');

-- 지운 뒤에는 다시 만들지 않음
update public.care_day set deleted_at = now() where auto = 'wedding';
update public.couple_space set wedding_date = '2025-07-05';
select is((select count(*) from public.care_day where deleted_at is null), 0::bigint, '지운 뒤 다시 안 만듦');
select is((select count(*) from public.care_day), 1::bigint, '지운 것 하나만 남음');
reset role;

select * from finish();
rollback;
