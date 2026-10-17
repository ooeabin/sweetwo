-- pgTAP: 로그인된 기기(S-15). 찬우 세션 3개(지금 기기 1), 예빈 1개
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.sessions (id, user_id, user_agent, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sweeTwo/1.0 (Mac)', now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Mozilla/5.0 (Macintosh) Safari/605', now() - interval '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Chrome', now());
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated',
    'session_id', 'aaaaaaaa-0000-0000-0000-000000000001')::text, true);
set local role authenticated;
select is((select count(*)::int from public.my_sessions()), 3, '내 세션만');
select is((select count(*)::int from public.my_sessions() where current), 1, '지금 기기 표시');
select is(public.end_sessions('aaaaaaaa-0000-0000-0000-000000000002'), 1, '기기 하나 로그아웃');
select is(public.end_sessions('bbbbbbbb-0000-0000-0000-000000000001'), 0, '남의 세션은 못 지움');
select is(public.end_sessions(), 1, '이 기기 빼고 모두');
select results_eq($$ select id::text from public.my_sessions() $$, $$ values ('aaaaaaaa-0000-0000-0000-000000000001') $$, '지금 기기만 남음');
reset role;

select * from finish();
rollback;
