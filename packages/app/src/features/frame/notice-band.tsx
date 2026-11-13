import { fetchActiveNotices, qk } from '@sweetwo/api';
import { Button, Icon, type IconName } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { track } from '../../shared/analytics';
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

/** 홈 맨 위 공지 띠: 필독인지(맨 위 띠 순서, core pickTopBanner)와 그릴 띠 */
export interface NoticeBand {
  must: boolean;
  node: ReactNode;
}

// 홈 맨 위 공지 띠(AD-10, 14 ‘공지·캠페인’, 13 점검 예고). 필독이 먼저, 한 번에 하나.
// ‘보기’로 내용을 펼치고, 일반 공지는 닫으면 이 기기에서 다시 안 보임(필독은 노출 기간 동안 늘 보임).
// 제목은 두 줄까지, 넘치면 말줄임(2026-11-11 QA 4구간 D2, hg-banner__one). 맨 위 띠는 하나만이라 홈이 순서대로 고름(D3)
export function useNoticeBand(): NoticeBand | null {
  const q = useQuery({
    queryKey: qk.notices,
    // 대상 조건(우리 둘 상태, 앱 버전, 가입 주차)은 서버가 봄. 앱 버전은 브리지 값(웹은 없음)
    queryFn: () => fetchActiveNotices(detectPlatform(), window.sweetwo?.appVersion),
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
    track('home_banner_tapped', { banner: 'notice', action: 'close' });
    const next = [...closed, n.id];
    setClosed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(-50)));
    } catch {
      /* 저장소를 못 쓰면 이번 실행에서만 닫음 */
    }
  };
  const must = n.importance === 'must';
  const node = (
    <div className="hg-banner hg-banner--line hg-body__banner" role="status">
      <Icon name="info" size={16} />
      <span className="hg-stack" style={{ gap: 'var(--space-1)' }}>
        <strong className={open ? undefined : 'hg-banner__one'}>{n.title}</strong>
        {open && n.body && <span style={{ whiteSpace: 'pre-wrap' }}>{n.body}</span>}
      </span>
      {n.body && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!open)
              track('home_banner_tapped', {
                banner: must ? 'must_notice' : 'notice',
                action: 'open',
              });
            setOpen(!open);
          }}
          aria-expanded={open}
        >
          {open ? copy.noticeFold : copy.noticeOpen}
        </Button>
      )}
      {!must && (
        <Button variant="ghost" size="sm" onClick={close}>
          {copy.noticeClose}
        </Button>
      )}
    </div>
  );
  return { must, node };
}

/**
 * 회색 띠(2026-11-03, `hg-banner--info hg-banner--strip`): 해제 대기, 알림 메일 반송, 오프라인.
 * 좁은 창 흰 바탕 화면은 양옆 여백 없이 꽉 차게, 회색 바탕 화면(홈·자산 관리, hg-frame--alt)은 흰 상자와 같은 폭의 둥근 흰 판(2026-11-11 D1).
 * 보조 문장은 좁은 창에서 제목 아래 둘째 줄(해제 날짜 등), 제목과 보조 문장은 각각 두 줄까지(D2).
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
