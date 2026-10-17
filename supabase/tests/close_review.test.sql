-- pgTAP: 월말 정리 미달·초과 처리 선택, 생활비 예산 보정 답(W-04g). 찬우
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', 0, false, true, '{}', '[]');
insert into public.month_close (space_id, plan_id) select u.space_id, p.id from public.app_user u, public.monthly_plan p;
select lives_ok($$ update public.month_close set gap_kind = 'short', gap_amount = 200000 $$, '미달 기록');
select lives_ok($$ update public.month_close set gap_choice = 'spread_3m' $$, '3개월에 나눠 채우기');
select throws_ok($$ update public.month_close set gap_choice = 'extra_goal' $$, '23514', null, '미달에는 더 넣을 목표 없음');
select throws_ok($$ update public.month_close set gap_kind = 'over', gap_choice = 'extra_goal' $$, '23514', null, '초과는 목표가 있어야');
select lives_ok($$ update public.month_close set budget_fix = 'kept' $$, '보정 제안 그대로 두기');
reset role;

select * from finish();
rollback;
