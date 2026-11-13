-- pgTAP: W-01 월급 계획 영수증(2026-11-09, 20 W-01·다시 계산되는 때, 06 3-4). 찬우, 예빈
-- 줄마다 바로 저장: split_line_set / split_line_add / split_line_delete / split_reorder.
-- 권한(각자 = 주인만, 합쳐서 = 두 사람, 대기 중 = 막음), 이번 달 체크리스트(체크 안 한 줄만 따름), 저금 줄 지우기 = 그만 모음,
-- 기본 지출 줄 지우기 + 관리 방식 바꾸기(없는 줄은 0원), 파트너 알림 묶음
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- v2.2 D1 첫 사이클 소급 없음(20261201090000): 이 테스트는 이번 사이클 목록이 필요해 월급 계획 시작일 제한을 풂
create function pg_temp.no_backdate() returns void language sql security definer as $$
  update public.salary_split set checklist_from = null;
$$;
-- 월급 계획 줄(주인 o, 합쳐서면 null): 종류 + (직접 추가 줄 이름 또는 저금 항목 이름)
create function pg_temp.sl(o uuid, k text, n text default null) returns uuid language sql as $$
  select l.id from public.split_line l join public.salary_split s on s.id = l.split_id
  left join public.goal g on g.id = l.goal_id
  where s.owner_user_id is not distinct from o and l.kind::text = k
    and (n is null or l.name = n or g.name = n) limit 1;
$$;
create function pg_temp.split(o uuid) returns uuid language sql as $$
  select id from public.salary_split where owner_user_id is not distinct from o;
$$;
-- 이번 달 체크리스트 줄 상태·금액(이름 또는 종류로)
create function pg_temp.cl(o uuid, k text, n text default null) returns table (state text, planned bigint) language sql as $$
  select x.state, x.planned from public.pay_check_line x join public.pay_checklist c on c.id = x.checklist_id
  left join public.goal g on g.id = x.goal_id
  where c.owner_user_id is not distinct from o and x.kind::text = k and (n is null or x.name = n or g.name = n)
    and c.cycle_start <= public.kst_today() and c.cycle_end >= public.kst_today()
  order by x.state;
$$;
create function pg_temp.order_of(o uuid) returns text language sql as $$
  select string_agg(coalesce(g.name, l.name, l.kind::text), ',' order by l.sort)
  from public.split_line l join public.salary_split s on s.id = l.split_id left join public.goal g on g.id = l.goal_id
  where s.owner_user_id is not distinct from o;
$$;

-- 찬우(350만, 25일): 고정지출 88만, 생활비 88만, 용돈 35만 + 저금 청약 44만, 내 집 마련 95만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'living', 'in_checklist', true, 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'in_checklist', true, 'amount', 350000)
), auth.uid());
select pg_temp.no_backdate();
select public.start_checklist(auth.uid());
select public.add_saving_item('청약', 440000);
select public.add_saving_item('내 집 마련', 950000);
select set_config('test.code', (select code from public.create_invite()), true);
select is(pg_temp.order_of(auth.uid()), '청약,내 집 마련,fixed,living,allowance', '저금 줄(만든 순서) → 지출 줄');

-- 줄 하나 금액(생활비 88만 → 80만): 월급 계획 + 이번 달 체크 안 한 줄
select set_config('test.v', (select version::text from public.salary_split where id = pg_temp.split(auth.uid())), true);
select lives_ok(format('select public.split_line_set(%L, 800000)', pg_temp.sl(auth.uid(), 'living')), '금액 바꾸기');
select is((select amount from public.split_line where id = pg_temp.sl(auth.uid(), 'living')), 800000::bigint, '월급 계획 금액');
select results_eq($$ select * from pg_temp.cl(auth.uid(), 'living') $$, $$ values ('wait', 800000::bigint) $$,
  '이번 달 체크 안 한 줄도 새 금액');
select ok((select version > current_setting('test.v')::int and updated_by = auth.uid()
  from public.salary_split where id = pg_temp.split(auth.uid())), '고친 사람·버전(Realtime 신호)');
select throws_ok(format('select public.split_line_set(%L, 15000)', pg_temp.sl(auth.uid(), 'living')), '22023', 'bad_amount',
  '1만 원 단위');
select throws_ok(format('select public.split_line_set(%L, null, %L)', pg_temp.sl(auth.uid(), 'fixed'), '집세'), '22023', 'bad_name',
  '기본 줄 이름은 그대로');

-- 체크한 줄은 그대로(고정지출 체크 → 90만으로 바꿈)
select public.check_pay_line((select x.id from public.pay_check_line x where x.kind = 'fixed'
  and x.space_id = (select space_id from public.app_user where id = auth.uid())), 'checked');
select public.split_line_set(pg_temp.sl(auth.uid(), 'fixed'), 900000);
select results_eq($$ select * from pg_temp.cl(auth.uid(), 'fixed') $$, $$ values ('checked', 880000::bigint) $$,
  '체크한 줄은 그대로, 같은 줄이 또 생기지 않음');

-- 지출 줄 추가(관리비 10만): 지출 묶음 맨 아래 + 이번 달 체크 안 한 줄
select lives_ok(format('select public.split_line_add(%L, %L, 100000, %L)', pg_temp.split(auth.uid()), 'custom', '관리비'),
  '직접 추가 줄');
select is(pg_temp.order_of(auth.uid()), '청약,내 집 마련,fixed,living,allowance,관리비', '지출 묶음 맨 아래');
select results_eq($$ select * from pg_temp.cl(auth.uid(), 'custom', '관리비') $$, $$ values ('wait', 100000::bigint) $$,
  '이번 달 체크리스트에도');
select throws_ok(format('select public.split_line_add(%L, %L, 0, %L)', pg_temp.split(auth.uid()), 'custom', '관리비'),
  '22023', 'duplicate_line', '같은 이름 없음');
select throws_ok(format('select public.split_line_add(%L, %L, 0)', pg_temp.split(auth.uid()), 'fixed'),
  '22023', 'duplicate_line', '고정지출은 하나');
select throws_ok(format('select public.split_line_add(%L, %L, 0)', pg_temp.split(auth.uid()), 'saving'),
  '22023', 'bad_kind', '저금 줄은 add_saving_item으로');
select throws_ok(format('select public.split_line_add(%L, %L, 0, %L)', pg_temp.split(auth.uid()), 'custom', ''),
  '22023', 'bad_name', '이름 필요');

-- 이름 바꾸기: 체크한 줄은 예전 이름 그대로, 새 이름 줄이 이번 달에 또 생기지 않음(줄 id로 맞춤)
select public.check_pay_line((select x.id from public.pay_check_line x where x.name = '관리비'), 'checked');
select lives_ok(format('select public.split_line_set(%L, null, %L)', pg_temp.sl(auth.uid(), 'custom', '관리비'), '아파트 관리비'),
  '직접 추가 줄 이름 바꾸기');
select is((select name from public.split_line where id = pg_temp.sl(auth.uid(), 'custom', '아파트 관리비')), '아파트 관리비',
  '월급 계획 이름');
select is((select count(*)::int from pg_temp.cl(auth.uid(), 'custom')), 1, '이번 달 줄은 하나(체크한 예전 줄)');

-- 순서 바꾸기(편집 ‘완료’): 지출 묶음 안에서 용돈을 맨 위로. 체크한 줄도 같은 순서
select lives_ok(format('select public.split_reorder(%L, %L::uuid[])', pg_temp.split(auth.uid()), array[
  pg_temp.sl(auth.uid(), 'saving', '내 집 마련'), pg_temp.sl(auth.uid(), 'saving', '청약'),
  pg_temp.sl(auth.uid(), 'allowance'), pg_temp.sl(auth.uid(), 'fixed'), pg_temp.sl(auth.uid(), 'living'),
  pg_temp.sl(auth.uid(), 'custom', '아파트 관리비')]), '순서 바꾸기');
select is(pg_temp.order_of(auth.uid()), '내 집 마련,청약,allowance,fixed,living,아파트 관리비', '새 순서');
select is((select string_agg(coalesce(g.name, x.name, x.kind::text), ',' order by x.sort)
  from public.pay_check_line x join public.pay_checklist c on c.id = x.checklist_id left join public.goal g on g.id = x.goal_id
  where c.owner_user_id = auth.uid()), '내 집 마련,청약,allowance,fixed,living,관리비', '이번 달 체크리스트도(체크한 줄 포함)');
select throws_ok(format('select public.split_reorder(%L, %L::uuid[])', pg_temp.split(auth.uid()), array[
  pg_temp.sl(auth.uid(), 'saving', '청약')]), '22023', 'bad_lines', '모든 줄이 있어야 함');
select throws_ok(format('select public.split_reorder(%L, %L::uuid[])', pg_temp.split(auth.uid()), array[
  pg_temp.sl(auth.uid(), 'allowance'), pg_temp.sl(auth.uid(), 'saving', '내 집 마련'), pg_temp.sl(auth.uid(), 'saving', '청약'),
  pg_temp.sl(auth.uid(), 'fixed'), pg_temp.sl(auth.uid(), 'living'), pg_temp.sl(auth.uid(), 'custom', '아파트 관리비')]),
  '22023', 'bad_order', '묶음 사이로는 못 옮김');

-- 기본 줄 지우기: 체크한 고정지출은 이번 달 기록으로 남고, 체크 안 한 생활비는 이번 달에서도 빠짐
select lives_ok(format('select public.split_line_delete(%L)', pg_temp.sl(auth.uid(), 'fixed')), '고정지출 지우기');
select is(pg_temp.sl(auth.uid(), 'fixed'), null, '월급 계획에서 빠짐');
select results_eq($$ select * from pg_temp.cl(auth.uid(), 'fixed') $$, $$ values ('checked', 880000::bigint) $$,
  '이미 체크한 줄은 이번 달에 남음');
select public.split_line_delete(pg_temp.sl(auth.uid(), 'living'));
select is((select count(*)::int from pg_temp.cl(auth.uid(), 'living')), 0, '체크 안 한 줄은 이번 달에서도 빠짐');
-- 되돌리기: 같은 자리(2)에 같은 금액
select lives_ok(format('select public.split_line_add(%L, %L, 800000, null, null, 3)', pg_temp.split(auth.uid()), 'living'),
  '지운 생활비 되돌리기');
select is(pg_temp.order_of(auth.uid()), '내 집 마련,청약,allowance,living,아파트 관리비', '같은 자리로');

-- 저금 줄 지우기 = 그만 모음(기록은 남음)
select lives_ok(format('select public.split_line_delete(%L)', pg_temp.sl(auth.uid(), 'saving', '청약')), '저금 줄 지우기');
select ok((select closed_at is not null and deleted_at is null from public.goal where name = '청약'), '그만 모음(휴지통 아님)');
select is(pg_temp.sl(auth.uid(), 'saving', '청약'), null, '월급 계획에서 빠짐');
reset role;

-- 예빈 합류(각자): 찬우 월급 계획은 보기만
reset role;
-- v2.2 공개 단계(20261202090000): 이 테스트는 상대 월급 계획 전체를 보므로 ‘모두 보여 주기’
update public.app_user set plan_share = 'all';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 680000),
  jsonb_build_object('kind', 'allowance', 'amount', 270000)
));
select throws_ok(format('select public.split_line_set(%L, 0)', pg_temp.sl('11111111-1111-1111-1111-111111111111', 'living')),
  '42501', 'not_owner', '파트너 줄 금액 막음');
select throws_ok(format('select public.split_line_add(%L, %L, 0, %L)', pg_temp.split('11111111-1111-1111-1111-111111111111'),
  'custom', '통신비'), '42501', 'not_owner', '파트너 월급 계획에 추가 막음');
select throws_ok(format('select public.split_line_delete(%L)', pg_temp.sl('11111111-1111-1111-1111-111111111111', 'allowance')),
  '42501', 'not_owner', '파트너 줄 지우기 막음');
select throws_ok(format('select public.split_reorder(%L, %L::uuid[])', pg_temp.split('11111111-1111-1111-1111-111111111111'),
  array[]::uuid[]), '42501', 'not_owner', '파트너 순서 막음');
select lives_ok(format('select public.split_line_set(%L, 700000)', pg_temp.sl(auth.uid(), 'living')), '내 줄은 고침');
reset role;

-- v2.2(B8): 각자 계열 월급 계획 변경(금액, 이름, 순서)은 상대에게 기록·알림하지 않음
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.split_line_set(pg_temp.sl(auth.uid(), 'living'), 900000);
select public.split_line_set(pg_temp.sl(auth.uid(), 'living'), 1000000);
select public.split_line_add(pg_temp.split(auth.uid()), 'custom', 50000, '통신비');
select public.split_line_set(pg_temp.sl(auth.uid(), 'custom', '통신비'), null, '휴대폰');
select public.split_reorder(pg_temp.split(auth.uid()), array(
  select l.id from public.split_line l where l.split_id = pg_temp.split(auth.uid()) order by l.kind <> 'saving', l.sort desc));
reset role;
select is((select count(*)::int from public.partner_change where target = '/salary?view=plan'), 0,
  '각자 계열 월급 계획 변경은 기록하지 않음');
select is(public.flush_partner_changes(now() + interval '11 minutes'), 0, '10분 뒤에도 보낼 것 없음');
select is((select count(*)::int from public.notification where user_id = '22222222-2222-2222-2222-222222222222'
  and kind in ('partner_change', 'partner_activity')), 0, '예빈에게 알림 없음');
select is(public.partner_change_line('split', 'order', '', null, '1'), '월급 계획 순서를 바꿨어요', '순서 바꾸기 문구(합쳐서용)');
select is(public.partner_change_line('split', 'name:x', '통신비', '통신비', '휴대폰'), '이름 통신비 → 휴대폰', '이름 바꾸기 문구');

update public.app_user set plan_share = 'all'; -- v2.2 공개 단계: 예빈 월급 계획 줄도 봄
-- 관리 방식 각자 → 합쳐서: 찬우는 고정지출이 없음(0원으로 셈) → 공동 고정지출 = 예빈 것만
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
reset role; select public.set_salary_mode('joint'); set local role authenticated; -- 앱 역할은 못 부름(20261205090000)
select is((select amount from public.split_line where id = pg_temp.sl(null, 'fixed')), 680000::bigint,
  '한쪽에 없는 고정지출은 0원으로 더함');
select is((select count(*)::int from public.split_line where split_id = pg_temp.split(null) and kind = 'allowance'), 2,
  '용돈은 사람마다 1줄');
-- 합쳐서: 두 사람 모두 고침, 용돈 줄은 지울 수 없음
select lives_ok(format('select public.split_line_set(%L, 600000)', pg_temp.sl(null, 'fixed')), '예빈이 공동 줄 고침');
select throws_ok(format('select public.split_line_delete(%L)', pg_temp.sl(null, 'allowance')), '22023', 'keep_allowance',
  '합쳐서 용돈 줄은 지울 수 없음');
select lives_ok(format('select public.split_line_delete(%L)', pg_temp.sl(null, 'fixed')), '공동 고정지출 지우기');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok(format('select public.split_line_add(%L, %L, 300000, %L)', pg_temp.split(null), 'custom', '보험료'),
  '찬우도 공동 월급 계획에 추가');
-- 합쳐서 → 각자: 공동에 고정지출이 없으면 각자에도 없음, 용돈은 사람마다
reset role; select public.set_salary_mode('separate'); set local role authenticated; -- 앱 역할은 못 부름(20261205090000)
select is((select count(*)::int from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.space_id = (select space_id from public.app_user where id = auth.uid()) and l.kind = 'fixed'), 0,
  '없는 고정지출은 각자에도 없음');
select is((select count(*)::int from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is not null and l.kind = 'allowance' and l.user_id = s.owner_user_id), 2, '용돈은 자기 월급 계획으로');
reset role;

-- 연결 해제 대기 중: 막음
update public.couple_space set couple_state = 'unlink_pending'
  where id = (select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format('select public.split_line_set(%L, 0)', pg_temp.sl(auth.uid(), 'allowance')), '42501', 'unlink_pending',
  '대기 중 금액 막음');
select throws_ok(format('select public.split_line_add(%L, %L, 0, %L)', pg_temp.split(auth.uid()), 'custom', '구독료'),
  '42501', 'unlink_pending', '대기 중 추가 막음');
reset role;

select * from finish();
rollback;
