-- pgTAP: 어드민 기본(AD-01~06·17). 찬우(사용자), 관리자 cs01(CS), 관리자 boss(최고), 사용자 K
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'k@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@sweetwo.kr');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('google-k', '33333333-3333-3333-3333-333333333333', '{}', 'google');
create function pg_temp.login_as(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

-- 찬우: 가입 + 문의
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select set_config('test.no', public.create_inquiry('couple', '연결이 안 돼요', null), true);
reset role;
select set_config('test.qid', (select id::text from public.inquiry), true);
insert into public.admin_user (email, name, roles) values
  ('cs01@sweetwo.kr', 'cs01', array['cs']::public.admin_role[]),
  ('boss@sweetwo.kr', '대표', array['super']::public.admin_role[]);

-- 관리자가 아니면 막힘
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'aal2');
set local role authenticated;
select throws_ok($$ select public.admin_me() $$, '42501', 'not_admin', '관리자가 아니면 안 됨');
select throws_ok($$ select public.admin_dashboard() $$, '42501', 'not_admin', '대시보드도 안 됨');
select throws_ok($$ select * from public.admin_audit $$, '42501', null, '감사 로그 직접 못 읽음');
reset role;

-- cs01: 처음 로그인하면 연결, 2단계 인증 전에는 막힘
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
set local role authenticated;
select is((public.admin_me()->>'mfa')::boolean, false, '첫 로그인 연결, 2단계 인증 전');
select throws_ok($$ select public.admin_dashboard() $$, '42501', 'mfa_required', '2단계 인증 필요');
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
select is((public.admin_dashboard()->'inquiries'->>'received')::int, 1, '미처리 문의 집계');
select results_eq($$ select email_masked, couple_state from public.admin_search('chanwoo@example.com') $$,
  $$ values ('cha***@example.com', 'not_joined') $$, '이메일 정확히 일치, 가림');
select is((select count(*)::int from public.admin_search('chanwoo')), 0, '부분 일치 없음');
select is((select count(*)::int from public.admin_search(current_setting('test.no'))), 1, '문의 번호로 찾기');
select is(public.admin_user_detail('11111111-1111-1111-1111-111111111111')->>'email_masked', 'cha***@example.com', '상세 L0');
select ok(not (public.admin_user_detail('11111111-1111-1111-1111-111111111111') ? 'monthly_income'), '상세에 금액 없음');
select throws_ok($$ select public.admin_reveal('11111111-1111-1111-1111-111111111111', '', 'A-1', array['email']) $$,
  '22023', 'reason_required', 'L1은 사유와 문의 번호');
select is(public.admin_reveal('11111111-1111-1111-1111-111111111111', '본인 확인', current_setting('test.no'), array['email'])->>'email',
  'chanwoo@example.com', 'L1 이메일 전체');
-- 문의 답변 → 사용자 답변 대기 + 알림
select public.admin_answer_inquiry(current_setting('test.qid')::uuid, '초대 코드를 다시 받아 주세요');
reset role;
select is((select status::text from public.inquiry), 'waiting_user', '답변하면 사용자 답변 대기');
select is((select count(*)::int from public.notification where kind = 'inquiry_answered'), 1, '답변 알림');
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
-- L2 요청 → 사용자 알림, 동의 전에는 못 봄
select set_config('test.access', public.admin_request_access(current_setting('test.qid')::uuid, array['income_spend'], false, '계산 확인')::text, true);
select throws_ok(format($$ select public.admin_access_data(%L) $$, current_setting('test.access')), '42501', 'not_allowed', '동의 전에는 못 봄');
reset role;
-- 찬우 동의 → cs01 구간으로 봄
update public.app_user set monthly_income = 3500000 where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.answer_access_request(current_setting('test.access')::uuid, true);
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
select is(public.admin_access_data(current_setting('test.access')::uuid)->'income_spend'->>'monthly_income', '300만~1,000만 원', '금액은 구간');
select results_eq($$ select array_agg(distinct action order by action) from public.admin_audit_rows() $$,
  $$ values (array['execute', 'request', 'reveal', 'search', 'view']) $$, '본인 기록(검색, 조회, 열람, 요청, 실행)');
reset role;

-- 최고 관리자는 L2 요청 못 함, 감사 로그 전체
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002', 'aal2');
set local role authenticated;
select public.admin_me();
select throws_ok($$ select public.admin_request_access(current_setting('test.qid')::uuid, array['goals'], false, 'x') $$,
  '42501', 'no_permission', '최고 관리자는 L2 직접 요청 안 함');
select is((select count(*)::int from public.admin_audit_rows()), (select count(*)::int from public.admin_audit_rows(p_admin => 'cs01@sweetwo.kr')), '최고 관리자는 다른 관리자 기록도');
reset role;

select * from finish();
rollback;
