-- pgTAP: 다시 연결(S-12g), 새로 초대하기, 30일 뒤 원래 공간 지우기. 찬우(해제 요청), 예빈(동의)
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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
update public.couple_space set split_mode = 'income';
insert into public.goal (space_id, template, name, kind, target_amount, priority)
  values (current_setting('test.s')::uuid, 'home', '내 집 마련', 'once', 150000000, 1);
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  values (current_setting('test.s')::uuid, 'asset', 'cash', 'bank', '공동 적금', 24000000, 'joint');
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, goal_id)
  select current_setting('test.s')::uuid, 'asset', 'cash', 'bank', '찬우 통장', 5000000, 'person',
    '11111111-1111-1111-1111-111111111111', id from public.goal;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_unlink('{}', '연결 해제');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.agree_unlink();
select throws_ok($$ select public.answer_reconnect(true) $$, 'P0001', 'no_request', '요청이 없으면 답 없음');
reset role;

-- 찬우: 혼자 쓰는 동안 내 통장 금액이 바뀌고, 새 자산을 만들고, 새로 초대도 해 봄(아무도 합류 안 함)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.asset set amount = 5500000 where name = '찬우 통장';
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  select space_id, 'asset', 'cash', 'bank', '새 통장', 100000, 'person', id from public.app_user;
select lives_ok($$ select public.start_new_invite() $$, '새로 초대하기 → 미합류');
select is((select couple_state::text from public.couple_space), 'not_joined', '미합류');
select ok((select code is not null from public.create_invite()), '새 초대 코드');
select lives_ok($$ select public.request_reconnect() $$, '다시 연결 요청');
select throws_ok($$ select public.request_reconnect() $$, 'P0001', 'already_requested', '열린 요청은 하나');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select title from public.notification where kind = 'reconnect_requested'), '찬우님이 다시 연결하자고 해요', '요청 알림');
select is(public.unlink_partner_name(), '찬우', '혼자 쓰기에서 상대 호칭');
select lives_ok($$ select public.answer_reconnect(false) $$, '괜찮아요');
select is((select reconnect_answer from public.couple_unlink), 'declined', '요청 닫힘');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.request_reconnect() $$, '30일 안이면 다시 요청');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select lives_ok($$ select public.answer_reconnect(true) $$, '다시 연결할게요');
reset role;

select results_eq(
  $$ select count(distinct space_id)::int, min(space_id::text) from public.app_user $$,
  $$ values (1, current_setting('test.s')) $$, '두 사람 모두 원래 공간');
select results_eq(
  $$ select couple_state::text, deleted_at is null from public.couple_space where id = current_setting('test.s')::uuid $$,
  $$ values ('connected', true) $$, '연결, 원래 공간 되살림');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq(
  $$ select a.name, a.amount, (a.goal_id = (select id from public.goal)) from public.asset a
     where a.deleted_at is null order by a.name $$,
  $$ values ('공동 적금', 24000000::bigint, null::boolean), ('새 통장', 100000::bigint, null::boolean),
            ('찬우 통장', 5500000::bigint, true) $$,
  '공동 자산은 해제 전 그대로, 내 명의는 바뀐 값, 목표 연결은 원래 목표로');
select is((select count(*)::int from public.goal), 1, '목표 사본은 사라짐');
select is((select title from public.notification where kind = 'reconnected'), '예빈님과 다시 연결됐어요', '요청한 사람에게 알림');
reset role;

-- 다시 해제하고 30일이 지나면 원래 공간 지움
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_unlink('{}', '연결 해제');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.agree_unlink();
reset role;
update public.couple_unlink set reconnect_until = now() - interval '1 minute' where status = 'confirmed';
select public.purge_unlinked_spaces();
select is((select count(*)::int from public.couple_space where id = current_setting('test.s')::uuid), 0, '30일 뒤 원래 공간 지움');
select is((select count(*)::int from public.app_user where space_id is null), 0, '두 사람은 각자 공간 그대로');

select * from finish();
rollback;
