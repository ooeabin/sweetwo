-- pgTAP: 휴지통(S-21)과 공개 범위 기본값(S-13). 찬우(시작), 예빈(합류)
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
update public.app_user set nickname = '찬우';
select is((select default_visibility::text from public.app_user), 'sum', '새 항목 기본값은 합계만');
select lives_ok($$ update public.app_user set default_visibility = 'private' $$, '기본값 바꾸기');
insert into public.goal (space_id, template, name, kind, priority) select space_id, 'travel', '여행', 'once', 1 from public.app_user;
insert into public.family_member (space_id, side, relation, title) select space_id, 'groom', 'parent', '어머니' from public.app_user;
insert into public.care_day (space_id, category, kind, name, member_id, side, date_rule, month, day, carer)
  select space_id, 'family', 'birthday', '어머니 생신', id, 'groom', 'solar_yearly', 5, 1, 'groom' from public.family_member;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  select space_id, 'asset', 'cash', 'bank', '청약 통장', 1000000, 'person', id from public.app_user;
-- 가족과 그 챙길 날을 같이 지움, 목표·자산도 지움
update public.family_member set deleted_at = now();
update public.care_day set deleted_at = now();
update public.goal set deleted_at = now();
update public.asset set deleted_at = now();
select results_eq($$ select kind from public.trash_rows() order by kind $$,
  $$ values ('asset'), ('family'), ('goal') $$, '휴지통: 같이 지운 챙길 날은 가족 줄로만');
select is(public.restore_trash('family', (select id from public.family_member)), 'restored', '가족 되살리기');
select is((select count(*)::int from public.care_day where deleted_at is null), 1, '같이 지운 챙길 날도 되살아남');
select is(public.restore_trash('goal', (select id from public.goal)), 'restored', '혼자면 목표도 바로 되살림');
select is(public.purge_trash('asset', (select id from public.asset)), 1, '영구 삭제');
select is((select count(*)::int from public.asset), 0, '자산이 사라짐');
select throws_ok($$ select public.purge_trash('asset', gen_random_uuid()) $$, 'P0001', 'not_found', '없는 항목');
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈';
select public.finish_join();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'cash', 'bank', '예빈 통장', 500000, 'person', id, 'all' from public.app_user;
update public.asset set deleted_at = now() where name = '예빈 통장';
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.trash_rows() where kind = 'asset'), 0, '배우자 명의는 내 휴지통에 없음');
update public.goal set deleted_at = now();
select is(public.restore_trash('goal', (select id from public.goal)), 'restored', '연결된 부부도 제안 없이 바로 되살림');
select is((select count(*)::int from public.goal where deleted_at is null), 1, '목표가 되살아남');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.purge_trash(), 1, '휴지통 비우기(예빈 통장)');
reset role;

select * from finish();
rollback;
