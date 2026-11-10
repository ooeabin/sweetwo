-- pgTAP: QA 2구간 온보딩 고침(2026-11-10). 찬우(시작한 사람)
-- onboarding_reset_plan(S2-01), 결혼했어요가 아니면 자동 결혼기념일 지움(S2-09), 이름 한도 코드 포인트 40(S2-19)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
update public.app_user set monthly_income = 3500000, payday = 25 where id = auth.uid();

-- 1) 온보딩 중 다시 만들기: 지우고 새로 저장 → 체크리스트도 새 월급날로
select public.save_split('[{"kind":"fixed","amount":880000},{"kind":"living","amount":880000}]'::jsonb, auth.uid());
select public.start_checklist(auth.uid());
select is((select count(*) from public.pay_checklist), 1::bigint, '첫 체크리스트');
select public.onboarding_reset_plan();
select is((select count(*) from public.salary_split), 0::bigint, '온보딩 중이면 월급 계획을 지움');
select is((select count(*) from public.pay_checklist), 0::bigint, '체크리스트도 지움');
update public.app_user set payday = 10 where id = auth.uid();
select public.save_split('[{"kind":"fixed","amount":1250000}]'::jsonb, auth.uid());
select public.start_checklist(auth.uid());
select is((select count(*) from public.pay_checklist), 1::bigint, '다시 하나');
select is((select extract(day from cycle_start)::int from public.pay_checklist), 10, '새 월급날 기준');

-- 체크한 줄이 있으면 지우지 않음
select public.check_pay_line((select id from public.pay_check_line limit 1), 'checked');
select public.onboarding_reset_plan();
select is((select count(*) from public.pay_checklist), 1::bigint, '체크한 기록이 있으면 그대로');

-- 온보딩을 마친 뒤에는 쓸 수 없음
reset role;
update public.app_user set onboarding_done_at = now() where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select throws_ok('select public.onboarding_reset_plan()', '42501', 'onboarding_done', '온보딩을 마친 뒤에는 거부');

-- 2) 자동 결혼기념일: 결혼했어요 → 준비 중으로 바꾸면 지움, 다시 결혼했어요면 다시 만듦
update public.couple_space set marriage_status = 'married', wedding_date = '2026-10-07';
select is((select count(*) from public.care_day where auto = 'wedding'), 1::bigint, '결혼했어요 + 날짜 = 하나');
update public.couple_space set marriage_status = 'engaged', wedding_date = null;
select is((select count(*) from public.care_day where auto = 'wedding'), 0::bigint, '결혼했어요가 아니면 지움');
update public.couple_space set marriage_status = 'married', wedding_date = '2025-05-17';
-- 직접 고친 것은 그대로
update public.care_day set day = 18 where auto = 'wedding';
update public.couple_space set marriage_status = 'undecided', wedding_date = null;
select is((select count(*) from public.care_day where auto = 'wedding' and deleted_at is null), 1::bigint, '직접 고쳤으면 그대로');

-- 3) 이름: 코드 포인트 40까지(커플 이모지 여럿)
select lives_ok($$update public.app_user set nickname = repeat('👩‍❤️‍👨', 4) where id = auth.uid()$$, '이모지 4개(코드 포인트 24) 저장');
select throws_ok($$update public.app_user set nickname = repeat('가', 41) where id = auth.uid()$$, '23514', null, '41자는 거부');
reset role;

select * from finish();
rollback;
