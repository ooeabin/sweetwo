-- pgTAP: N-04 공지 목록 my_notice_history: 노출 중 + 끝난 지 90일 안 지난 공지, 20개까지, 대상 조건은 my_notices와 같음.
-- 찬우(연결, 데스크톱 1.2.0), 3번(혼자 쓰기)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'solo@example.com');
insert into public.couple_space (id, couple_state) values
  ('dddddddd-0000-0000-0000-000000000001', 'connected'),
  ('dddddddd-0000-0000-0000-000000000002', 'solo');
insert into public.app_user (id, provider, notify_email, notify_email_source, space_id, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'kakao', 'chanwoo@example.com', 'provider', 'dddddddd-0000-0000-0000-000000000001', now() - interval '300 days'),
  ('33333333-3333-3333-3333-333333333333', 'kakao', 'solo@example.com', 'provider', 'dddddddd-0000-0000-0000-000000000002', now() - interval '300 days');
insert into public.notice (id, kind, title, starts_at, ends_at, status, target) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'info', '지금 공지', now() - interval '1 day', now() + interval '1 day', 'published', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'info', '지난 공지', now() - interval '20 days', now() - interval '10 days', 'published', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'info', '오래전 공지', now() - interval '200 days', now() - interval '190 days', 'published', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'info', '앞으로 공지', now() + interval '1 day', now() + interval '2 days', 'published', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'info', '쓰다 만 공지', now() - interval '1 day', now() + interval '1 day', 'draft', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'info', '혼자 쓰기만(지난)', now() - interval '30 days', now() - interval '5 days', 'published', '{"couple_states":["solo"]}');

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select array_agg(x ->> 'title') from jsonb_array_elements(public.my_notice_history('ios', '1.5.0')) x),
  array['지금 공지', '지난 공지'], '노출 중 + 지난 공지만, 최근 시작 순. 오래전·앞으로·쓰다 만·다른 대상 공지는 안 보임');
select is((select array_agg((x ->> 'active')::boolean order by x ->> 'title') from jsonb_array_elements(public.my_notice_history('ios', '1.5.0')) x),
  array[true, false], '지금 공지는 active, 지난 공지는 아님');
select is((select array_agg(x ->> 'title') from jsonb_array_elements(public.my_notices('ios', '1.5.0')) x),
  array['지금 공지'], '홈 띠용 my_notices는 그대로 노출 중인 것만');
select throws_ok($$ select public.my_notice_history('toaster') $$, '22023', null, '모르는 플랫폼은 안 됨');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select array_agg(x ->> 'title') from jsonb_array_elements(public.my_notice_history('android', null)) x),
  array['지금 공지', '지난 공지', '혼자 쓰기만(지난)'], '혼자 쓰기 대상의 지난 공지도 대상이면 보임');
reset role;

-- 20개까지
insert into public.notice (kind, title, starts_at, ends_at, status)
select 'info', '많은 공지 ' || g, now() - (g || ' hours')::interval, now() + interval '1 day', 'published'
from generate_series(1, 25) g;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select is(jsonb_array_length(public.my_notice_history('ios', null)), 20, '최대 20개');
reset role;
set local role anon;
select throws_ok($$ select public.my_notice_history('ios') $$, '42501', null, '로그인 안 하면 안 됨');
reset role;

select * from finish();
rollback;
