-- pgTAP: 실구동 사용성 B(20261211090000_ux_b_home_notify). 한 사람 관리형에서 관리하지 않는 쪽은 관리하는 사람 손 줄로
-- 월급날·월급 전 확인 알림을 받지 않고(진행 소식만), 그 줄을 확인할 수 없음. 파트너 확인 끝 문구, partner_activity 푸시 없음,
-- 분담 ‘좋아요’ 뒤 생활비 줄 줄임, 합류 알림 공개 단계.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우(시작한 사람) 공간, 예빈 합류(각자 계열로 합류한 뒤 아래에서 한 사람 관리형 = 찬우 관리로 바꿈)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25, onboarding_done_at = now() where id = auth.uid();
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select set_config('test.space', (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'), true);

-- 합류 알림: 예빈이 ‘저금만 보여 주기’(기본)로 합류 → “이제 저금을 같이 봐요”
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2800000, payday = 25 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 500000)));
reset role;
select is((select body from public.notification where kind = 'partner_joined'), '이제 저금을 같이 봐요',
  '합류 알림은 합류한 사람 공개 단계대로(저금만)');

-- 한 사람 관리형: 합쳐서 + 관리하는 사람 = 찬우. 공동 월급 계획(찬우 고정지출·생활비 손 줄, 예빈 보내기·용돈 자동 줄)
update public.couple_space set salary_mode = 'joint', manager_user_id = '11111111-1111-1111-1111-111111111111',
  joint_cycle_day = 25 where id = current_setting('test.space')::uuid;
insert into public.salary_split (space_id, owner_user_id, checklist_from) values (current_setting('test.space')::uuid, null, '2027-01-01');
insert into public.split_line (split_id, space_id, kind, amount, sort, user_id, in_checklist, auto_pay)
select s.id, s.space_id, v.kind::public.split_line_kind, v.amount, v.sort, v.uid, true, v.auto
from public.salary_split s,
  (values ('fixed', 680000, 0, null::uuid, false), ('living', 880000, 1, null::uuid, false),
          ('send', 2400000, 2, '22222222-2222-2222-2222-222222222222'::uuid, true),
          ('allowance', 400000, 3, '22222222-2222-2222-2222-222222222222'::uuid, true)) v(kind, amount, sort, uid, auto)
where s.space_id = current_setting('test.space')::uuid and s.owner_user_id is null;
select set_config('test.cl', public.make_checklist(current_setting('test.space')::uuid, null, '2027-01-25')::text, true);
delete from public.notification;

-- 1. pay_line_mine
select results_eq(
  $$ select l.kind::text, public.pay_line_mine(l.kind::text, l.user_id, null, l.space_id, '11111111-1111-1111-1111-111111111111'),
       public.pay_line_mine(l.kind::text, l.user_id, null, l.space_id, '22222222-2222-2222-2222-222222222222')
     from public.pay_check_line l where l.checklist_id = current_setting('test.cl')::uuid order by l.sort $$,
  $$ values ('fixed', true, false), ('living', true, false), ('send', true, true), ('allowance', true, true) $$,
  '관리하는 사람은 모든 줄, 관리하지 않는 쪽은 자기 줄만');

-- 2. 월급날 09:00: 찬우만 월급날 알림, 예빈은 없음(진행 소식 대상)
select public.send_morning_notifications('2027-01-25');
select results_eq($$ select user_id from public.notification where kind = 'payday' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$, '월급날 알림은 관리하는 사람만');
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  values (current_setting('test.space')::uuid, 'travel', '여행', 'once', 1, 3000000);
select public.send_progress_news('2027-01-25');
select results_eq($$ select user_id from public.notification where kind = 'progress_news' $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid) $$, '관리하지 않는 쪽은 진행 소식만');

-- 3. 월급 전 확인(다음 기준일 3일 전): 남은 손 줄은 찬우 것뿐 → 찬우만
select public.send_evening_notifications((select cycle_end - 2 from public.pay_checklist where id = current_setting('test.cl')::uuid));
select results_eq($$ select user_id, title from public.notification where kind = 'review_due' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '1월 25일 월급에서 확인할 게 2개 남았어요') $$,
  '월급 전 확인도 관리하는 사람만');

-- 4. 예빈은 찬우 손 줄을 확인할 수 없음, 모두 계획대로 됐어요도 자기 줄만(손 줄 없음 → 0)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(
  format($$ select public.check_pay_line(%L, 'checked') $$,
    (select id from public.pay_check_line where checklist_id = current_setting('test.cl')::uuid and kind = 'fixed')),
  '42501', 'not_owner', '관리하지 않는 쪽은 관리하는 사람 줄을 확인 못 함');
reset role;
update public.pay_checklist set cycle_end = '2099-12-31' where id = current_setting('test.cl')::uuid;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.confirm_payday(current_setting('test.cl')::uuid), 0, '모두 계획대로 됐어요는 자기 손 줄만(없음)');
reset role;
select is((select count(*)::int from public.pay_check_line where checklist_id = current_setting('test.cl')::uuid
  and not auto and state = 'wait'), 2, '관리하는 사람 줄은 그대로');

-- 5. 관리하는 사람은 상대 용돈 줄도 확인(주인만이던 B7의 예외, 08 2장)
update public.pay_check_line set auto = false where checklist_id = current_setting('test.cl')::uuid and kind = 'allowance';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok(
  format($$ select public.check_pay_line(%L, 'checked') $$,
    (select id from public.pay_check_line where checklist_id = current_setting('test.cl')::uuid and kind = 'allowance')),
  '관리하는 사람은 상대 용돈 줄 확인');
select is(public.confirm_payday(current_setting('test.cl')::uuid), 2, '관리하는 사람은 남은 손 줄 모두');
reset role;

-- 6. 둘이 같이(관리하는 사람 없음): 남의 용돈 줄은 주인만(그대로)
update public.couple_space set manager_user_id = null where id = current_setting('test.space')::uuid;
select is(public.pay_line_mine('allowance', '22222222-2222-2222-2222-222222222222', null, current_setting('test.space')::uuid,
  '11111111-1111-1111-1111-111111111111'), false, '둘이 같이면 남의 용돈 줄은 주인만');
select is(public.pay_line_mine('fixed', null, null, current_setting('test.space')::uuid,
  '22222222-2222-2222-2222-222222222222'), true, '둘이 같이면 공동 줄은 누구나');
select is(public.pay_line_mine('fixed', null, '11111111-1111-1111-1111-111111111111', current_setting('test.space')::uuid,
  '22222222-2222-2222-2222-222222222222'), false, '각자 목록은 주인만');

-- 7. partner_activity(주간 요약에만 가는 변경)는 푸시하지 않음
select ok(public.noti_inapp_only('partner_activity'), '경조사 추가·메모 같은 주간 요약 변경은 인앱만');

-- 8. 분담 ‘좋아요’: 각자 계열에서 내 몫만큼 생활비 → 고정지출 줄을 줄임(0원 아래로는 안 감)
update public.couple_space set salary_mode = 'separate' where id = current_setting('test.space')::uuid;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 400000)), auth.uid());
select set_config('test.acc', public.propose_split('데이트 통장', 1000000, 'half')::text, true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.answer_split(current_setting('test.acc')::uuid, true), 'accepted', '좋아요');
reset role;
select results_eq(
  $$ select l.kind::text, l.amount from public.split_line l join public.salary_split s on s.id = l.split_id
     where s.owner_user_id = '11111111-1111-1111-1111-111111111111' order by l.kind::text $$,
  $$ values ('fixed', 580000::bigint), ('living', 0::bigint), ('shared_account', 500000::bigint) $$,
  '찬우 몫 50만 원: 생활비 40만 → 0, 남은 10만은 고정지출에서');
select results_eq(
  $$ select l.kind::text, l.amount from public.split_line l join public.salary_split s on s.id = l.split_id
     where s.owner_user_id = '22222222-2222-2222-2222-222222222222' order by l.kind::text $$,
  $$ values ('fixed', 0::bigint), ('shared_account', 500000::bigint) $$,
  '예빈(생활비 없음): 고정지출 50만 → 0');

select * from finish();
rollback;
