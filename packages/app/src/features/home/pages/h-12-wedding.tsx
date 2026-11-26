import type { SavingNoteRow } from '@sweetwo/core';
import { HubTile } from '@sweetwo/ui';
import { copy } from '../copy';

/**
 * H-12 결혼 준비 타일(19 ‘홈 v2.2’ 6번): 결혼 준비 중일 때만 넓은 상자. “결혼 준비 메모 4개”(15/700) + 값 “다음 {이름} 12월 3일”(17/700, 2026-11-26 ‘홈 A안’)
 * (날짜가 지난 안 낸 메모가 있으면 “{이름}, 12월 3일이 지났어요”, 아니면 낼 날이 있는 안 낸 메모 중 가장 이른 것, 없으면 “+ 쓸 곳 메모 추가”, 저금이 하나도 없으면 메모를 붙일 곳이 없어 “+ 저축·투자 추가” → W-11a, 2026-11-25) + 72px 그림 자리. → W-14(대표 저금 또는 묶음의 메모)
 */
export function H12Wedding({
  notes,
  today,
  hasSaving,
  onClick,
}: {
  notes: readonly SavingNoteRow[];
  today: string;
  /** 쓸 곳 메모를 붙일 저금(또는 묶음)이 있는가. 없으면 메모를 만들 수 없어 보조 줄이 저축·투자 추가로 이름 붙음(2026-11-25) */
  hasSaving: boolean;
  onClick: () => void;
}) {
  const open = notes.filter((n) => !n.paid && !n.deleted_at);
  const dated = open
    .filter((n): n is SavingNoteRow & { due_on: string } => !!n.due_on)
    .sort((a, b) => (a.due_on < b.due_on ? -1 : 1));
  // 날짜가 지났는데 안 낸 메모는 사라지지 않고 먼저(2026-11-14), 없으면 가장 이른 다가오는 것
  const overdue = dated.find((n) => n.due_on < today);
  const next = dated.find((n) => n.due_on >= today);
  const title = copy.weddingTile(open.length);
  // 2026-11-26 ‘홈 A안’: 낼 날이 있는 메모(상태)는 값 줄 17/700, 추가 안내는 이동 글자 15/400 `ink-2`
  const due = overdue
    ? copy.weddingOverdue(overdue.name, overdue.due_on)
    : next
      ? copy.weddingNext(next.name, next.due_on)
      : null;
  const add = hasSaving ? copy.weddingAdd : copy.weddingAddSaving;
  const sub = due ?? add;
  return (
    <HubTile
      className="hg-hub__wide"
      title={title}
      value={due ?? undefined}
      sub={due ? undefined : add}
      hint
      art
      label={`${title}, ${sub}`}
      onClick={onClick}
    />
  );
}
