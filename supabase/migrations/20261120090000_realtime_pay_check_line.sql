-- 체크리스트 줄 Realtime(19 H-03, 20 W-02, 2026-11-11 QA 4구간 S4-02).
-- 합쳐서 모드에서 상대가 공동 체크리스트를 체크하면 홈 큰 상자·W-02가 바로 바뀌게 pay_check_line 변경을 Realtime으로 냄.
-- 앱은 space_id로 걸러 구독(api subscribeCheckLines)하고, 신호를 받으면 체크리스트·모은 금액을 다시 읽음.
-- 읽기 권한은 기존 RLS(pay_check_line_select: 같은 공간만) 그대로. 테이블·정책은 바꾸지 않음(발행에 더하기만).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pay_check_line') then
    alter publication supabase_realtime add table public.pay_check_line;
  end if;
end;
$$;
