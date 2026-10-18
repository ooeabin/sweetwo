-- pgTAP: 배우자 활동(H-08). 상대가 한 일만, 공개 범위 따름, 미합류면 없음. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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
update public.app_user set nickname = '찬우', side = 'groom';
select set_config('test.code', (select code from public.create_invite()), true);
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'deposit', 'deposit', '공동 예금', 1000000, 'joint' from public.app_user;
select is((select count(*) from public.partner_activity()), 0::bigint, '미합류면 없음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', side = 'bride';
select public.finish_join();
-- 예빈: 공동 예금 금액 바꿈, 내 명의 합계만 적금 추가, 비공개 주식 추가
update public.asset set amount = 1200000 where name = '공동 예금';
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'deposit', 'saving', '내 적금', 500000, 'person', id, 'sum' from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'invest', 'stock', '비밀 주식', 300000, 'person', id, 'private' from public.app_user;
select is((select count(*) from public.partner_activity()), 0::bigint, '내가 한 일은 내 활동에 없음');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*) from public.partner_activity() where kind like 'asset%'), 2::bigint, '찬우에게 예빈 자산 활동 2건(비공개 빼고)');
select is((select count(*) from public.partner_activity() where kind = 'notice'), 1::bigint, '예빈이 일으킨 알림(합류)');
select is((select kind from public.partner_activity() where name = '공동 예금'), 'asset_changed', '공동 항목은 이름과 함께 바꿈');
select results_eq(
  $$ select kind, name, target from public.partner_activity() where name is null $$,
  $$ values ('asset_added'::text, null::text, '/assets'::text) $$,
  '합계만 상대 명의 항목은 이름 없이');
select is((select count(*) from public.partner_activity(1)), 1::bigint, '최근 n건');
reset role;

select * from finish();
rollback;
