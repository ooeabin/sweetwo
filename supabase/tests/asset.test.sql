-- pgTAP: 자산·부채 명의, 공개 범위(서버에서 거름), 대신 입력과 합류 뒤 넘김, 이력, 순자산(23 F-01~F-04, 08 2·4장)
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
select set_config('test.code', (select code from public.create_invite()), true);
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'cash', 'bank', '생활비 통장', 3000000, 'joint' from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility, principal)
  select space_id, 'asset', 'invest', 'stock', '내 주식', 10000000, 'person', '11111111-1111-1111-1111-111111111111', 'sum', 8000000 from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'cash', 'cash', '비밀', 500000, 'person', '11111111-1111-1111-1111-111111111111', 'private' from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'deposit', 'saving', '예빈 적금', 2000000, 'person' from public.app_user;
select throws_ok(
  $$ insert into public.asset (space_id, side, grp, kind, name, amount, owner, visibility)
     select space_id, 'asset', 'cash', 'bank', 'x', 1, 'person', 'sum' from public.app_user $$,
  '23514', null, '대신 입력은 전체 공개만');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select results_eq($$ select name from public.asset order by name $$,
  $$ values ('생활비 통장'::text), ('예빈 적금'::text) $$, '배우자는 공동, 전체 공개만 행으로');
select results_eq($$ select grp, n, total from public.partner_asset_sums() $$,
  $$ values ('invest'::text, 1, 10000000::bigint) $$, '합계만은 묶음 합계로, 비공개는 없음');
select is((select count(*)::int from public.asset_history), 2, '이력도 볼 수 있는 행만');
select is((select owner_user_id from public.asset where name = '예빈 적금'), '22222222-2222-2222-2222-222222222222'::uuid, '대신 입력은 합류하면 넘어감');
select is_empty($$ update public.asset set amount = 1 where name = '내 주식' returning id $$, '남의 명의는 못 고침');
select isnt_empty($$ update public.asset set amount = 3500000 where name = '생활비 통장' returning id $$, '공동은 둘 다 고침');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is_empty($$ update public.asset set amount = 1 where name = '예빈 적금' returning id $$, '넘어간 뒤 찬우는 못 고침');
select throws_ok(
  $$ insert into public.asset (space_id, side, grp, kind, name, amount, owner)
     select space_id, 'asset', 'cash', 'bank', 'x', 1, 'person' from public.app_user $$,
  '42501', null, '합류 뒤 상대 명의 새로 만들기 불가');
select is((select count(*)::int from public.asset_history where asset_id = (select id from public.asset where name = '생활비 통장')), 2, '금액이 바뀌면 이력');
select is((select net from public.net_worth_history(1)), 12500000::bigint, '순자산 = 원금 기준, 비공개 제외');
select throws_ok($$ delete from public.asset $$, '42501', null, '지우기는 휴지통만');
reset role;

select * from finish();
rollback;
