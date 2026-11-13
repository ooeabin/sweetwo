-- pgTAP: 체크리스트 줄 Realtime 발행(2026-11-11 QA 4구간 S4-02). 발행이 있는 환경(로컬·스테이징)에서만 확인
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select ok(
  not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  or exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pay_check_line'),
  'pay_check_line은 Realtime 발행에 있음'
);
-- 읽기 정책은 그대로(같은 공간만)
select policies_are('public', 'pay_check_line',
  array['pay_check_line_select', 'pay_check_line_insert', 'pay_check_line_update', 'pay_check_line_delete'],
  'pay_check_line 정책은 그대로');

select * from finish();
rollback;
