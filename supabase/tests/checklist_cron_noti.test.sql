-- pgTAP: 기준일 0시 체크리스트, 월급날·만기·초대 오전 알림, 월말 확인 저녁 알림, 대신 체크·다 했어요 알림(07, 14, 20).
-- 찬우(25일), 예빈(10일), 각자. 날짜는 실제 오늘보다 뒤(2027년)로 돌려 오늘과 상관없이 같은 결과
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'solo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-s', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
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
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, maturity_date)
  select space_id, 'asset', 'deposit', 'term_deposit', '결혼자금 적금', 10000000, 'person', auth.uid(), '2027-05-24'
  from public.app_user where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 1070000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 680000),
  jsonb_build_object('kind', 'allowance', 'amount', 270000)
));
reset role;
delete from public.notification;

-- 기준일 0시: 분배표마다 이번 사이클 체크리스트, 다시 돌려도 같음
select is(public.run_cycle_checklists('2027-03-25'), 2, '두 분배표');
select results_eq(
  $$ select owner_user_id, cycle_start, cycle_end, label from public.pay_checklist
     where cycle_start >= '2027-01-01' order by cycle_start $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, '2027-03-10'::date, '2027-04-09'::date, '3월 월급'),
            ('11111111-1111-1111-1111-111111111111'::uuid, '2027-03-25'::date, '2027-04-24'::date, '3월 월급') $$,
  '기준일 ~ 다음 기준일 전날');
select public.run_cycle_checklists('2027-03-25');
select is((select count(*)::int from public.pay_checklist where cycle_start >= '2027-01-01'), 2, '다시 돌려도 한 번');
select is((select count(*)::int from public.pay_checklist where cycle_start < '2027-01-01' and state <> 'closed'), 0,
  '지난 사이클은 닫힘');

-- 오전 9시: 그날 시작한 체크리스트 주인에게 월급날, 명의자에게 만기 D-60
select is(public.send_morning_notifications('2027-03-25'), 2, '월급날 + 만기');
select results_eq(
  $$ select user_id, kind, title, body, target from public.notification order by kind $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'maturity', '결혼자금 적금이 두 달 뒤 만기예요', null::text,
             '/assets/' || (select id from public.asset where name = '결혼자금 적금')),
            ('11111111-1111-1111-1111-111111111111'::uuid, 'payday', '오늘은 월급날이에요', '분배표대로 보내고 체크해 주세요', '/salary') $$,
  '찬우에게만');
select results_eq($$ select topic from public.notification order by kind $$, $$ values ('money'), ('plan') $$, '알림 묶음');

-- 예빈이 찬우 줄을 대신 체크 → 찬우에게
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.check_pay_line((select l.id from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.cycle_start = '2027-03-25' and l.kind = 'saving'), 'checked');
reset role;
select is((select title || ' / ' || body || ' / ' || topic from public.notification where kind = 'behalf_checked'),
  '예빈님이 대신 체크했어요 / 내 집 마련에 95만 원 / partner_change', '대신 체크 알림');
select is((select user_id from public.notification where kind = 'behalf_checked'),
  '11111111-1111-1111-1111-111111111111'::uuid, '주인에게');

-- 찬우가 남은 줄을 끝냄 → 예빈에게 인앱만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.check_pay_line((select l.id from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.cycle_start = '2027-03-25' and l.kind = 'living'), 'checked');
reset role;
select results_eq(
  $$ select user_id, title, target, topic from public.notification where kind = 'partner_done' $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, '찬우님이 3월 월급을 다 나눴어요',
             '/salary?who=11111111-1111-1111-1111-111111111111', 'silent') $$,
  '다 했어요 알림');

-- 오후 8시 월말 확인: 다음 기준일 3일 전, 체크 안 한 줄이 있는 체크리스트만
select is(public.send_evening_notifications('2027-04-07'), 1, '예빈만(찬우는 다 함)');
select is((select title from public.notification where kind = 'review_due'), '3월 월급에서 체크 안 한 게 4개 있어요', '월말 확인 문구');
select is(public.send_evening_notifications('2027-04-22'), 0, '다 한 체크리스트는 없음');

-- 초대 코드 만료 3일 전(합류 전 공간만)
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select public.create_invite();
reset role;
select public.send_morning_notifications(
  ((select expires_at from public.invite where created_by = '33333333-3333-3333-3333-333333333333') at time zone 'Asia/Seoul')::date - 3);
select is((select title from public.notification where kind = 'invite_remind'), '초대 코드가 3일 뒤 만료돼요', '초대 리마인드');

select * from finish();
rollback;
