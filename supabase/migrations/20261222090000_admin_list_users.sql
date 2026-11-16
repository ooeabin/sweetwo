-- AD-02 회원 목록(2026-11-16 사용자 결정): 검색 칸이 비어 있을 때 가입 최신순으로 한 쪽(기본 50명)씩 보여 줌.
-- admin_search와 같은 열·같은 가림(L0, 이메일 앞 3자). 쪽은 (가입 시각, 사용자 ID) 커서로 넘김.
-- 역할: 최고 관리자·운영·CS(33 2장 표). 분석은 못 봄. 쪽을 열 때마다 감사 로그(AD-17)에 남김.
-- 이 함수는 추가만 함(기존 admin_search 그대로).

create or replace function public.admin_list_users(
  p_limit integer default 50,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns table (user_id uuid, email_masked text, created_at timestamptz, couple_state text, subscription text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  perform public.admin_log(a, 'list', 'AD-02', null, null, jsonb_build_object('limit', lim,
    'paged', p_before_at is not null));
  return query
    select u.id, public.mask_email(au.email::text), u.created_at, s.couple_state::text, '무료'::text
    from public.app_user u
    join auth.users au on au.id = u.id
    left join public.couple_space s on s.id = u.space_id
    where p_before_at is null
       or (u.created_at, u.id) < (p_before_at, coalesce(p_before_id, '00000000-0000-0000-0000-000000000000'::uuid))
    order by u.created_at desc, u.id desc
    limit lim;
end;
$$;
revoke execute on function public.admin_list_users(integer, timestamptz, uuid) from public, anon;
grant execute on function public.admin_list_users(integer, timestamptz, uuid) to authenticated;
