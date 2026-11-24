-- pgTAP: F-04b 팔았어요에서 받은 통장 ‘안 적을게요’(p_to null): 통장은 그대로, 판 것만 기록
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
insert into public.asset (space_id, side, grp, kind, name, amount, principal, owner, owner_user_id)
  select space_id, 'asset', 'invest', 'stock', '주식', 10000000, 8000000, 'person', id from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  select space_id, 'asset', 'cash', 'bank', '입출금 통장', 3000000, 'person', id from public.app_user;
select set_config('test.s', (select id::text from public.asset where name = '주식'), true);

select is(public.sell_asset(current_setting('test.s')::uuid, 5000000, null, 5000000),
  1000000::bigint, '일부만, 통장 없이: 실현 손익은 그대로 계산');
select results_eq($$ select amount, principal, status::text from public.asset where name = '주식' $$,
  $$ values (5000000::bigint, 4000000::bigint, 'held') $$, '남은 평가금액, 남은 원금');
select is((select amount from public.asset where name = '입출금 통장'), 3000000::bigint, '통장은 그대로');
select is(public.sell_asset(current_setting('test.s')::uuid, 6000000, null),
  2000000::bigint, '다 팔면 남은 원금 기준');
select is((select status::text from public.asset where name = '주식'), 'sold', '매도 완료로 보관');
reset role;

select * from finish();
rollback;
