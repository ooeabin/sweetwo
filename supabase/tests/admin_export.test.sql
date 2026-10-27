-- pgTAP: AD-02 내려받기(사유 필수, 감사 로그, 파일에 적을 관리자 ID)
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr');
insert into public.admin_user (email, name, roles) values ('cs01@sweetwo.kr', 'cs01', array['cs']::public.admin_role[]);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001',
  'role', 'authenticated', 'aal', 'aal2')::text, true);
set local role authenticated;
select public.admin_me();
select throws_ok($$ select public.admin_note_export('AD-02', ' ', 3) $$, '22023', 'reason_required', '사유가 없으면 안 됨');
select is(public.admin_note_export('AD-02', '문의 A-10234 확인', 3), 'cs01@sweetwo.kr', '파일에 적을 관리자 ID');
reset role;
select results_eq($$ select action, screen, reason, (detail->>'rows')::int from public.admin_audit where action = 'export' $$,
  $$ values ('export', 'AD-02', '문의 A-10234 확인', 3) $$, '감사 로그');

select * from finish();
rollback;
