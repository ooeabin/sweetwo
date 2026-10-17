-- pgTAP: 연결 해제 확정(S-12d 동의 → S-12h). 찬우(신랑, 요청), 예빈(신부, 동의)
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

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
update public.app_user set nickname = '찬우', monthly_income = 3500000, side = 'groom';
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2500000, side = 'bride';
select public.finish_join();
reset role;

select set_config('test.s', (select space_id::text from public.app_user where nickname = '찬우'), true);
update public.couple_space set split_mode = 'income', marriage_status = 'married';
insert into public.goal (space_id, template, name, kind, target_amount, priority, other_held)
  values (current_setting('test.s')::uuid, 'home', '내 집 마련', 'once', 150000000, 1, 1000000);
insert into public.asset (space_id, side, grp, kind, name, amount, owner, goal_id)
  select current_setting('test.s')::uuid, 'asset', 'cash', 'bank', '공동 적금', 24000000, 'joint', id from public.goal;
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  values (current_setting('test.s')::uuid, 'debt', 'loan', 'credit', '공동 대출', 10000000, 'joint');
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  values (current_setting('test.s')::uuid, 'asset', 'cash', 'bank', '찬우 통장', 5000000, 'person', '11111111-1111-1111-1111-111111111111'),
         (current_setting('test.s')::uuid, 'asset', 'cash', 'bank', '예빈 통장', 2000000, 'person', '22222222-2222-2222-2222-222222222222');
insert into public.family_member (space_id, side, relation, title)
  values (current_setting('test.s')::uuid, 'groom', 'parent', '찬우 어머니'),
         (current_setting('test.s')::uuid, 'bride', 'parent', '예빈 어머니');
insert into public.care_day (space_id, category, kind, name, member_id, side, date_rule, month, day, budget, carer)
  select space_id, 'family', 'birthday', title || ' 생신', id, side, 'solar_yearly', 5, 1, 300000, side::text::public.care_carer
  from public.family_member;
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, budget, carer)
  values (current_setting('test.s')::uuid, 'couple', 'anniversary', '결혼기념일', 'solar_yearly', 1, 9, 100000, 'together');
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, budget, carer, secret, created_by)
  values (current_setting('test.s')::uuid, 'couple', 'partner_birthday', '예빈 생일', 'solar_yearly', 3, 9, 200000, 'groom', true,
    '11111111-1111-1111-1111-111111111111');
select set_config('test.mine', (select id::text from public.asset where name = '찬우 통장'), true);

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', null, true, true, '{}',
  '[{"target":"account","account_role":"living","amount":870000,"amount_groom":520000,"amount_bride":350000}]');
insert into public.account (space_id, role, name) select space_id, 'living', '생활비 통장' from public.app_user;
insert into public.month_close (space_id, plan_id) select u.space_id, p.id from public.app_user u, public.monthly_plan p;
insert into public.saving_deposit (month_close_id, space_id, name, amount, goal_id)
  select c.id, c.space_id, '집 저축', 390000, g.id from public.month_close c, public.goal g;
insert into public.todo (space_id, kind) select space_id, 'assets' from public.app_user;
select lives_ok($$ select public.request_unlink('{}', '연결 해제') $$, '해제 요청');
select results_eq(
  $$ select e->>'name', e->>'side', (e->>'mine')::bigint from public.couple_unlink, jsonb_array_elements(plan) e order by 2, 1 $$,
  $$ values ('공동 적금', 'asset', 13920000::bigint), ('공동 대출', 'debt', 5800000::bigint) $$,
  '공동 부채도 자산 정리 안에');
select throws_ok($$ select public.agree_unlink() $$, '42501', 'not_partner', '요청한 사람은 동의 못 함');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select lives_ok($$ select public.agree_unlink() $$, '예빈 동의 → 확정');
reset role;

select isnt((select space_id from public.app_user where nickname = '찬우'), current_setting('test.s')::uuid, '찬우 새 공간');
select isnt((select space_id from public.app_user where nickname = '예빈'),
  (select space_id from public.app_user where nickname = '찬우'), '예빈도 따로');
select results_eq(
  $$ select couple_state::text, deleted_at is not null from public.couple_space where id = current_setting('test.s')::uuid $$,
  $$ values ('solo', true) $$, '원래 공간은 보관(지운 표시)');
select results_eq(
  $$ select status, how, reconnect_until > now() + interval '29 days' from public.couple_unlink $$,
  $$ values ('confirmed', 'agreed', true) $$, '확정, 30일 다시 연결 기한');

-- 찬우 화면
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select couple_state::text from public.couple_space), 'solo', '찬우는 혼자 쓰기');
select is((select unlinked_from from public.couple_space), current_setting('test.s')::uuid, '어디서 나왔는지');
select results_eq(
  $$ select name, side::text, amount, owner::text from public.asset where deleted_at is null order by side, name $$,
  $$ values ('공동 적금', 'asset', 13920000::bigint, 'person'), ('생활비 통장', 'asset', 0::bigint, 'person'),
            ('찬우 통장', 'asset', 5000000::bigint, 'person'),
            ('공동 대출', 'debt', 5800000::bigint, 'person') $$,
  '내 몫 사본 + 내 명의 그대로, 예빈 명의는 없음');
select is((select id::text from public.asset where name = '찬우 통장'), current_setting('test.mine'), '내 명의는 같은 행을 옮김');
select results_eq(
  $$ select g.other_held, (select a.goal_id = g.id from public.asset a where a.name = '공동 적금') from public.goal g $$,
  $$ values (580000::bigint, true) $$, '목표 사본: 따로 모은 돈 100만 × 1,392 / 2,400, 공동 적금 사본이 이어짐');
select results_eq($$ select title from public.family_member $$, $$ values ('찬우 어머니') $$, '내 쪽 가족만');
select results_eq($$ select name from public.care_day order by name $$,
  $$ values ('예빈 생일'), ('찬우 어머니 생신') $$, '내 쪽 챙길 날 + 내 서프라이즈, 결혼기념일은 없음');
select is((select title from public.notification where kind = 'unlink_confirmed'), '연결이 해제됐어요', '해제 알림');
select is((select how from public.my_unlink()), 'agreed', '내 해제 기록을 봄');
select is((select count(*)::int from public.couple_unlink), 1, '해제 요청은 계속 보임');
select results_eq(
  $$ select (select count(*)::int from public.monthly_plan), (select count(*)::int from public.plan_line),
            (select count(*)::int from public.month_close), (select count(*)::int from public.todo) $$,
  $$ values (1, 1, 1, 1) $$, '플랜, 플랜 줄, 월말 정리, 할 일 사본');
select results_eq(
  $$ select d.goal_id is null, d.amount from public.saving_deposit d $$,
  $$ values (true, 390000::bigint) $$, '저축 기록은 목표 연결 없이 사본');
select ok(
  (select a.space_id = c.space_id and a.owner = 'person' from public.account c join public.asset a on a.id = c.asset_id
   where c.name = '생활비 통장'),
  '공동 통장 사본은 내 공간 자산 사본에 이어짐');
reset role;

-- 예빈 화면
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select results_eq(
  $$ select name, amount from public.asset where deleted_at is null order by side, name $$,
  $$ values ('공동 적금', 10080000::bigint), ('생활비 통장', 0::bigint), ('예빈 통장', 2000000::bigint),
            ('공동 대출', 4200000::bigint) $$,
  '예빈 몫');
select is((select other_held from public.goal), 420000::bigint, '목표 따로 모은 돈 42만');
select results_eq($$ select name from public.care_day $$, $$ values ('예빈 어머니 생신') $$, '예빈 쪽 챙길 날만');
select is((select count(*)::int from public.goal where space_id = current_setting('test.s')::uuid), 0, '원래 공간은 안 보임');
reset role;

select * from finish();
rollback;
