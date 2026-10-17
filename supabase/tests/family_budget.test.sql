-- pgTAP: 양가 비용 예산(Y-06). 혼자면 바로 저장, 두 사람이면 제안, 좋아요면 챙길 날 쓸 돈·목표 금액 적용
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
insert into public.goal (space_id, template, name, kind, owner, target_amount, priority)
  select space_id, 'family_cost', '양가 비용', 'yearly', 'together', 2580000, 1 from public.app_user;
insert into public.family_member (space_id, side, relation, title)
  select space_id, 'groom', 'parent', '어머니' from public.app_user;
insert into public.family_member (space_id, side, relation, title)
  select space_id, 'groom', 'sibling', '형' from public.app_user;
insert into public.care_day (space_id, category, kind, name, member_id, side, date_rule, month, day, budget)
  select f.space_id, 'family', 'birthday', f.title || ' 생신', f.id, 'groom', 'solar_yearly', 10, 14, 300000
  from public.family_member f;
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, budget)
  select space_id, 'family', 'seollal', '설날', 'lunar_yearly', 1, 1, 500000 from public.app_user;
insert into public.care_day (space_id, category, kind, name, date_rule, once_on, budget)
  select space_id, 'family', 'wedding', '사촌 결혼식', 'once', '2020-01-01', 100000 from public.app_user;

select throws_ok($$ select public.save_family_budget('{"holiday":-1,"target_amount":1}') $$, '22023', null,
  '음수 단가는 거절');
select public.save_family_budget('{"holiday":400000,"birthday":250000,"other":150000,"target_amount":2200000}');
select results_eq(
  $$ select name, budget from public.care_day order by name $$,
  $$ values ('사촌 결혼식', 100000::bigint), ('설날', 400000::bigint), ('어머니 생신', 250000::bigint), ('형 생신', 150000::bigint) $$,
  '혼자면 바로 적용: 같은 종류 쓸 돈, 부모님 생신만 생신 단가, 지난 한 번인 날은 그대로');
select is((select target_amount from public.goal), 2200000::bigint, '양가 비용 목표 금액 = 합계');
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select throws_ok($$ select public.save_family_budget('{"holiday":1,"target_amount":1}') $$, '22023', null,
  '두 사람이면 바로 저장 없음');
select isnt(public.propose('family_budget', '{"holiday":300000,"target_amount":2000000}', current_date + 30), null,
  '양가 비용 예산 제안');
select is((select before->>'holiday' from public.proposal where status = 'open'), '400000', '제안 전 값 = 지금 단가');
select throws_ok($$ select public.propose('family_budget', '{"holiday":"x","target_amount":1}', current_date + 30) $$,
  '22023', null, '숫자가 아니면 거절');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.respond_proposal((select id from public.proposal where status = 'open'), 'like')::text, 'applied',
  '좋아요면 바로');
select results_eq(
  $$ select (select budget from public.care_day where kind = 'seollal'), (select target_amount from public.goal) $$,
  $$ values (300000::bigint, 2000000::bigint) $$, '적용: 명절 쓸 돈, 목표 금액');
reset role;

select * from finish();
rollback;
