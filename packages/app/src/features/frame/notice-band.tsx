import { fetchActiveNotices, qk } from '@sweetwo/api';
import { Button, Icon, type IconName } from '@sweetwo/ui';
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

/**
 * 회색 한 줄 띠(2026-11-03, `hg-banner--info hg-banner--strip`): 해제 대기, 알림 메일 반송, 오프라인, PC 안내.
 * 좁은 창은 할 일·공지 띠처럼 한 줄 높이로 양옆 여백 없이 꽉 차게, 굵은 제목만(보조 문장은 넓은 창에서만).
 */
export function LineBand({
  icon,
  title,
  sub,
  action,
  close,
  body = true,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
  close?: { label: string; onClick: () => void };
  /** 본문 맨 위 띠 자리(hg-body__banner). 앱 틀 위쪽 띠(오프라인)는 false */
  body?: boolean;
}) {
  return (
    <div
      className={
        body
          ? 'hg-banner hg-banner--info hg-banner--strip hg-body__banner'
          : 'hg-banner hg-banner--info hg-banner--strip'
      }
      role="status"
    >
      <Icon name={icon} size={16} />
      <span className="hg-banner__one">
        <strong>{title}</strong>
        {sub && <span className="hg-banner__sub"> {sub}</span>}
      </span>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {close && (
        <Button variant="ghost" size="sm" onClick={close.onClick}>
          {close.label}
        </Button>
      )}
    </div>
  );
}
