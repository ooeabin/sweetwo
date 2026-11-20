-- pgTAP: set_payday_income(20261225090000, 2026-11-20 사용자 결정). 수입 카드 기본값을 고쳐 저장.
-- 혼자 쓰는 사람 둘(4444, 5555), 찬우·예빈(합쳐서 공동 목록)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'solo@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-s', '44444444-4444-4444-4444-444444444444', '{}', 'kakao'),
  ('kakao-o', '55555555-5555-5555-5555-555555555555', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.mk(uid uuid, nick text, pay bigint) returns void language plpgsql as $$
begin
  perform pg_temp.login_as(uid);
  set local role authenticated;
  perform public.complete_signup('kakao', null, false, 'v1');
  perform public.ensure_my_space();
  update public.couple_space set holiday_shift = false where id = (select space_id from public.app_user where id = uid);
  update public.app_user set nickname = nick, monthly_income = pay, payday = 1 where id = uid;
  perform public.save_split(jsonb_build_array(
    jsonb_build_object('kind', 'fixed', 'amount', 700000),
    jsonb_build_object('kind', 'custom', 'name', '관리비', 'amount', 200000)), uid);
  reset role;
end $$;
select pg_temp.mk('44444444-4444-4444-4444-444444444444', '혼자', 3500000);
select pg_temp.mk('55555555-5555-5555-5555-555555555555', '남', 2000000);
update public.salary_split set checklist_from = null where owner_user_id in
  ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', public.kst_today());
select public.make_checklist((select space_id from public.app_user where id = '55555555-5555-5555-5555-555555555555'),
  '55555555-5555-5555-5555-555555555555', public.kst_today());
create function pg_temp.cl(p_owner uuid) returns uuid language sql as $$
  select id from public.pay_checklist where owner_user_id = p_owner order by cycle_start desc limit 1;
$$;
create function pg_temp.autos(p_owner uuid) returns integer language sql as $$
  select count(*)::int from public.money_in where owner_user_id = p_owner and source = 'payday_auto' and deleted_at is null;
$$;

-- ── 혼자: 300만 원으로 저장 ──
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select isnt(public.set_payday_income(pg_temp.cl('44444444-4444-4444-4444-444444444444'), 3000000), null, '저장하면 기록 id를 돌려줌');
select results_eq(
  $$ select amount, kind::text, received_on, source, deleted_at is null from public.money_in where owner_user_id = auth.uid() $$,
  $$ select 3000000::bigint, 'salary', least(date_trunc('month', public.kst_today())::date, public.kst_today()), 'payday_auto', true $$,
  '내 금액 300만 원 한 줄(월급, 월급날 날짜, 자동)');
select isnt((select auto_income_at from public.pay_checklist where id = pg_temp.cl('44444444-4444-4444-4444-444444444444')), null, 'auto_income_at 찍힘');
-- 멱등: 다시 저장해도 그대로(다른 금액이어도)
select is(public.set_payday_income(pg_temp.cl('44444444-4444-4444-4444-444444444444'), 1234000), null, '멱등: 두 번째는 아무것도 안 함');
select is(pg_temp.autos(auth.uid()), 1, '멱등: 기록 한 줄 그대로');
select is((select amount from public.money_in where owner_user_id = auth.uid() and source = 'payday_auto'), 3000000::bigint, '금액도 그대로');
-- 저장한 뒤 첫 확인을 해도 한 줄 유지(월급 3,500,000원으로 안 넣음)
select public.confirm_payday(pg_temp.cl('44444444-4444-4444-4444-444444444444'));
select is(pg_temp.autos(auth.uid()), 1, '저장 뒤 첫 확인해도 자동 기록 한 줄 유지');
select is((select amount from public.money_in where owner_user_id = auth.uid() and source = 'payday_auto'), 3000000::bigint, '확인이 금액을 덮지 않음');
select is((select count(*)::int from public.goal_move where money_in_id is not null), 0, '저축·투자 배정 없음');
select throws_ok($$ select public.set_payday_income(pg_temp.cl('44444444-4444-4444-4444-444444444444'), -1) $$, '22023', null, '음수 금액 막힘');
select throws_ok($$ select public.set_payday_income(pg_temp.cl('44444444-4444-4444-4444-444444444444'), 100000000000) $$, '22023', null, '999억 넘는 금액 막힘');
reset role;

-- ── 남의 사이클은 못 씀 ──
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select throws_ok(format('select public.set_payday_income(%L, 1000000)', pg_temp.cl('55555555-5555-5555-5555-555555555555')), '42501', null, '다른 공간의 사이클은 못 씀');
select throws_ok(format('select public.set_payday_income(%L, 1000000)', gen_random_uuid()), '42501', null, '없는 사이클은 못 씀');
reset role;
select is(pg_temp.autos('55555555-5555-5555-5555-555555555555'), 0, '남의 기록은 안 생김');

-- ── 0원: 기록 없이 닫기 ──
select pg_temp.login_as('55555555-5555-5555-5555-555555555555');
set local role authenticated;
select is(public.set_payday_income(pg_temp.cl('55555555-5555-5555-5555-555555555555'), 0), null, '0원은 기록 id 없음');
select is(pg_temp.autos(auth.uid()), 0, '0원이면 기록을 넣지 않음');
select isnt((select auto_income_at from public.pay_checklist where id = pg_temp.cl('55555555-5555-5555-5555-555555555555')), null, '0원이어도 auto_income_at은 찍음');
select public.confirm_payday(pg_temp.cl('55555555-5555-5555-5555-555555555555'));
select is(pg_temp.autos(auth.uid()), 0, '0원으로 닫은 뒤 확인해도 자동 기록 안 넣음');
reset role;

-- ── anon은 못 부름 ──
set local role anon;
select throws_ok(format('select public.set_payday_income(%L, 1000000)', pg_temp.cl('44444444-4444-4444-4444-444444444444')), '42501', null, 'anon은 못 부름');
reset role;

-- ── 합쳐서: 내 줄만 내 금액, 상대 줄은 프로필 월급 ──
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.couple_space set holiday_shift = false;
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 1 where id = auth.uid();
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2800000, payday = 1 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
select public.set_salary_mode('joint');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.split_lines_configure((select jsonb_agg(jsonb_build_object('id', l.id, 'in_checklist', true, 'auto_pay', false))
  from public.split_line l join public.salary_split s on s.id = l.split_id where s.owner_user_id is null));
reset role;
update public.salary_split set checklist_from = null where owner_user_id is null;
select public.make_checklist((select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111'), null, public.kst_today());
select set_config('test.jcur', (select id::text from public.pay_checklist where owner_user_id is null order by cycle_start desc limit 1), true);
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.set_payday_income(current_setting('test.jcur')::uuid, 2500000);
reset role;
select results_eq(
  $$ select owner_user_id::text, amount from public.money_in where source = 'payday_auto'
     and owner_user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') order by amount desc $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 3500000::bigint), ('22222222-2222-2222-2222-222222222222', 2500000::bigint) $$,
  '합쳐서: 예빈 줄은 내 금액 250만 원, 찬우 줄은 찬우 프로필 월급');
select * from finish();
rollback;
