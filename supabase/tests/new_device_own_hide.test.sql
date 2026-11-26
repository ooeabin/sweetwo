-- pgTAP: 새 기기 로그인 알림은 로그인한 그 기기(링크 세션 = 지금 세션)에서는 숨김(2026-11-26, 15 A-08 5번).
-- 목록·안 읽은 점(RLS)과 ‘모두 읽음’에서 빠지고, 다른 기기 세션에서는 그대로 보이고 읽음 처리됨
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into public.notification (id, user_id, kind, title, body, target, dedupe) values
  ('00000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'new_device',
    '새 기기에서 로그인했어요', '본인이 아니면 바로 로그아웃해 주세요',
    '/new-device/aaaaaaaa-0000-0000-0000-000000000002', 'login:aaaaaaaa-0000-0000-0000-000000000002'),
  ('00000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'care_day',
    '어머니 생신이 한 달 남았어요', null, '/calendar', 'test:care');

create function pg_temp.on_session(sid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated', 'session_id', sid)::text, true);
$$;

-- 로그인한 그 기기(세션 2): 새 기기 알림은 안 보이고, 다른 알림은 보임
select pg_temp.on_session('aaaaaaaa-0000-0000-0000-000000000002');
set local role authenticated;
select results_eq($$ select kind from public.notification order by kind $$, $$ values ('care_day') $$,
  '로그인한 그 기기: 새 기기 알림 안 보임');
select is((select count(*)::int from public.notification where read_at is null), 1,
  '로그인한 그 기기: 안 읽은 것도 새 기기 알림 빼고');
select is(public.mark_notifications_read(), 1, '로그인한 그 기기: 모두 읽음은 보이는 알림만');
select is(public.mark_notifications_read(array['00000000-0000-4000-8000-000000000001'::uuid]), 0,
  '로그인한 그 기기: 숨긴 알림은 id로도 읽음 처리 안 됨');
reset role;
select is((select read_at from public.notification where kind = 'new_device'), null,
  '다른 기기에서는 안 읽음 그대로');

-- 다른 기기(세션 1): 새 기기 알림이 보이고 읽음 처리됨
select pg_temp.on_session('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select results_eq($$ select kind from public.notification where read_at is null $$, $$ values ('new_device') $$,
  '다른 기기: 새 기기 알림 보임(안 읽음)');
select is(public.mark_notifications_read(), 1, '다른 기기: 모두 읽음에 들어감');
reset role;

-- session_id가 없는 토큰(옛 토큰·서비스 호출)은 숨기지 않음
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111',
  'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.notification), 2, 'session_id 없으면 모두 보임');
reset role;

select * from finish();
rollback;
