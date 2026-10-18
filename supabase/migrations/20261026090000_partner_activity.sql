-- H-08 배우자 활동(19 이번 달 9번, 30 동기화 7장). 최근 90일 동안 상대가 한 일 중 최근 n건.
-- 출처: 상대가 일으켜 나에게 온 알림, 상대가 끝낸 월급 나누기 줄, 상대가 추가하거나 바꾼 자산·부채.
-- 공개 범위: ‘합계만’ 상대 명의 항목은 이름 없이(앱이 “개인 자산 금액이 바뀌었어요”), ‘비공개’는 빼고.
-- 부부가 연결돼 있을 때만(미합류, 혼자 쓰기, 해제 뒤에는 빈 목록).

create or replace function public.partner_activity(p_limit int default 5)
returns table (at timestamptz, kind text, name text, ref text, target text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select u.id, u.space_id
    from public.app_user u
    join public.couple_space s on s.id = u.space_id
    where u.id = auth.uid() and s.couple_state in ('connected', 'unlink_pending')
  ),
  p as (
    select u.id from public.app_user u, me where u.space_id = me.space_id and u.id <> me.id
  ),
  x as (
    -- 상대가 일으킨 알림(제목이 곧 문구)
    select n.created_at as at, 'notice'::text as kind, n.title as name, n.id::text as ref, n.target
    from public.notification n, me, p
    where n.user_id = me.id and n.actor_id = p.id
    union all
    -- 월급 나누기 줄 끝냄(알림 없이 활동에만)
    select l.groom_done_at, 'split_done', coalesce(l.account_role::text, l.kind::text), l.id::text, '/plan/split'
    from public.plan_line l, me, p
    where l.space_id = me.space_id and l.groom_done_by = p.id and l.groom_done_at is not null
      and l.deleted_at is null
    union all
    select l.bride_done_at, 'split_done', coalesce(l.account_role::text, l.kind::text), l.id::text, '/plan/split'
    from public.plan_line l, me, p
    where l.space_id = me.space_id and l.bride_done_by = p.id and l.bride_done_at is not null
      and l.deleted_at is null
    union all
    -- 자산·부채 추가, 금액 바꿈
    select a.updated_at,
      case when a.version <= 1 then 'asset_added' else 'asset_changed' end,
      case when a.owner = 'person' and a.owner_user_id = p.id and a.visibility = 'sum' then null else a.name end,
      a.id::text,
      case when a.owner = 'person' and a.owner_user_id = p.id and a.visibility = 'sum'
        then '/assets' else '/assets/' || a.id::text end
    from public.asset a, me, p
    where a.space_id = me.space_id and a.updated_by = p.id and a.deleted_at is null
      and a.visibility <> 'private'
  )
  select x.at, x.kind, x.name, x.ref, x.target
  from x
  where x.at > now() - interval '90 days'
  order by x.at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.partner_activity(int) from public, anon;
grant execute on function public.partner_activity(int) to authenticated;
