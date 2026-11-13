-- v2.2 PR 10: 바로잡기·냈어요 되돌리기(20 W-10b·W-10c·W-14 Toast ‘되돌리기’). 스키마는 추가만(함수만 더함).
--
-- ■ 계약
--  1. undo_saving_adjust(move): 내가 넣은 바로잡기 한 줄(reason_code fix/used/interest/reconcile/note_paid/custom,
--     돈 들어왔어요 나눠 넣기(money_in_id)와 자동 넣기(auto)는 아님)을 지움(deleted_at). 0원 아래로 내려가면 'below_zero'.
--     상대에게 간 한 줄(saving_adjusted:{move})도 지우고, 쓸 곳 메모 냈어요로 뺀 것이면 그 메모를 ‘안 냄’으로.
--     지운 뒤 달성·묶음 다시 판정(saving_after_change).
--  2. unpay_saving_note(note): 냈어요 되돌리기. 뺀 바로잡기가 있으면 1번처럼 지우고 paid = false.
--     고칠 수 있는 사람만(saving_note_editable).

create function public.undo_saving_adjust(p_move uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.goal_move;
begin
  select * into m from public.goal_move
    where id = p_move and created_by = auth.uid() and deleted_at is null and money_in_id is null
      and reason_code in ('fix', 'used', 'interest', 'reconcile', 'note_paid', 'custom')
    for update;
  if m.id is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if m.kind = 'in' and public.goal_saved(m.goal_id) - m.amount < 0 then
    raise exception 'below_zero' using errcode = '22023';
  end if;
  update public.goal_move set deleted_at = now() where id = m.id;
  delete from public.notification where dedupe = 'saving_adjusted:' || m.id::text;
  if m.note_id is not null then
    update public.saving_note set paid = false, paid_at = null, paid_move_id = null
      where id = m.note_id and paid_move_id = m.id;
  end if;
  perform public.saving_after_change(m.goal_id);
end;
$$;
revoke all on function public.undo_saving_adjust(uuid) from public, anon;
grant execute on function public.undo_saving_adjust(uuid) to authenticated;

create function public.unpay_saving_note(p_note uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n public.saving_note;
begin
  select * into n from public.saving_note where id = p_note and deleted_at is null for update;
  if n.id is null or not public.saving_note_editable(n.goal_id, n.bundle_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if not n.paid then
    return;
  end if;
  if n.paid_move_id is not null then
    perform public.undo_saving_adjust(n.paid_move_id);
  end if;
  update public.saving_note set paid = false, paid_at = null, paid_move_id = null where id = n.id;
end;
$$;
revoke all on function public.unpay_saving_note(uuid) from public, anon;
grant execute on function public.unpay_saving_note(uuid) to authenticated;
