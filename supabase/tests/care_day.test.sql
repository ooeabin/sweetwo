-- pgTAP: 챙길 날. 같은 공간은 함께 보고 고침, 다른 부부는 못 봄, 영구 삭제 없음
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select lives_ok($$
  insert into public.care_day (space_id, category, kind, name, side, date_rule, month, day, budget, carer)
  select space_id, 'family', 'birthday', '어머니 생신', 'groom', 'lunar_yearly', 8, 3, 300000, 'groom'
  from public.app_user $$, '챙길 날 추가');
select throws_ok($$ delete from public.care_day $$, '42501', null, '영구 삭제 없음');
select throws_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule)
  select space_id, 'family', 'event', '돌잔치', 'once' from public.app_user $$,
  '23514', null, '한 번은 날짜가 있어야 함');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is((select count(*)::int from public.care_day), 0, '다른 부부는 못 봄');
reset role;

select * from finish();
rollback;
