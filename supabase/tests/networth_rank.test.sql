-- pgTAP: 우리 자산 순위(F-08, 계산·배분 7-7). 본인 행에 본 달, 상위 n%, 그때 순자산 저장. 범위 검사, 남의 행은 못 고침.
-- 연령대 비교용 파트너 출생연도(partner_birth_year): 같은 커플 공간의 파트너만
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select lives_ok($$ update public.app_user set rank_month = '2026-10-01', rank_pct = 93, rank_net = 16000000
  where id = '11111111-1111-1111-1111-111111111111' $$, '내 순위 저장');
select throws_ok($$ update public.app_user set rank_pct = 0 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, '상위 %는 1~99');
select throws_ok($$ update public.app_user set rank_month = '2026-10-15' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, '본 달은 그 달 1일');
update public.app_user set rank_pct = 50 where id = '22222222-2222-2222-2222-222222222222';
reset role;
select is((select rank_pct::int from public.app_user where id = '22222222-2222-2222-2222-222222222222'), null,
  '남의 행은 못 고침');
select is((select rank_pct::int from public.app_user where id = '11111111-1111-1111-1111-111111111111'), 93,
  '저장한 값');

-- 파트너 출생연도: 공간이 없으면 null, 합류하면 상대 값, 익명은 못 부름
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.partner_birth_year(), null, '파트너가 없으면 null');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', birth_year = 1993;
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.join_space(current_setting('test.code'));
select is(public.partner_birth_year()::int, 1993, '합류한 파트너의 출생연도');
reset role;

set local role anon;
select throws_ok($$ select public.partner_birth_year() $$, '42501', null, '익명은 못 부름');
reset role;

select * from finish();
rollback;
