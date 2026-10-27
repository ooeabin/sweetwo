-- AD-02 내려받기(27 ‘AD-02 회원 검색’ 5번): L0 열만, 사유를 받은 뒤. 파일에 관리자 ID를 적고 감사 로그에 남김.
-- 화면이 지금 결과 표(L0)로 파일을 만들고, 서버는 사유·건수를 기록하고 파일에 적을 관리자 ID를 돌려줌.
create or replace function public.admin_note_export(p_screen text, p_reason text, p_rows integer)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
begin
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_screen not in ('AD-02') then
    raise exception 'bad_screen' using errcode = '22023';
  end if;
  perform public.admin_log(a, 'download', p_screen, null, left(btrim(p_reason), 200),
    jsonb_build_object('rows', greatest(coalesce(p_rows, 0), 0)));
  return a.email;
end;
$$;
revoke execute on function public.admin_note_export(text, text, integer) from public, anon;
grant execute on function public.admin_note_export(text, text, integer) to authenticated;
