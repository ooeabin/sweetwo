-- pgTAP: 연결 해제 재기획(25 S-12, 08 7·8장). 요청 → 대기(월급 계획 고치기 멈춤) → 확인하면 같이 쓰던 데이터는 두 사람 모두 못 봄,
-- 새 공간에서 처음부터(v2.2 D5: 내 월급 계획·내 저금은 옮겨 남김). 다시 연결은 복구 없는 새 연결(D10). 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우: 목표, 월급 계획, 초대. 아직 미합류면 해제 요청 없음
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'home', '내 집 마련', 'once', 1 from public.app_user where id = auth.uid();
select public.save_split('[{"kind":"fixed","amount":880000}]', auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
select set_config('test.space', (select space_id::text from public.app_user where id = auth.uid()), true);
select throws_ok($$ select public.request_unlink('연결 해제') $$, '42501', 'not_connected', '미합류는 해제 요청 없음');
reset role;

-- 예빈 합류
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join('[{"kind":"fixed","amount":680000}]'::jsonb);
reset role;

-- 찬우 요청
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select public.request_unlink('연결해제') $$, 'P0001', 'confirm_mismatch', '“연결 해제”와 다르면 거절');
select lives_ok($$ select public.request_unlink('연결 해제') $$, '해제 요청');
select is((select couple_state::text from public.couple_space), 'unlink_pending', '해제 대기');
select throws_ok($$ select public.save_split('[{"kind":"fixed","amount":900000}]', auth.uid()) $$, '42501', 'unlink_pending',
  '대기 중엔 월급 계획 못 고침');
select throws_ok($$ select public.set_salary_mode('joint') $$, '42501', 'unlink_pending', '대기 중엔 관리 방식 못 바꿈');
-- 취소하면 연결로, 다시 요청
select lives_ok($$ select public.cancel_unlink() $$, '요청 취소');
select public.request_unlink('연결 해제');
reset role;
select is((select body from public.notification where kind = 'unlink_requested' order by created_at desc limit 1),
  public.md_label(public.kst_today() + 14) || '에 해제돼요. 먼저 내보낼 데이터가 있는지 확인해 주세요', '요청 알림 문구');

-- 예빈 ‘확인했어요’ → 둘 다 빈 새 공간, 같이 쓰던 목표·월급 계획은 안 보임
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.agree_unlink();
select isnt((select space_id::text from public.app_user where id = auth.uid()), current_setting('test.space'), '예빈 새 공간');
select is((select count(*) from public.goal where owner_user_id is null), 0::bigint, '같이 쓰던 저금은 안 보임');
select is((select onboarding_step from public.app_user where id = auth.uid()), 'S-12H', '해제 안내 먼저');
select public.start_after_unlink();
select is((select onboarding_step from public.app_user where id = auth.uid()), 'O-11', '시작하기 → O-11');
-- 해제 뒤 새로 만든 목표(다시 연결하면 버림)
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'travel', '혼자 여행', 'once', 1 from public.app_user where id = auth.uid();
reset role;
select is((select count(*) from public.notification where space_id = current_setting('test.space')::uuid), 0::bigint,
  '원래 공간 알림 기록 지움');

-- 다시 연결(v2.2 D10): 찬우 요청 → 예빈 수락 → 복구 없이 찬우 공간 새 초대 코드
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_reconnect();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select isnt(public.answer_reconnect(true), null, '수락하면 새 초대 코드');
select isnt((select space_id::text from public.app_user where id = auth.uid()), current_setting('test.space'), '원래 공간으로 돌아가지 않음');
select is((select array_agg(name order by name) from public.goal), array['혼자 여행'], '해제 뒤 내 저금은 그대로');
reset role;
select is((select couple_state::text from public.couple_space where id = current_setting('test.space')::uuid), 'solo', '원래 공간은 되살리지 않음');

select * from finish();
rollback;
