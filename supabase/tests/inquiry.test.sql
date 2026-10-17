-- pgTAP: 문의(S-19a)와 관리자 열람 동의(S-19b). 찬우(문의), 예빈(배우자), 다른 사용자 K
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'k@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('google-k', '33333333-3333-3333-3333-333333333333', '{}', 'google');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우';
select set_config('test.code', (select code from public.create_invite()), true);
select ok(public.create_inquiry('couple', '연결이 안 돼요', '{"app_version":"1.0.0","os":"mac"}') ~ '^A-1[0-9]{4}$', '문의 번호 발급');
select throws_ok($$ select public.create_inquiry('etc', '금액', '{"amount":1000}') $$, '22023', 'bad_attach', '정해진 자동 첨부만');
select is((select count(*)::int from public.inquiry_message), 1, '첫 메시지');
select throws_ok($$ insert into public.inquiry (user_id, category, body) values (auth.uid(), 'etc', 'x') $$, '42501', null, '직접 못 넣음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈';
select public.finish_join();
select is((select count(*)::int from public.inquiry), 0, '배우자 문의는 안 보임');
reset role;

-- 운영자 답변(어드민 단계 흉내): 답변 대기
update public.inquiry set status = 'waiting_user';
insert into public.inquiry_message (inquiry_id, author, body) select id, 'admin', '확인해 볼게요' from public.inquiry;
-- 운영자 열람 요청
insert into public.access_request (inquiry_id, user_id, scope) select id, user_id, '{income_spend}' from public.inquiry;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.add_inquiry_message((select id from public.inquiry), '감사해요') $$, '덧붙이기');
select is((select status::text from public.inquiry), 'in_progress', '답변 대기 → 처리 중');
select lives_ok($$ select public.answer_access_request((select id from public.access_request), true) $$, '동의');
select ok((select expires_at between now() + interval '23 hours' and now() + interval '25 hours' from public.access_request), '24시간');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select title from public.notification where kind = 'access_partner'), '운영자가 찬우님 문의를 확인하고 있어요', '배우자 열람 알림');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.stop_access((select id from public.access_request)) $$, '지금 그만 보게 하기');
select is((select title from public.notification where kind = 'access_done'), '문의 확인이 끝났어요', '끝 알림');
reset role;

-- 완료 뒤 7일 지나면 덧붙이기 안 됨, 남은 요청은 만료
update public.inquiry set status = 'done', done_at = now() - interval '8 days';
insert into public.access_request (inquiry_id, user_id, scope) select id, user_id, '{goals}' from public.inquiry;
select public.run_access_expiry();
select is((select count(*)::int from public.access_request where status = 'expired'), 1, '완료된 문의의 요청 만료');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select public.add_inquiry_message((select id from public.inquiry), '또') $$, 'P0001', 'closed', '7일 지나면 닫힘');
reset role;

select * from finish();
rollback;
