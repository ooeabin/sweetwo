-- pgTAP: 체크리스트 완료(S-02). 부부 공유, 완료한 사람, 되돌리기, 직접 쓰기 막음. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

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
select set_config('test.code', (select code from public.create_invite()), true);
select public.set_checklist_done('insurance', true);
select is((select done_by::text from public.checklist_done where key = 'insurance'), '11111111-1111-1111-1111-111111111111', '완료한 사람');
select throws_ok($$ insert into public.checklist_done (space_id, key) select space_id, 'x-y' from public.app_user $$, '42501', null, '직접 쓰기는 막음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select is((select count(*) from public.checklist_done), 1::bigint, '배우자도 같은 완료를 봄');
select public.set_checklist_done('insurance', false);
select is((select count(*) from public.checklist_done), 0::bigint, '되돌리기');
select throws_ok($$ select public.set_checklist_done('Bad Key', true) $$, '22023', 'bad_key', '키 형식');
reset role;

select * from finish();
rollback;
