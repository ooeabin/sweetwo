-- pgTAP: 공지 메일(약관·장애만, 게시 + 노출 시작 뒤 한 번, 상한 밖)
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_signup('kakao', 'chanwoo@example.com', false, 'v1');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_signup('kakao', 'yebin@example.com', false, 'v1');
reset role;

select throws_ok($$ insert into public.notice (kind, title, starts_at, ends_at, email)
  values ('info', '안내', now(), now() + interval '1 day', true) $$, '23514', null, '일반 공지는 메일 안 됨');
insert into public.notice (kind, title, body, starts_at, ends_at, status, email) values
  ('terms', '이용약관이 바뀌어요', '11월 1일부터 바뀌어요', '2026-10-20 01:00+00', '2026-11-30 00:00+00', 'published', true),
  ('incident', '아직 시작 안 함', '내일', '2026-10-28 01:00+00', '2026-11-30 00:00+00', 'published', true);
select is(public.send_notice_mails('2026-10-27 03:00+00'), 2, '시작한 공지만, 두 사람에게');
select is(public.send_notice_mails('2026-10-27 03:05+00'), 0, '한 번만');
select results_eq($$ select distinct kind, capped, subject from public.mail_outbox $$,
  $$ values ('notice_terms', false, '이용약관이 바뀌어요') $$, '상한 밖, 제목 = 공지 제목');

select * from finish();
rollback;
