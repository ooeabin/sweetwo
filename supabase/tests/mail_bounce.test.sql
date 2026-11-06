-- pgTAP: 알림 메일 반송·수신 거부(14) — 반송 알림, 2번 반송이면 더 보내지 않음, 홈 띠
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', 'chanwoo@example.com', false, 'v1');
select public.ensure_my_space();
select is(public.my_mail_bounced(), false, '반송 전에는 띠 없음');
select throws_ok($$ select public.note_mail_event('chanwoo@example.com', 'bounce') $$, '42501', null,
  '앱에서는 부를 수 없음');
reset role;

select is(public.note_mail_event('Chanwoo@Example.com ', 'bounce'), 1, '반송: 그 주소 쓰는 사람에게 알림');
select is((select count(*)::int from public.notification where kind = 'mail_bounced' and mailed_at is not null), 1,
  '반송 알림은 메일로 다시 보내지 않음');
set local role authenticated;
select is(public.my_mail_bounced(), true, '홈 띠');
reset role;

-- 한 번 반송은 아직 보냄, 두 번이면 막힘
select ok(public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'test', null, '제목', '글', '<p>글</p>', false, 't1'),
  '한 번 반송은 아직 보냄');
select public.note_mail_event('chanwoo@example.com', 'bounce');
select ok(not public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'test', null, '제목', '글', '<p>글</p>', false, 't2'),
  '두 번 반송이면 쌓지 않음');

select * from finish();
rollback;
