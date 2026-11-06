-- pgTAP: 약관 개정 재동의, 마케팅 2년 재확인(15 A-05)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, true, 'v1');
select is((select count(*)::int from public.pending_terms()), 0, '가입 직후 다시 물을 것 없음');
reset role;

-- 가입은 작년, 이용약관 v2(재동의 필요)가 어제부터 시행
update public.consent set created_at = now() - interval '1 year';
insert into public.terms_version (kind, version, effective_on, reconsent, status, approved_at) values
  ('terms', 'v2', (now() at time zone 'Asia/Seoul')::date - 1, true, 'approved', now()),
  ('privacy', 'v2', (now() at time zone 'Asia/Seoul')::date + 7, true, 'approved', now());
set local role authenticated;
select results_eq($$ select kind, version from public.pending_terms() $$,
  $$ values ('terms', 'v2') $$, '시행된 이용약관만(개인정보는 아직 시행 전)');
select is(public.agree_terms(), 1, '다시 동의');
select is((select count(*)::int from public.pending_terms()), 0, '동의하면 없음');
reset role;

-- 마케팅 받기 동의가 2년 지남
update public.consent set created_at = now() - interval '25 months' where kind = 'marketing';
set local role authenticated;
select results_eq($$ select kind from public.pending_terms() $$, $$ values ('marketing') $$, '마케팅 재확인');
select public.agree_terms(false);
select is((select count(*)::int from public.pending_terms()), 0, '안 받기로 답하면 없음');
reset role;

select * from finish();
rollback;
