-- pgTAP: 데스크톱 앱 받기 링크 메일(18 ‘합류 뒤’) — 알림 이메일로, 상한 밖, 하루 한 번
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222',
  'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_signup('kakao', 'yebin@example.com', false, 'v1');
select is(public.send_desktop_link(), true, '쌓음');
select is(public.send_desktop_link(), false, '같은 날 다시 누르면 안 쌓음');
reset role;
select results_eq($$ select to_email, capped, body_text like '%https://sweetwo.kr/download%' from public.mail_outbox $$,
  $$ values ('yebin@example.com', false, true) $$, '알림 이메일로, 상한 밖, L-02 주소');

select * from finish();
rollback;
