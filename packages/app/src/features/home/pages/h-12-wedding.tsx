import type { SavingNoteRow } from '@sweetwo/core';
import { HubTile } from '@sweetwo/ui';
import { copy } from '../copy';

/**
 * H-12 결혼 준비 타일(19 ‘홈 v2.2’ 6번): 결혼 준비 중일 때만 넓은 상자. “결혼 준비 메모 4개” + 회색 “다음 {이름} 12월 3일”
 * (날짜가 지난 안 낸 메모가 있으면 “{이름} 12월 3일 지났어요”, 아니면 낼 날이 있는 안 낸 메모 중 가장 이른 것, 없으면 “+ 쓸 곳 메모 적기”) + 72px 그림 자리. → W-14(대표 저금 또는 묶음의 메모)
 */
export function H12Wedding({
  notes,
  today,
  onClick,
}: {
  notes: readonly SavingNoteRow[];
  today: string;
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
  const sub = overdue
    ? copy.weddingOverdue(overdue.name, overdue.due_on)
    : next
      ? copy.weddingNext(next.name, next.due_on)
      : copy.weddingAdd;
  return (
    <HubTile
      className="hg-hub__wide"
      title={title}
      sub={sub}
      art
      label={`${title}, ${sub}`}
      onClick={onClick}
    />
  );
}
