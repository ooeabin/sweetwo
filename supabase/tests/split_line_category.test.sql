-- pgTAP: 지출 묶음(split_line.category, 2026-11-27 사용자 결정 ‘대분류 안 소분류’) + 직접 추가 줄 한도 20. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.cat(n text) returns text language sql as $$
  select category from public.split_line where kind = 'custom' and name = n order by sort limit 1;
$$;
create function pg_temp.split(p uuid) returns uuid language sql as $$
  select id from public.salary_split where owner_user_id is not distinct from p;
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 5000000, payday = 25 where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'living', 'amount', 400000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000),
  jsonb_build_object('kind', 'custom', 'name', '식비', 'amount', 600000, 'category', 'living'),
  jsonb_build_object('kind', 'custom', 'name', '월세', 'amount', 700000, 'category', 'housing'),
  jsonb_build_object('kind', 'custom', 'name', '헬스장', 'amount', 50000)
), auth.uid());

-- 2026-11-28: 생활비 기본 줄은 없음. 옛 앱이 보낸 kind living은 직접 추가 줄 ‘생활비’(묶음 living)로 들어감
select is((select count(*)::int from public.split_line where kind = 'living'), 0, 'kind living 줄은 만들어지지 않음');
select is(pg_temp.cat('생활비'), 'living', 'kind living은 직접 추가 줄 생활비(묶음 living)로');
select is(pg_temp.cat('식비'), 'living', 'save_split: 넘긴 묶음 저장');
select is(pg_temp.cat('헬스장'), null, '묶음 없이 넣은 직접 추가 줄은 null');
select is((select category from public.split_line where kind = 'allowance'), null, '용돈 줄은 묶음 없음');

-- 다시 저장할 때 category 키가 없으면 같은 줄의 옛 묶음을 이어받음(지우고 다시 넣어도 보존)
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'living', 'amount', 400000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000),
  jsonb_build_object('kind', 'custom', 'name', '식비', 'amount', 650000),
  jsonb_build_object('kind', 'custom', 'name', '월세', 'amount', 700000),
  jsonb_build_object('kind', 'custom', 'name', '헬스장', 'amount', 50000)
), auth.uid());
select is(pg_temp.cat('식비'), 'living', 'save_split 다시 저장: 묶음 보존');
select is(pg_temp.cat('월세'), 'housing', 'save_split 다시 저장: 주거 묶음 보존');

-- split_line_add: 칩으로 만든 줄은 그 묶음, 없는 code는 거절, 직접 추가 줄이 아니면 거절
select public.split_line_add(pg_temp.split(auth.uid()), 'custom', 100000, '의류', null, null, 'living');
select is(pg_temp.cat('의류'), 'living', 'split_line_add: 묶음 저장');
select throws_ok(
  $$ select public.split_line_add(pg_temp.split(auth.uid()), 'custom', 10000, '간식', null, null, 'snack') $$,
  '23514', null, '칩 표에 없는 묶음 code는 거절');
select throws_ok(
  $$ select public.split_line_add(pg_temp.split(auth.uid()), 'fixed', 10000, null, null, null, 'housing') $$,
  '22023', 'bad_category', '직접 추가 줄이 아니면 묶음을 받지 않음');

-- split_line_set: null이면 그대로, 값이면 바꿈
select public.split_line_set((select id from public.split_line where name = '식비'), 700000);
select is(pg_temp.cat('식비'), 'living', 'split_line_set 금액만: 묶음 그대로');
select public.split_line_set((select id from public.split_line where name = '헬스장'), null, null, 'family');
select is(pg_temp.cat('헬스장'), 'family', 'split_line_set: 묶음 바꿈');

-- 한도 20: 19줄까지 더 넣고(직접 추가 20줄), 21번째는 막힘
select lives_ok($$
  select public.split_line_add(pg_temp.split(auth.uid()), 'custom', 10000, '항목' || g, null, null, null)
  from generate_series(1, 15) g $$, '직접 추가 줄 20줄까지');
select is((select count(*)::int from public.split_line where kind = 'custom'), 20, '직접 추가 줄 20줄');
select throws_ok(
  $$ select public.split_line_add(pg_temp.split(auth.uid()), 'custom', 10000, '항목21') $$,
  '22023', 'too_many_custom', '21번째는 막힘');
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

-- 관리 형태 각자 → 합쳐서: 직접 추가 줄 묶음 보존(같은 이름은 바꾼 사람 것 먼저), 생활비 기본 줄은 living
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 3000000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'living', 'amount', 300000),
  jsonb_build_object('kind', 'allowance', 'amount', 300000),
  jsonb_build_object('kind', 'custom', 'name', '카페', 'amount', 50000)
));
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select public.set_salary_mode('joint');
select is((select category from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is null and l.kind = 'custom' and l.name = '월세'), 'housing', '합쳐서로 옮겨도 묶음 보존');
select is((select category from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is null and l.kind = 'custom' and l.name = '생활비'), 'living', '합친 생활비 줄(직접 추가 줄, 같은 이름끼리 더함)은 living');
select is((select amount from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is null and l.kind = 'custom' and l.name = '생활비'), 700000::bigint, '생활비 40만 + 30만');

select * from finish();
rollback;
