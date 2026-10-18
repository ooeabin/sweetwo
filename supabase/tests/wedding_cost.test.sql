-- pgTAP: 결혼 비용(G-07). 항목, 예산 칸 잠금, 예산 바꾸기(미합류 바로, 연결 제안, 예식 30일 안 바로), 결제 기록과 보유액, 넘은 금액. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom';
update public.couple_space set marriage_status = 'engaged', wedding_date = current_date + 90, wedding_budget = 30000000;
select set_config('test.code', (select code from public.create_invite()), true);
insert into public.goal (space_id, template, name, kind, priority, target_amount, other_held)
  select space_id, 'wedding', '결혼 비용', 'once', 0, 30000000, 10000000 from public.app_user;
insert into public.wedding_item (space_id, key, name, budget, deposit_amount, balance_amount, payer)
  select space_id, 'jewelry', '예물', 5000000, 1000000, 4000000, 'us' from public.app_user;
select set_config('test.w', (select id::text from public.wedding_item), true);
select throws_ok(format($$ update public.wedding_item set budget = 1 where id = %L $$, current_setting('test.w')),
  '42501', null, '예산 칸은 직접 못 고침');
update public.wedding_item set payer = 'groom' where id = current_setting('test.w')::uuid;
select is((select payer::text from public.wedding_item), 'groom', '다른 칸은 바로 고침');
select is(public.change_wedding_budget(32000000, current_date + 10), 'applied', '미합류면 바로');
select is((select wedding_budget from public.couple_space), 32000000::bigint, '총예산 바뀜');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', side = 'bride';
select public.finish_join();
select is(public.change_wedding_budget(6000000, current_date + 10, current_setting('test.w')::uuid), 'proposed', '연결이면 제안');
select results_eq(
  $$ select item, before->>'budget', after->>'budget' from public.proposal where item = 'wedding_item_budget' $$,
  $$ values ('wedding_item_budget'::text, '5000000'::text, '6000000'::text) $$,
  '항목 예산 제안 전 → 후');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.respond_proposal((select id from public.proposal where item = 'wedding_item_budget'), 'like');
select is((select budget from public.wedding_item), 6000000::bigint, '좋아요면 항목 예산 적용');
-- 결제: 결혼 준비 통장 550만(잔금, 계획 400만) → 보유액에서 빼고, 넘은 금액 = 100 + 550 − 600 = 50만
select is(public.record_wedding_payment(current_setting('test.w')::uuid, 'balance', 5500000, 'wedding_account'),
  500000::bigint, '예산 넘은 금액');
select is((select sum(amount) from public.goal_use where source = 'wedding'), 5500000::numeric, '결혼 준비 통장이면 목표 사용');
select is(public.record_wedding_payment(current_setting('test.w')::uuid, 'balance', 5500000, 'personal_support'),
  500000::bigint, '다시 기록하면 고침');
select is((select count(*) from public.goal_use where source = 'wedding'), 0::bigint, '각자 돈·양가 지원은 기록만');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select throws_ok(format($$ select public.record_wedding_payment(%L, 'deposit', 1, 'wedding_account') $$, current_setting('test.w')),
  '42501', null, '다른 부부 항목은 못 건드림');
reset role;

select * from finish();
rollback;
