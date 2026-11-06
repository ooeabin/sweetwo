-- pgTAP: 만기된 돈 정리(23 F-04a), 만기일 당일·연말정산 알림(14). 찬우(시작한 사람), 예빈(합류한 사람)
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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
update public.app_user set nickname = '찬우' where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, maturity_date)
  select space_id, 'asset', 'deposit', 'saving', '청년 적금', 12000000, 'person', auth.uid(), '2027-03-02'
  from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, maturity_date)
  select space_id, 'asset', 'deposit', 'term_deposit', '정기 예금', 5000000, 'person', auth.uid(), '2027-03-02'
  from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  select space_id, 'asset', 'cash', 'bank', '입출금 통장', 3000000, 'person', auth.uid()
  from public.app_user where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
update public.couple_space set marriage_status = 'married';

-- 만기일 당일 오전 9시: 명의자에게
select is(public.send_morning_notifications('2027-03-02'), 2, '만기 둘');
select results_eq(
  $$ select title, body, target, topic from public.notification where kind = 'matured' order by title $$,
  $$ values ('정기 예금이 만기됐어요', '어디로 옮겼는지 알려 주세요',
             '/assets/' || (select id from public.asset where name = '정기 예금') || '/matured', 'money'),
            ('청년 적금이 만기됐어요', '어디로 옮겼는지 알려 주세요',
             '/assets/' || (select id from public.asset where name = '청년 적금') || '/matured', 'money') $$,
  '만기된 돈 정리 알림');

-- 다른 통장으로: 통장 + 만기 금액, 만기 완료로 보관
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.settle_matured((select id from public.asset where name = '청년 적금'),
  (select id from public.asset where name = '입출금 통장')) $$, '다른 통장으로');
select is((select amount from public.asset where name = '입출금 통장'), 15000000::bigint, '통장 + 만기 금액');
select is((select status::text from public.asset where name = '청년 적금'), 'matured', '만기 완료');
-- 다시 가입했어요: 새 만기일(오늘 뒤만), 둘 중 하나만
select throws_ok($$ select public.settle_matured((select id from public.asset where name = '정기 예금'), null, '2020-01-01') $$,
  '22023', 'bad_date', '지난 날은 안 됨');
select throws_ok($$ select public.settle_matured((select id from public.asset where name = '정기 예금')) $$,
  '22023', 'bad_choice', '둘 중 하나');
select public.settle_matured((select id from public.asset where name = '정기 예금'), null, '2099-03-02');
select is((select maturity_date from public.asset where name = '정기 예금'), '2099-03-02'::date, '새 만기일');
reset role;

-- 남의 개인 항목은 못 정리함
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select throws_ok($$ select public.settle_matured((select id from public.asset where name = '정기 예금'), null, '2099-04-02') $$,
  '42501', 'not_found', '배우자 개인 항목은 못 고침');
reset role;

-- 연말정산: 1월 둘째 주 월요일(2027-01-11), 결혼한 부부 두 사람
delete from public.notification;
select is(public.send_morning_notifications('2027-01-11'), 2, '연말정산 준비 둘 다');

select * from finish();
rollback;
