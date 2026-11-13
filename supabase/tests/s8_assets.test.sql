-- pgTAP: QA 8구간 자산 관리(2026-11-12). 명의·만든 사람·공간 잠금(S8-03), 합류 넘김은 그대로,
-- 금액 이력 source(created / manual / sell / matured, S8-14 D3), 보증금 팔기 거절(S8-15), Realtime 발행(S8-06)
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우: 공동 통장, 내 주식, 대신 입력(예빈 명의), 전세 보증금, 만기 적금
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select set_config('test.code', (select code from public.create_invite()), true);
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'cash', 'bank', '생활비 통장', 3000000, 'joint' from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility, principal)
  select space_id, 'asset', 'invest', 'stock', '내 주식', 10000000, 'person', id, 'all', 8000000 from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'deposit', 'saving', '예빈 적금', 2000000, 'person' from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'real_estate', 'deposit_money', '전세 보증금', 200000000, 'person', id, 'all'
  from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility, maturity_date)
  select space_id, 'asset', 'deposit', 'saving', '만기 적금', 5000000, 'person', id, 'all', public.kst_today()
  from public.app_user;

-- D3: 처음 값은 created
select is((select array_agg(distinct source) from public.asset_history), array['created'],
  '처음 적은 값은 source created');

-- 내 항목: 금액·공개 범위는 그대로 고침, 명의·만든 사람·공간은 못 바꿈
select lives_ok($$ update public.asset set amount = 11000000, visibility = 'sum' where name = '내 주식' $$,
  '내 항목 금액·공개 범위는 고침');
select is((select source from public.asset_history h join public.asset a on a.id = h.asset_id
  where a.name = '내 주식' order by h.id desc limit 1), 'manual', '직접 고친 금액은 manual');
select throws_ok($$ update public.asset set created_by = '22222222-2222-2222-2222-222222222222' where name = '내 주식' $$,
  '42501', 'not_owner', '만든 사람은 못 바꿈');
select throws_ok($$ update public.asset set owner = 'joint', owner_user_id = null, visibility = 'all' where name = '내 주식' $$,
  '42501', 'not_owner', '내 명의를 공동으로도 못 바꿈(앱에 없는 동작)');
select throws_ok($$ update public.asset set space_id = gen_random_uuid() where name = '내 주식' $$,
  '42501', 'not_owner', '공간은 못 바꿈');
reset role;

-- 예빈 합류: 대신 입력한 항목은 예빈에게 넘어감(함수 안이라 잠금에 안 걸림)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select is((select owner_user_id::text from public.asset where name = '예빈 적금'),
  '22222222-2222-2222-2222-222222222222', '합류하면 대신 입력 항목이 넘어감');

-- 공동 자산을 내 명의 숨기기로 가져가기 거절(S8-03)
select throws_ok($$ update public.asset set owner = 'person', owner_user_id = '22222222-2222-2222-2222-222222222222',
  visibility = 'private' where name = '생활비 통장' $$, '42501', 'not_owner', '공동 자산을 가져가지 못함');
select throws_ok($$ update public.asset set created_by = '22222222-2222-2222-2222-222222222222' where name = '생활비 통장' $$,
  '42501', 'not_owner', '공동 자산 만든 사람도 못 바꿈');
select lives_ok($$ update public.asset set amount = 3500000 where name = '생활비 통장' $$,
  '공동 자산 금액은 둘 다 고침');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select owner::text || ':' || coalesce(owner_user_id::text, '') from public.asset where name = '생활비 통장'),
  'joint:', '찬우에게 공동 자산 그대로');

-- 팔기: 보증금은 거절(S8-15), 주식은 sell 이력
select throws_ok(format('select public.sell_asset(%L, 1000, %L)',
    (select id from public.asset where name = '전세 보증금'), (select id from public.asset where name = '생활비 통장')),
  '42501', 'not_found', '전·월세 보증금은 팔기 없음');
select lives_ok(format('select public.sell_asset(%L, 6000000, %L, 5000000)',
    (select id from public.asset where name = '내 주식'), (select id from public.asset where name = '생활비 통장')),
  '일부만 팔기');
select is((select array_agg(h.source order by a.name) from public.asset_history h join public.asset a on a.id = h.asset_id
  where h.id in (select max(id) from public.asset_history group by asset_id)
    and a.name in ('내 주식', '생활비 통장')), array['sell', 'sell'], '팔기로 바뀐 금액(판 항목, 받은 통장)은 sell');

-- 만기 정리는 matured
select lives_ok(format('select public.settle_matured(%L, %L)',
    (select id from public.asset where name = '만기 적금'), (select id from public.asset where name = '생활비 통장')),
  '만기 정리');
select is((select h.source from public.asset_history h join public.asset a on a.id = h.asset_id
  where a.name = '생활비 통장' order by h.id desc limit 1), 'matured', '만기 정리로 바뀐 금액은 matured');
reset role;

-- 함수가 끝나면 다음 쓰기는 다시 manual
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.asset set amount = 1 where name = '생활비 통장';
reset role;
select is((select h.source from public.asset_history h join public.asset a on a.id = h.asset_id
  where a.name = '생활비 통장' order by h.id desc limit 1), 'manual', '함수 뒤 직접 고친 것은 다시 manual');

select ok(
  not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  or exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'asset'),
  'asset은 Realtime 발행에 있음'
);

select * from finish();
rollback;
