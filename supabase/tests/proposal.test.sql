-- pgTAP: 제안 보내기, 응답, 대체, 함께 정하기, 철회, 적용일 적용(08 6장)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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
create function pg_temp.open_id() returns uuid language sql as $$
  select id from public.proposal where status = 'open' limit 1;
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom', allowance = 500000;
select set_config('test.code', (select code from public.create_invite()), true);
select throws_ok(
  $$ select public.propose('allowance', '{"allowance":600000}', current_date + 30) $$,
  '42501', null, '혼자일 때는 제안 없음(바로 적용)');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set allowance = 500000;
select throws_ok(
  $$ select public.propose('allowance', '{"allowance":600000}', current_date) $$,
  '22023', null, '적용일은 72시간 뒤부터');
select isnt(public.propose('allowance', '{"allowance":600000}', current_date + 30), null, '합류 중에도 용돈 제안');
select throws_ok($$ select public.respond_proposal(pg_temp.open_id(), 'like') $$, '42501', null, '내 제안에는 답 못 한다');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq(
  $$ select before->>'allowance', after->>'allowance', status::text from public.proposal $$,
  $$ values ('500000'::text, '600000'::text, 'open'::text) $$,
  '전·후 값');
select is(public.respond_proposal(pg_temp.open_id(), 'oppose'), 'held'::public.proposal_status, '반대 = 보류');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.propose('allowance', '{"allowance":550000}', current_date + 30);
reset role;
-- 용돈은 사람마다 따로 열린다
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.propose('allowance', '{"allowance":450000}', current_date + 30);
reset role;
select is((select count(*)::int from public.proposal where item = 'allowance' and status = 'open'), 2, '용돈 제안은 사람마다 하나');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.withdraw_proposal((select id from public.proposal where status = 'open' and proposer = '11111111-1111-1111-1111-111111111111'));
select is(public.respond_proposal(pg_temp.open_id(), 'like'), 'applied'::public.proposal_status, '좋아요 = 즉시 적용');
reset role;
select is((select allowance from public.app_user where id = '22222222-2222-2222-2222-222222222222'), 550000::bigint, '예빈 용돈 적용');

-- 분담: 예빈 제안 → 찬우 다르게 → 예빈 다르게 = 왕복 2회 함께 정하기
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.propose('split', '{"mode":"custom","starter_ratio":55}', current_date + 30);
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.propose('split', '{"mode":"custom","starter_ratio":60}', current_date + 30);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.propose('split', '{"mode":"half"}', current_date + 30);
select results_eq(
  $$ select round_trips, together from public.proposal where status = 'open' $$,
  $$ values (2, true) $$,
  '왕복 2회면 함께 정하기');
select is((select count(*)::int from public.proposal where item = 'split' and status = 'superseded'), 2, '앞 제안은 대체됨');
select throws_ok($$ update public.proposal set status = 'applied' $$, '42501', null, '제안은 함수로만 바꾼다');
reset role;

-- 찬우는 남의 제안 철회 못 함, 예빈 철회
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select public.withdraw_proposal(pg_temp.open_id()) $$, '42501', null, '남의 제안은 철회 못 한다');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.withdraw_proposal(pg_temp.open_id()), 'withdrawn'::public.proposal_status, '철회');
-- 적용일이 지난 제안은 앱을 열 때 적용
select public.propose('split', '{"mode":"income"}', current_date + 4);
reset role;
update public.proposal set apply_on = current_date where status = 'open';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.apply_due_proposals(), 1, '적용일 지난 제안 적용');
select is((select split_mode::text from public.couple_space), 'income', '분담 적용');
reset role;

select * from finish();
rollback;
