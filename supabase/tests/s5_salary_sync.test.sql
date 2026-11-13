-- pgTAP: QA 5구간 서버(2026-11-12). 찬우, 예빈
-- S5-04 저금 추가·그만 모음 되돌리기·W-12a가 월급 계획 변경 신호(version)를 올림
-- S5-09 그만 모음 되돌리기는 원래 자리로
-- S5-05(D2) 각자 → 합쳐서: 직접 추가 줄은 같은 이름끼리 더해 한 줄, 10줄이 넘어도 모두 두고 추가만 막힘
-- S5-18 관리 방식 알림 링크
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
create function pg_temp.ver(p uuid) returns integer language sql as $$
  select version::integer from public.salary_split where owner_user_id is not distinct from p;
$$;
create function pg_temp.order_of(p uuid) returns text language sql as $$
  select string_agg(coalesce(g.name, l.name, l.kind::text), ',' order by l.sort)
  from public.split_line l join public.salary_split s on s.id = l.split_id left join public.goal g on g.id = l.goal_id
  where s.owner_user_id is not distinct from p;
$$;

-- 찬우(350만, 25일): 고정지출·생활비·용돈 + 직접 추가 관리비·통신비
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000),
  jsonb_build_object('kind', 'custom', 'name', '관리비', 'amount', 150000),
  jsonb_build_object('kind', 'custom', 'name', '통신비', 'amount', 100000)
), auth.uid());
select public.start_checklist(auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);

-- S5-04: 저금 추가는 월급 계획 변경 신호
select set_config('test.v', pg_temp.ver(auth.uid())::text, true);
select public.add_saving_item('청약', 440000);
select public.add_saving_item('여행', 300000);
select public.add_saving_item('적금', 200000, 1000000);
select cmp_ok(pg_temp.ver(auth.uid()), '>', current_setting('test.v')::integer, '저금 추가: 월급 계획 version 올림');
select is(pg_temp.order_of(auth.uid()), '청약,여행,적금,fixed,living,allowance,관리비,통신비', '새 저금은 저금 묶음 맨 아래');

-- S5-09: 가운데 저금 ‘그만 모음’ → 되돌리기 = 원래 자리, 원래 금액
select public.saving_item_stop(pg_temp.item('여행'));
select is(pg_temp.order_of(auth.uid()), '청약,적금,fixed,living,allowance,관리비,통신비', '그만 모으면 줄이 빠짐');
select set_config('test.v', pg_temp.ver(auth.uid())::text, true);
select public.saving_item_reopen(pg_temp.item('여행'));
select is(pg_temp.order_of(auth.uid()), '청약,여행,적금,fixed,living,allowance,관리비,통신비', '되돌리면 원래 자리');
select is((select amount from public.split_line where goal_id = pg_temp.item('여행')), 300000::bigint, '되돌리면 원래 금액');
select cmp_ok(pg_temp.ver(auth.uid()), '>', current_setting('test.v')::integer, '되돌리기: version 올림');
select is((select count(*)::int from public.split_line where split_id = (select id from public.salary_split where owner_user_id = auth.uid()))
  , (select count(distinct sort)::int from public.split_line where split_id = (select id from public.salary_split where owner_user_id = auth.uid())),
  '자리가 겹치지 않음');

-- W-12a ‘계속 모을게요’(목표 금액만 지움, 줄은 그대로): 버전만 올리고 고친 때는 그대로
reset role;
update public.goal set status = 'achieved', achieved_at = now() where id = pg_temp.item('적금');
select set_config('test.at', (select updated_at::text from public.salary_split where owner_user_id = '11111111-1111-1111-1111-111111111111'), true);
select set_config('test.v', pg_temp.ver('11111111-1111-1111-1111-111111111111')::text, true);
set local role authenticated;
select public.saving_item_keep(pg_temp.item('적금'));
select cmp_ok(pg_temp.ver(auth.uid()), '>', current_setting('test.v')::integer, 'W-12a 계속 모을게요: version 올림');
select is((select updated_at::text from public.salary_split where owner_user_id = auth.uid()), current_setting('test.at'),
  '줄이 그대로면 고친 때(W-02 상대 변경 안내)는 그대로');
reset role;

-- 예빈(270만, 10일) 합류: 각자 월급 계획, 직접 추가 관리비(같은 이름) + 9줄
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 680000),
  jsonb_build_object('kind', 'allowance', 'amount', 270000),
  jsonb_build_object('kind', 'custom', 'name', '관리비', 'amount', 50000),
  jsonb_build_object('kind', 'custom', 'name', '구독료', 'amount', 20000),
  jsonb_build_object('kind', 'custom', 'name', '헬스장', 'amount', 10000),
  jsonb_build_object('kind', 'custom', 'name', '교통비', 'amount', 10000),
  jsonb_build_object('kind', 'custom', 'name', '보험료', 'amount', 10000),
  jsonb_build_object('kind', 'custom', 'name', '정수기', 'amount', 10000),
  jsonb_build_object('kind', 'custom', 'name', '부모님 용돈', 'amount', 10000),
  jsonb_build_object('kind', 'custom', 'name', '학원비', 'amount', 10000),
  jsonb_build_object('kind', 'custom', 'name', '병원비', 'amount', 10000),
  jsonb_build_object('kind', 'custom', 'name', '세차', 'amount', 10000)
));

-- 각자 → 합쳐서(예빈이 바꿈)
reset role; select public.set_salary_mode('joint'); set local role authenticated; -- 앱 역할은 못 부름(20261205090000)
select is((select amount from public.split_line where kind = 'custom' and name = '관리비'), 200000::bigint,
  '같은 이름 직접 추가 줄은 금액을 더해 한 줄(15만 + 5만)');
select is((select count(*)::int from public.split_line where kind = 'custom' and name = '관리비'), 1, '관리비는 한 줄');
select is((select count(*)::int from public.split_line where kind = 'custom'), 11, '합쳐 11줄이어도 모두 둠');
select is((select string_agg(name, ',' order by sort) from public.split_line where kind = 'custom'),
  '관리비,구독료,헬스장,교통비,보험료,정수기,부모님 용돈,학원비,병원비,세차,통신비', '순서는 바꾼 사람 것 먼저');
select throws_ok(
  $$ select public.split_line_add((select id from public.salary_split where owner_user_id is null), 'custom', 10000, '세탁비') $$,
  '22023', 'too_many_custom', '10줄이 넘으면 더 추가만 막힘');
select is((select count(*)::int from public.split_line where kind = 'allowance'), 2, '용돈은 사람마다 1줄 그대로');
reset role;
select is((select target from public.notification where kind = 'salary_mode' order by created_at desc limit 1), '/salary?view=plan',
  '관리 방식 알림 링크는 월급 계획(/salary?view=plan)');

select * from finish();
rollback;
