-- pgTAP: v2.2 자산 순위 같이 보기(20261204090000 계약 6). 한쪽만 동의면 또래 중간값만, 둘 다 동의면 둘의 합(숨기기 제외),
-- 연령대 = 먼저 태어난 사람, core rankTopPct와 같은 값, 첫 조회 무료, 한 사람 끄면 배지·저장 순위 지움
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);
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
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
delete from public.notification;
update public.app_user set birth_year = 1993 where id = '11111111-1111-1111-1111-111111111111';
update public.app_user set birth_year = 1996 where id = '22222222-2222-2222-2222-222222222222';
-- 찬우 주식 2억(모두), 예빈 예금 1억(숨기기), 공동 대출 5천
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'invest', 'stock', '찬우 주식', 200000000, 'person', auth.uid(), 'all' from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'debt', 'loan', 'credit', '공동 대출', 50000000, 'joint' from public.app_user where id = auth.uid();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'deposit', 'saving', '예빈 예금', 100000000, 'person', auth.uid(), 'private' from public.app_user where id = auth.uid();
reset role;

-- core와 같은 점
select results_eq($$ select public.rank_top_pct(v) from unnest(array[-200000000, 0, 238600000, 150000000, 2000000000]::bigint[]) v $$,
  $$ values (99::smallint), (97::smallint), (50::smallint), (63::smallint), (10::smallint) $$, 'rankTopPct와 같은 값');
select is(public.peer_median(1993)->>'band', '30s', '연령대');

-- 동의 없음: 또래 중간값만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq($$ select r->>'mode', (r->>'median')::bigint, r->>'net' from public.networth_rank_pair() r $$,
  $$ values ('peer', 155850000::bigint, null::text) $$, '동의 없으면 또래 가구 중간값만');
-- 한쪽만 동의
select isnt(public.request_rank_consent(), null, '같이 보자고 하기');
select is(public.networth_rank_pair()->>'mode', 'peer', '한쪽만 동의면 순위 없음');
reset role;
select is((select title from public.notification where kind = 'rank_request'), '찬우님이 자산 순위를 같이 보자고 해요', '받는 쪽 알림');
-- 배지는 둘 다 동의 전엔 못 켬
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.app_user set rank_badge_home = true where id = auth.uid();
select is((select rank_badge_home from public.app_user where id = auth.uid()), false, '둘 다 동의 전엔 배지 못 켬');
reset role;
-- 예빈 수락 → 둘의 합(숨기기 제외), 먼저 태어난 사람(1993) 연령대
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.answer_rank_consent((select id from public.rank_consent_request), true), 'accepted', '좋아요');
select results_eq($$ select r->>'mode', (r->>'net')::bigint, r->>'band', (r->>'top_pct')::int from public.networth_rank_pair() r $$,
  $$ values ('pair', 150000000::bigint, '30s', 63) $$, '둘의 합 2억 − 5천(숨긴 예금 1억 제외), 30대');
-- 첫 조회 무료, 그다음은 광고
select is(public.record_rank_view(false)->>'mode', 'pair', '첫 결과 무료');
select throws_ok($$ select public.record_rank_view(false) $$, '22023', 'ad_required', '새로 확인은 광고 뒤');
select lives_ok($$ select public.record_rank_view(true) $$, '광고 본 뒤');
select is((select rank_pct from public.app_user where id = auth.uid()), 63::smallint, '저장 순위');
update public.app_user set rank_badge_home = true where id = auth.uid();
select is((select rank_badge_home from public.app_user where id = auth.uid()), true, '둘 다 동의면 배지 켬');
reset role;
-- 찬우가 동의를 끔 → 두 사람 배지·저장 순위 지움, 다시 또래 중간값
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.set_rank_consent(false);
select is(public.networth_rank_pair()->>'mode', 'peer', '한 사람 끄면 순위 없음');
reset role;
select results_eq($$ select bool_or(rank_badge_home), count(rank_pct)::int from public.app_user
    where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') $$,
  $$ values (false, 0) $$, '두 사람 배지·저장 순위 지움');
select is((select count(*)::int from public.rank_view where user_id = '22222222-2222-2222-2222-222222222222'), 2, '조회 기록(본인만 읽음)');

select is((select count(*)::int from pg_publication_tables where pubname::text = 'supabase_realtime'
  and tablename::text = 'rank_consent_request'), 1, 'Realtime: rank_consent_request');

select * from finish();
rollback;
