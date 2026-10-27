import { fetchActiveNotices, qk } from '@sweetwo/api';
import { Button, Icon } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { detectPlatform } from '../../platform';
import { copy } from './copy';

const KEY = 'sweetwo.notice-closed';
const closedIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

// 이번 달 상단 공지 띠(AD-10, 14 ‘공지·캠페인’, 13 점검 예고). 필독이 먼저, 한 번에 하나.
// ‘보기’로 내용을 펼치고, 일반 공지는 닫으면 이 기기에서 다시 안 보임(필독은 노출 기간 동안 늘 보임).
export function useNoticeBand() {
  const q = useQuery({
    queryKey: qk.notices,
    queryFn: () => fetchActiveNotices(detectPlatform()),
    staleTime: 10 * 60_000,
  });
  const [closed, setClosed] = useState(closedIds);
  const [open, setOpen] = useState(false);
  const list = (q.data ?? [])
    .filter((n) => n.importance === 'must' || !closed.includes(n.id))
    .sort((a, b) => (a.importance === b.importance ? 0 : a.importance === 'must' ? -1 : 1));
  const n = list[0];
  if (!n) return null;
  const close = () => {
    const next = [...closed, n.id];
    setClosed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(-50)));
    } catch {
      /* 저장소를 못 쓰면 이번 실행에서만 닫음 */
    }
  };
  return (
    <div className="hg-banner hg-banner--line hg-body__banner" role="status">
      <Icon name="info" size={16} />
      <span className="hg-stack" style={{ gap: 'var(--space-1)' }}>
        <strong className={open ? undefined : 'hg-banner__one'}>{n.title}</strong>
        {open && n.body && <span style={{ whiteSpace: 'pre-wrap' }}>{n.body}</span>}
      </span>
      {n.body && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? copy.noticeFold : copy.noticeOpen}
        </Button>
      )}
      {n.importance !== 'must' && (
        <Button variant="ghost" size="sm" onClick={close}>
          {copy.noticeClose}
        </Button>
      )}
    </div>
  );
}
