-- N-04 공지 화면(앱 안 공지 목록, 2026-11-16 사용자 결정): 지금 노출 중인 공지 + 지난 공지(끝난 지 90일 안, 모두 합해 20개까지).
-- 대상 조건(커플 상태, 앱 버전, 가입 주차, 플랫폼)은 my_notices와 같은 notice_user_match로 봄: 나에게 보인 적 없는 공지는 안 보임.
-- 추가만(my_notices와 notice 정책은 그대로). 앱 홈 띠는 계속 my_notices(노출 중인 것만).
-- [{id, kind, title, body, importance, platforms, starts_at, ends_at, active}] 최근 시작 순
create or replace function public.my_notice_history(p_platform text, p_version text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_platform not in ('desktop', 'ios', 'android', 'web') then
    raise exception 'bad_platform' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.starts_at desc)
    from (
      select n.starts_at,
        jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
          'importance', n.importance, 'platforms', to_jsonb(n.platforms),
          'starts_at', n.starts_at, 'ends_at', n.ends_at, 'active', n.ends_at >= now()) as j
      from public.notice n
      where n.status = 'published' and n.starts_at <= now()
        and n.ends_at >= now() - interval '90 days'
        and public.notice_user_match(uid, n.target, n.platforms, p_platform, p_version)
      order by n.starts_at desc
      limit 20
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.my_notice_history(text, text) from public, anon;
grant execute on function public.my_notice_history(text, text) to authenticated;
