-- pgTAP: 기획 검토 2차(2026-11-09). 찬우(시작), 예빈(합류), 각자
-- 1) 시작할 때 모은 금액(W-11c ‘이미 모은 금액이 있어요’): 만들 때만, 모은 금액 = 시작값 + 체크한 저금 합, 앱이 바로 못 고침
-- 2) 각자 모드 파트너 것은 모두 보기만: 월급 계획(save_split), 체크리스트(check_pay_line), 저금(goal 고치기, 달성 뒤 선택)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.item(n text) returns uuid language sql as $$
  select id from public.goal where name = n and deleted_at is null order by created_at desc limit 1;
$$;

-- 찬우: 월급 계획 + 체크리스트 + 초대
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000)
), auth.uid());
select public.start_checklist(auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);

-- 1) 시작할 때 모은 금액
select throws_ok($$ select public.add_saving_item('내 집 마련', 950000, 150000000, null, -1) $$, '22023', 'bad_start',
  '시작값은 0원 이상');
select throws_ok($$ select public.add_saving_item('내 집 마련', 950000, 150000000, null, 150000000) $$, '22023', 'bad_start',
  '시작값은 목표 금액보다 적게');
select lives_ok($$ select public.add_saving_item('내 집 마련', 950000, 150000000, null, 20000000) $$,
  '이미 모은 2,000만 원으로 시작');
select lives_ok($$ select public.add_saving_item('적금', 300000, null, null, 5000000) $$, '목표 금액 없이도 시작값');
select lives_ok($$ select public.add_saving_item('여행', 100000) $$, '시작값 없이(기본 0, 예전 호출과 같음)');
select is((select start_saved from public.goal where id = pg_temp.item('내 집 마련')), 20000000::bigint, '시작값 저장');
select is((select saved from public.goal_saved_sums() where goal_id = pg_temp.item('내 집 마련')), 20000000::bigint,
  '체크 전 모은 금액 = 시작값');
select public.check_pay_line((select id from public.pay_check_line where goal_id = pg_temp.item('내 집 마련')), 'checked');
select is((select saved from public.goal_saved_sums() where goal_id = pg_temp.item('내 집 마련')), 20950000::bigint,
  '모은 금액 = 시작값 + 체크한 저금');
select throws_ok($$ update public.goal set start_saved = 0 where id = pg_temp.item('내 집 마련') $$, '42501', null,
  '시작값은 만들 때만(앱이 바로 못 고침)');
reset role;

-- 예빈 합류(각자) + 예빈 월급 계획·저금
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'living', 'amount', 680000)
), auth.uid());
select public.start_checklist(auth.uid());
select public.add_saving_item('카메라', 100000, 1000000);
reset role;

-- 2) 찬우가 예빈 것을 고치려 함: 모두 보기만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'living', 'amount', 500000)), '22222222-2222-2222-2222-222222222222') $$,
  '42501', 'not_owner', '파트너 월급 계획 지출 줄은 못 고침');
select throws_ok($$ select public.check_pay_line((select l.id from public.pay_check_line l
    join public.pay_checklist c on c.id = l.checklist_id
    where c.owner_user_id = '22222222-2222-2222-2222-222222222222' and l.kind = 'living'), 'checked') $$,
  '42501', 'not_owner', '파트너 체크리스트는 체크 못 함');
update public.goal set name = '찬우가 바꿈' where id = (select id from public.goal where name = '카메라');
select is((select count(*)::int from public.goal where name = '카메라'), 1, '파트너 저금 이름은 그대로(RLS)');
select throws_ok($$ select public.saving_item_stop((select id from public.goal where name = '카메라')) $$,
  '42501', 'not_owner', '파트너 저금 그만 모으기 못 함');
select lives_ok($$ select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', pg_temp.item('내 집 마련'), 'amount', 950000),
  jsonb_build_object('kind', 'living', 'amount', 900000)), auth.uid()) $$, '내 월급 계획은 고침');
reset role;
select is((select amount from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id = '22222222-2222-2222-2222-222222222222' and l.kind = 'living'), 680000::bigint,
  '예빈 생활비 그대로');

-- 파트너 변경 알림 문구: ‘저금’
select is(public.partner_change_title('goal', '카메라', '예빈'), '예빈님이 카메라 저금을 바꿨어요', '알림 제목은 ‘저금’');

select * from finish();
rollback;
