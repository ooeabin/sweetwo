import type { SavingNoteRow } from '@sweetwo/core';
import { HubTile } from '@sweetwo/ui';
import { copy } from '../copy';

/**
 * H-12 결혼 준비 타일(19 ‘홈 v2.2’ 6번): 결혼 준비 중일 때만 넓은 상자. “결혼 준비 메모 4개” + 회색 “다음 {이름} 12월 3일”
 * (낼 날이 있는 안 낸 메모 중 가장 이른 것, 없으면 “+ 쓸 곳 메모 적기”) + 72px 그림 자리. → W-14(대표 저금 또는 묶음의 메모)
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
  const next = open
    .filter((n): n is SavingNoteRow & { due_on: string } => !!n.due_on && n.due_on >= today)
    .sort((a, b) => (a.due_on < b.due_on ? -1 : 1))[0];
  const title = copy.weddingTile(open.length);
  const sub = next ? copy.weddingNext(next.name, next.due_on) : copy.weddingAdd;
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
