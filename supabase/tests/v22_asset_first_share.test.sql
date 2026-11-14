-- pgTAP: v2.2 자산 공개 첫 선택(G2)·순자산 평가금액 기준·대신 입력 정리(20261204090000 계약 7·8·9)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
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
create function pg_temp.sl(p_owner uuid, k text, p_user uuid default null) returns uuid language sql as $$
  select l.id from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is not distinct from p_owner and l.kind::text = k and (p_user is null or l.user_id = p_user) limit 1;
$$;

-- 찬우(시작한 사람, 25일), 다른 사람(혼자)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 100000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
reset role;
-- 1. 처음엔 안 고름. 혼자·미합류일 때 적은 자산은 기본값을 정하지 않음(20261208090000 계약 4, 연결된 뒤 첫 자산은
--    v22_followups에서). 고르면(F-03e·S-13) 그 값
select is((select asset_share_default from public.app_user where id = '11111111-1111-1111-1111-111111111111'), null,
  '처음엔 미리 고른 값 없음');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into public.asset (space_id, side, grp, kind, name, amount, principal, owner, owner_user_id, visibility)
  select space_id, 'asset', 'invest', 'stock', '내 주식', 12000000, 10000000, 'person', auth.uid(), 'sum'
  from public.app_user where id = auth.uid();
select is((select asset_share_default::text from public.app_user where id = auth.uid()), null, '미합류 첫 자산은 기본값을 정하지 않음');
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'cash', 'bank', '내 통장', 3000000, 'person', auth.uid(), 'private' from public.app_user where id = auth.uid();
select is((select asset_share_default::text from public.app_user where id = auth.uid()), null, '두 번째도 그대로');
select lives_ok($$ select public.set_asset_share_default('all') $$, 'F-03e·S-13에서 고침');
select is((select asset_share_default::text from public.app_user where id = auth.uid()), 'all', '고친 기본값');
-- 2. 순자산: 평가금액 기준 + 원금 보기
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'debt', 'loan', 'credit', '공동 대출', 5000000, 'joint' from public.app_user where id = auth.uid();
select results_eq($$ select (r->>'assets')::bigint, (r->>'debts')::bigint, (r->>'net')::bigint, (r->>'principal_net')::bigint
    from public.networth_summary() r $$,
  $$ values (15000000::bigint, 5000000::bigint, 10000000::bigint, 8000000::bigint) $$,
  '평가금액 기준(원금 보기는 원금으로), 내 숨기기도 넣음(H3, 앱 netWorthOf와 같음)');
reset role;

-- 3. 대신 입력 정리: 합류 전, 초대 만료 + 23일 알림, + 30일 지움
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'deposit', 'saving', '파트너 적금', 2000000, 'person' from public.app_user where id = auth.uid();
reset role;
select set_config('test.exp', ((select expires_at from public.invite where code = current_setting('test.code')) at time zone 'Asia/Seoul')::date::text, true);
select is(public.purge_proxy_entries(current_setting('test.exp')::date + 23), 1, '7일 전 알림');
select is(public.purge_proxy_entries(current_setting('test.exp')::date + 29), 0, '그 사이는 없음');
select public.purge_proxy_entries(current_setting('test.exp')::date + 30);
select is((select deleted_at is not null from public.asset where name = '파트너 적금'), true, '30일 지나면 대신 입력 지움');

select * from finish();
rollback;
