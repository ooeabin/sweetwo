-- pgTAP: 다르게 정리하기(S-12e → S-12f), 기한 2일 전 알림, 기한이 되면 기본안 확정. 찬우(요청), 예빈(받음)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

update public.couple_space set split_mode = 'income';
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'cash', 'bank', '공동 적금', 24000000, 'joint' from public.app_user where nickname = '찬우';
select set_config('test.a', (select id::text from public.asset), true);

-- 1) 기한 2일 전 알림, 기한이 되면 기본안(찬우가 고친 몫이 아니라 분담 비율)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_unlink(jsonb_build_object(current_setting('test.a'), 20000000), '연결 해제');
reset role;
update public.couple_unlink set deadline = public.kst_today() + 2;
select public.run_unlink_deadlines();
select is((select count(*)::int from public.notification where kind = 'unlink_deadline'), 2, '기한 2일 전 둘 다 알림');
select is((select title from public.notification where kind = 'unlink_deadline' limit 1),
  public.md_label(public.kst_today() + 2) || '에 분담 비율로 정리돼요', '알림 문구');
select public.run_unlink_deadlines();
select is((select count(*)::int from public.notification where kind = 'unlink_deadline'), 2, '한 번만');
select is((select status from public.couple_unlink), 'pending', '기한 전에는 그대로');
update public.couple_unlink set deadline = public.kst_today();
select public.run_unlink_deadlines();
select results_eq(
  $$ select status, how, (final_plan->0->>'mine')::bigint from public.couple_unlink $$,
  $$ values ('confirmed', 'deadline', 13920000::bigint) $$, '기한이 되면 기본안(58%)으로 확정');

-- 2) 다시 연결된 것처럼 새 부부로: 다르게 정리하기 시험은 같은 두 사람을 원래 공간으로 되돌려서
update public.app_user set space_id = (select space_id from public.couple_unlink);
update public.couple_space set couple_state = 'connected', deleted_at = null
  where id = (select space_id from public.couple_unlink);

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.request_unlink('{}', '연결 해제') $$, '다시 요청');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select lives_ok(format($$ select public.counter_unlink('{"%s": 14000000}') $$, current_setting('test.a')),
  '예빈 다르게 정리하기(예빈 몫 1,400만)');
select throws_ok(format($$ select public.counter_unlink('{"%s": 1}') $$, current_setting('test.a')),
  'P0001', 'already_countered', '한 번만');
select throws_ok($$ select public.accept_counter_unlink() $$, '42501', 'not_requester', '받은 사람은 자기 안에 동의 못 함');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select title from public.notification where kind = 'unlink_countered'),
  '예빈님이 자산 정리 안을 다르게 정리했어요', '요청한 사람에게 알림');
select throws_ok($$ select public.cancel_unlink() $$, 'P0001', 'already_answered', '답이 온 뒤에는 취소 못 함');
select lives_ok($$ select public.accept_counter_unlink() $$, '찬우 동의');
reset role;
select results_eq(
  $$ select how, (final_plan->0->>'mine')::bigint from public.couple_unlink where status = 'confirmed' and how = 'counter' $$,
  $$ values ('counter', 10000000::bigint) $$, '다르게 정리한 안(찬우 1,000만)으로 확정');

select * from finish();
rollback;
