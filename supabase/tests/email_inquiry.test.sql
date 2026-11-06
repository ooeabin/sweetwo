-- pgTAP: 이메일 문의(27 AD-06 예외 ‘이메일 정확히 일치로 회원 연결’, 29 고객 메일 수신). 찬우(회원), 관리자 cs01, 회원이 아닌 주소
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
insert into public.admin_user (id, email, name, roles) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr', 'cs01', array['cs']::public.admin_role[]);
create function pg_temp.login_as(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
-- 받은 메일 넣기(Edge Function 대신 소유자로 부름. 실행 권한은 아래 has_function_privilege로 확인)
create function pg_temp.ingest(p_from text, p_subject text, p_mid text, p_refs text[], p_body text, p_att integer default 0)
returns jsonb language sql as $$
  select public.ingest_inquiry_mail(p_from, p_subject, p_mid, p_refs, p_body, p_att);
$$;

-- 찬우: 가입 + 앱 문의
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select throws_ok($$ select public.ingest_inquiry_mail('x@example.com', '제목', 'm0@x', null, '본문', 0) $$,
  '42501', null, '사용자는 받은 메일을 못 넣음');
select set_config('test.app_no', public.create_inquiry('couple', '연결이 안 돼요', null), true);
reset role;
select ok(has_function_privilege('service_role', 'public.ingest_inquiry_mail(text, text, text, text[], text, integer)', 'execute')
  and not has_function_privilege('anon', 'public.ingest_inquiry_mail(text, text, text, text[], text, integer)', 'execute'),
  '받는 함수는 service_role만');
select is((select count(*)::int from public.mail_outbox
           where kind = 'inquiry_copy' and to_email = 'help@sweetwo.kr'
             and headers->>'X-Sweetwo-Copy' = current_setting('test.app_no')
             and subject = '[' || current_setting('test.app_no') || '] 앱 문의 사본'),
  1, '앱 문의는 help@로 사본(머리글 X-Sweetwo-Copy)');
select ok((select mail_copied_at is not null from public.inquiry where no = current_setting('test.app_no')), '사본 시각');

-- 앱 문의 사본이 전달돼 돌아옴 → 무시
select is(pg_temp.ingest('noti@sweetwo.kr', '[' || current_setting('test.app_no') || '] 앱 문의 사본', 'copy1@sweetwo.kr',
  null, '앱에서 온 문의예요')->>'result', 'ignored', '앱 문의 사본은 무시');
select is((select count(*)::int from public.inquiry), 1, '사본으로 문의가 늘지 않음');
select is((select count(*)::int from public.inquiry_message m join public.inquiry i on i.id = m.inquiry_id
           where i.no = current_setting('test.app_no')), 1, '앱 문의에도 덧붙지 않음');

-- 1) 회원 주소(대소문자만 다름) → 새 문의 + 회원 연결
select set_config('test.no', pg_temp.ingest('ChanWoo@Example.com', '연결 문의', 'm1@mail.example.com', null,
  '초대 코드가 안 보여요', 2)->>'no', true);
select results_eq(
  format($$ select user_id::text, space_id is not null, channel, email_from, email_subject, category::text, status::text
            from public.inquiry where no = %L $$, current_setting('test.no')),
  $$ values ('11111111-1111-1111-1111-111111111111', true, 'email', 'chanwoo@example.com', '연결 문의', 'etc', 'received') $$,
  '이메일 정확히 일치로 회원 연결');
select is(pg_temp.ingest('chanwoo@example.com', '연결 문의', 'm1@mail.example.com', null, '초대 코드가 안 보여요')->>'result',
  'duplicate', '같은 Message-ID는 한 번만');

-- 2) 회원이 아닌 주소 → 회원 없이
select set_config('test.no2', pg_temp.ingest('stranger@example.net', '가입 전 질문', 'n1@example.net', null, '요금이 있나요?')->>'no', true);
select ok((select user_id is null from public.inquiry where no = current_setting('test.no2')), '없으면 회원 없이');

-- 3) 같은 대화: References에 처음 메일 ID → 덧붙임
select is(pg_temp.ingest('chanwoo@example.com', 'Re: 연결 문의', 'm2@mail.example.com',
  array['m1@mail.example.com'], '한 번 더 해 봤어요')->>'result', 'appended', '답장은 같은 문의에 덧붙임');
select is((select count(*)::int from public.inquiry where channel = 'email'), 2, '새 문의가 생기지 않음');
select results_eq(
  format($$ select m.author, m.body from public.inquiry_message m join public.inquiry i on i.id = m.inquiry_id
            where i.no = %L order by m.created_at, m.id $$, current_setting('test.no')),
  $$ values ('user', '초대 코드가 안 보여요'), ('user', '한 번 더 해 봤어요') $$, '대화 순서');

-- 4) 제목의 문의 번호: 보낸 주소가 같으면 덧붙임, 다르면 새 문의
select is(pg_temp.ingest('chanwoo@example.com', '추가 [' || current_setting('test.no') || ']', 'm3@mail.example.com',
  null, '사진은 못 보냈어요')->>'result', 'appended', '제목의 문의 번호로 덧붙임');
select is(pg_temp.ingest('other@example.org', '[' || current_setting('test.no') || '] 끼어들기', 'o1@example.org',
  null, '다른 사람')->>'result', 'created', '다른 주소는 문의 번호가 있어도 새 문의');

-- 5) 관리자 답변 → help@에서 답장 메일(In-Reply-To, References, 제목 Re: … [문의 번호]), 앱 알림 없음
select set_config('test.qid', (select id::text from public.inquiry where no = current_setting('test.no')), true);
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
select public.admin_answer_inquiry(current_setting('test.qid')::uuid,
  '초대 코드를 다시 받아 주세요');
select is(public.admin_inquiry(current_setting('test.qid')::uuid)->'email'->>'from_masked',
  'cha***@example.com', '상세는 가린 주소');
select is((public.admin_inquiry(current_setting('test.qid')::uuid)->'email'->>'attachments')::int,
  2, '받지 않은 첨부 수');
reset role;
select results_eq(
  $$ select to_email, from_email, subject, headers->>'In-Reply-To', headers->>'References', body_text
     from public.mail_outbox where kind = 'inquiry_reply' $$,
  format($$ values ('chanwoo@example.com', 'sweeTwo <help@sweetwo.kr>', 'Re: 연결 문의 [%s]', '<m3@mail.example.com>',
    '<m3@mail.example.com>', '초대 코드를 다시 받아 주세요') $$, current_setting('test.no')),
  '이메일 문의 답변은 메일로(가장 최근 받은 메일에 답장)');
select is((select count(*)::int from public.notification where kind = 'inquiry_answered'), 0, '이메일 문의는 앱 알림 없음');
select is((select status::text from public.inquiry where no = current_setting('test.no')), 'waiting_user', '답변하면 사용자 답변 대기');

-- 6) 우리 답장에 대한 답장(SES Message-ID로) → 덧붙임 + 처리 중
update public.mail_outbox set message_id = 'ses-0001', sent_at = now() where kind = 'inquiry_reply';
select is(pg_temp.ingest('chanwoo@example.com', 'Re: 다른 제목', 'm4@mail.example.com',
  array['m3@mail.example.com', 'ses-0001@ap-northeast-2.amazonses.com'], '됐어요')->>'result', 'appended', '보낸 답장 ID로 이어짐');
select is((select status::text from public.inquiry where no = current_setting('test.no')), 'in_progress', '답변 대기 → 처리 중');

-- 7) 완료 뒤 7일 안이면 다시 열림, 넘으면 새 문의
update public.inquiry set status = 'done', done_at = now() - interval '1 day' where no = current_setting('test.no');
select is(pg_temp.ingest('chanwoo@example.com', 'Re: 연결 문의', 'm5@mail.example.com', array['m4@mail.example.com'], '또 안 돼요')->>'result',
  'appended', '완료 7일 안 재문의');
select is((select status::text from public.inquiry where no = current_setting('test.no')), 'received', '다시 열림');
update public.inquiry set status = 'done', done_at = now() - interval '8 days' where no = current_setting('test.no');
select isnt(pg_temp.ingest('chanwoo@example.com', 'Re: 연결 문의', 'm6@mail.example.com', array['m5@mail.example.com'], '오랜만이에요')->>'no',
  current_setting('test.no'), '7일 넘으면 새 문의');

-- 8) 앱 ‘내 문의’에는 이메일 문의가 안 보임
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.inquiry where channel = 'email'), 0, '이메일 문의는 앱에 안 보임');
reset role;

select * from finish();
rollback;
