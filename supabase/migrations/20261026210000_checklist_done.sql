-- S-02 체크리스트 완료(25 S-02, 24 단계별 체크리스트): 부부 공유 완료 체크 + 완료한 사람. 완료는 이번 달 할 일에서만(앱이 지킴).
-- 항목 키 = packages/app/src/content/checklist.md의 ### 키.

create table public.checklist_done (
  space_id uuid not null references public.couple_space (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9-]{2,40}$'),
  done_by uuid references auth.users (id) on delete set null,
  done_at timestamptz not null default now(),
  primary key (space_id, key)
);

alter table public.checklist_done enable row level security;
create policy checklist_done_select on public.checklist_done for select to authenticated using (public.is_space_member(space_id));
create policy checklist_done_insert on public.checklist_done for insert to authenticated with check (false);
create policy checklist_done_update on public.checklist_done for update to authenticated using (false);
create policy checklist_done_delete on public.checklist_done for delete to authenticated using (false);
revoke insert, update, delete on public.checklist_done from authenticated, anon;

-- 완료 / 되돌리기
create or replace function public.set_checklist_done(p_key text, p_done boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid := (select space_id from public.app_user where id = auth.uid());
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_key !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'bad_key' using errcode = '22023';
  end if;
  if p_done then
    insert into public.checklist_done (space_id, key, done_by) values (sid, p_key, auth.uid())
      on conflict (space_id, key) do nothing;
  else
    delete from public.checklist_done where space_id = sid and key = p_key;
  end if;
end;
$$;
revoke all on function public.set_checklist_done(text, boolean) from public, anon;
grant execute on function public.set_checklist_done(text, boolean) to authenticated;
