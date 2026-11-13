-- pgTAP: v2.2 분담 제안·답(20261203090000 계약 7, R3). 반반·월급 비율(서버 계산, 몫과 비율만)·직접, 수락하면
-- 각자 월급 계획에 같이 쓰는 통장 줄, 거절·만료, 한 사람이라도 공개 ‘모두’가 아니면 월급 비율 거절
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
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
-- 찬우 350만, 예빈 270만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
-- 공개 ‘모두’가 아니면 월급 비율은 못 고름
select throws_ok($$ select public.propose_split('생활비 통장', 1000000, 'income_ratio') $$, '42501', 'not_allowed',
  '숨긴 사람이 있으면 월급 비율 거절');
select throws_ok($$ select public.propose_split('생활비 통장', 1005000, 'half') $$, '22023', 'bad_amount', '1만 원 단위');
-- 반반
select set_config('test.s1', public.propose_split('생활비 통장', 1000000, 'half')::text, true);
select results_eq($$ select share_a, share_b, ratio_a::int, status from public.shared_account $$,
  $$ values (500000::bigint, 500000::bigint, 50, 'proposed') $$, '반반');
reset role;
select is((select title from public.notification where kind = 'split_request'), '찬우님이 ‘생활비 통장’을 나눠 보자고 해요',
  '받는 사람 알림(‘제안’ 말 없이)');
-- 제안한 사람은 답 못 함
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format('select public.answer_split(%L, true)', current_setting('test.s1')), '42501', 'not_found', '제안한 사람은 답 못 함');
reset role;
-- 거절
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.answer_split(current_setting('test.s1')::uuid, false), 'declined', '괜찮아요');
reset role;
select is((select count(*)::int from public.split_line where kind = 'shared_account'), 0, '거절이면 줄 없음');
select is((select title from public.notification where kind = 'split_result'), '‘생활비 통장’ 나누기는 지금처럼 둘게요', '결과 알림');

-- 월급 비율: 두 사람 모두 ‘모두 보여 주기’ → 서버가 비율 계산, 몫과 비율만
update public.app_user set plan_share = 'all';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.s2', public.propose_split('데이트 통장', 600000, 'income_ratio')::text, true);
select results_eq($$ select share_a, share_b, ratio_a::int from public.shared_account where id = current_setting('test.s2')::uuid $$,
  $$ values (340000::bigint, 260000::bigint, 57) $$, '월급 비율(60만 × 350/620 = 33.9만 → 34만, 나머지 26만, 57%)');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.answer_split(current_setting('test.s2')::uuid, true), 'accepted', '좋아요');
reset role;
select results_eq($$ select s.owner_user_id, l.amount, l.shared_account_id from public.split_line l
    join public.salary_split s on s.id = l.split_id where l.kind = 'shared_account' order by l.amount desc $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 340000::bigint, current_setting('test.s2')::uuid),
            ('22222222-2222-2222-2222-222222222222'::uuid, 260000::bigint, current_setting('test.s2')::uuid) $$,
  '각자 월급 계획에 같이 쓰는 통장 줄(자기 몫)');
select is((select auto_pay from public.split_line where kind = 'shared_account' limit 1), true, '같이 쓰는 통장 줄은 자동 줄(Q9)');

-- 직접 + 만료
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok($$ select public.propose_split('관리비', 300000, 'custom', 350000) $$, '22023', 'bad_amount', '합계보다 큰 몫 안 됨');
select set_config('test.s3', public.propose_split('관리비', 300000, 'custom', 100000)::text, true);
reset role;
update public.shared_account set expires_at = now() - interval '1 minute' where id = current_setting('test.s3')::uuid;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.answer_split(current_setting('test.s3')::uuid, true), 'expired', '7일 지나면 만료');
reset role;
select is((select status from public.shared_account where id = current_setting('test.s3')::uuid), 'expired', '만료 상태');
-- 상대 월급 원값은 표에 없음(몫과 비율만)
select hasnt_column('public', 'shared_account', 'income_a', '월급 값 열 없음');

select * from finish();
rollback;
