-- 약관 개정 재동의(15 A-05 예외 “다음 실행 때 바뀐 필수 항목만 재동의”, 27 AD-15)와 마케팅 수신 2년마다 재확인(15 A-05 3번).
-- pending_terms(): 다시 물어볼 것. 이용약관·개인정보는 재동의가 필요한 승인 버전이 시행됐고(KST) 그 버전에 동의한 적이 없으며
-- 시행일 뒤에 가입(동의)하지도 않았을 때. 마케팅은 마지막 기록이 ‘받기’이고 2년이 지났을 때.
alter type public.consent_source add value if not exists 'reconsent';

create or replace function public.pending_terms()
returns table (kind text, version text)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (t.kind) t.kind, t.version, t.effective_on
    from public.terms_version t
    where t.status = 'approved' and t.reconsent
      and t.effective_on <= (now() at time zone 'Asia/Seoul')::date
    order by t.kind, t.effective_on desc, t.approved_at desc
  ), last_marketing as (
    select c.agreed, c.created_at from public.consent c
    where c.user_id = auth.uid() and c.kind = 'marketing'
    order by c.created_at desc limit 1
  )
  select l.kind, l.version from latest l
  where auth.uid() is not null
    and not exists (
      select 1 from public.consent c
      where c.user_id = auth.uid() and c.kind::text = l.kind and c.agreed
        and (c.terms_version = l.version or (c.created_at at time zone 'Asia/Seoul')::date >= l.effective_on))
  union all
  select 'marketing', '' from last_marketing m
  where m.agreed and m.created_at < now() - interval '2 years';
$$;
revoke execute on function public.pending_terms() from public, anon;
grant execute on function public.pending_terms() to authenticated;

-- 다시 동의: 남은 필수 항목 모두 + 마케팅(물어본 경우만, 받기·안 받기 모두 새 기록)
create or replace function public.agree_terms(p_marketing boolean default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n integer := 0;
  p record;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  for p in select * from public.pending_terms() loop
    if p.kind = 'marketing' then
      if p_marketing is null then
        continue;
      end if;
      insert into public.consent (user_id, kind, terms_version, agreed, source)
        values (uid, 'marketing', coalesce((select c.terms_version from public.consent c
          where c.user_id = uid and c.kind = 'terms' order by c.created_at desc limit 1), 'v1'), p_marketing, 'reconsent');
    else
      insert into public.consent (user_id, kind, terms_version, agreed, source)
        values (uid, p.kind::public.consent_kind, p.version, true, 'reconsent');
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.agree_terms(boolean) from public, anon;
grant execute on function public.agree_terms(boolean) to authenticated;
