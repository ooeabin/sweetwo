-- pgTAP: QA 6구간 서버 쪽(2026-11-12, 20261122090000).
-- 서버 분석 이벤트(checklist_generated·checklist_closed, 분석 수집을 끈 사람 것은 안 남김, 앱은 못 읽음),
-- 파트너 체크 다 함 알림(‘못 함’이 섞이면 “마쳤어요”, 호칭이 없으면 “파트너가”), 월급 전 확인 알림 링크의 체크리스트 id,
-- 달성 알림 링크(고칠 수 있는 사람 W-12, 파트너 W-10). 찬우(25일), 예빈(10일), 각자. 날짜는 2027년
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
create function pg_temp.line(owner uuid, k text) returns uuid language sql as $$
  select l.id from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.owner_user_id = owner and c.cycle_start >= '2027-03-01' and c.cycle_start < '2027-04-01' and l.kind::text = k limit 1;
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'home', '내 집 마련', 'once', 1 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
set local role authenticated;
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 680000)
));
reset role;
-- 체크리스트가 생긴 트랜잭션 끝에 남는 이벤트(미룬 트리거)를 테스트 안에서 바로 보려고 그때마다 한 번 내보냄
create function pg_temp.flush() returns void language plpgsql as $$
begin
  set constraints all immediate;
  set constraints all deferred;
end $$;
select pg_temp.flush();
delete from public.notification;
delete from public.server_event;
-- v2.2(D2): 생활비 줄은 기본으로 목록에 없음. 이 테스트는 줄 2개짜리 목록을 쓰므로 켜 둠
update public.split_line set in_checklist = true;

-- 1. checklist_generated: 예빈은 ‘분석 수집’을 끔 → 찬우 것만
update public.app_user set analytics_off = true where id = '22222222-2222-2222-2222-222222222222';
select public.run_cycle_checklists('2027-03-25');
select pg_temp.flush();
select results_eq(
  $$ select user_id, props->>'cycle_type', props->>'owner', (props->>'lines_count')::int, (props->>'saving_lines_count')::int, props->>'source'
     from public.server_event where name = 'checklist_generated' order by id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'first', 'self', 2, 1, 'server') $$,
  '체크리스트 생김 이벤트(분석 수집을 끈 예빈 것은 없음)');
update public.app_user set analytics_off = false where id = '22222222-2222-2222-2222-222222222222';

-- 2. 앱은 서버 이벤트 표를 못 읽음
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select count(*) from public.server_event $$, '42501', null, '앱은 server_event를 못 읽음');
reset role;

-- 3. 찬우가 ‘못 함’을 섞어 끝냄 → 예빈에게 “마쳤어요”
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.check_pay_line(pg_temp.line('11111111-1111-1111-1111-111111111111', 'saving'), 'checked');
select public.check_pay_line(pg_temp.line('11111111-1111-1111-1111-111111111111', 'living'), 'skipped');
reset role;
select results_eq(
  $$ select user_id, title, target from public.notification where kind = 'partner_done' $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, '찬우님이 3월 월급 체크를 마쳤어요',
             '/salary?who=11111111-1111-1111-1111-111111111111') $$,
  '못 함이 섞이면 마쳤어요');
select is((select state from public.pay_checklist where owner_user_id = '11111111-1111-1111-1111-111111111111'
  and cycle_start = '2027-03-25'), 'done', '체크 또는 못 함이면 끝남(D4)');
select is((select count(*)::int from public.notification where kind = 'behalf_checked'), 0, '대신 체크 알림 없음');

-- 4. 월급 전 확인 알림 링크 = 그 체크리스트(예빈 3월 월급, 4월 9일 끝 → 4월 7일 오후 8시)
select is(public.send_evening_notifications('2027-04-07'), 1, '예빈만');
select is((select target from public.notification where kind = 'review_due'),
  '/salary/review?checklist=' || (select id from public.pay_checklist
    where owner_user_id = '22222222-2222-2222-2222-222222222222' and cycle_start = '2027-03-10'),
  '알림 링크에 체크리스트 id');

-- 5. 호칭이 없으면 “파트너가”, 모두 체크면 “다 했어요”
update public.app_user set nickname = null where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.check_pay_line(pg_temp.line('22222222-2222-2222-2222-222222222222', 'fixed'), 'checked');
select public.check_pay_line(pg_temp.line('22222222-2222-2222-2222-222222222222', 'living'), 'checked');
reset role;
select is((select title from public.notification where kind = 'partner_done' and user_id = '11111111-1111-1111-1111-111111111111'),
  '파트너가 3월 월급 체크를 다 했어요', '모두 체크면 다 했어요, 호칭 없으면 파트너가');

-- 6. 달성 알림 링크: 주인(찬우) = W-12, 파트너(예빈, 보기만) = W-10
update public.goal set target_amount = 950000, owner_user_id = '11111111-1111-1111-1111-111111111111' where template = 'home';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.achieve_goal((select id from public.goal where template = 'home')), true, '달성');
reset role;
select results_eq(
  $$ select user_id, target from public.notification where kind = 'goal_achieved' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '/salary/items/' || (select id from public.goal where template = 'home') || '/achieved'),
            ('22222222-2222-2222-2222-222222222222'::uuid, '/salary/items/' || (select id from public.goal where template = 'home')) $$,
  '고칠 수 있는 사람은 W-12, 파트너는 W-10');

-- 7. checklist_closed: 다음 기준일 0시에 찬우 3월 월급이 끝남(끝나기 전 ‘다 끝남’, 체크 1/2 = 50%, 못 한 저금 없음)
delete from public.server_event;
select public.run_cycle_checklists('2027-04-25');
select pg_temp.flush();
select results_eq(
  $$ select (props->>'done')::boolean, props->>'checked_ratio_band', (props->>'missed_saving_lines')::int, props->>'missed_saving_band'
     from public.server_event where name = 'checklist_closed' and user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values (true, '50-99', 0, null::text) $$,
  '체크리스트 끝남 이벤트');
select results_eq(
  $$ select user_id, props->>'cycle_type' from public.server_event where name = 'checklist_generated' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'regular'), ('22222222-2222-2222-2222-222222222222'::uuid, 'regular') $$,
  '다음 달 체크리스트는 regular');

-- 8. 금액 구간(core amountBand와 같은 이름)
select results_eq(
  $$ select public.amount_band(v) from unnest(array[99999, 100000, 500000, 1000000, 3000000, 10000000]::bigint[]) v $$,
  $$ values ('<10만'), ('10-50만'), ('50-100만'), ('100-300만'), ('300-1000만'), ('1000만+') $$,
  '금액 구간');

select * from finish();
rollback;
