import { fetchActiveNotices, fetchNoticeHistory, qk } from '@sweetwo/api';
import { Button, Icon, type IconName } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
// ‘보기’는 앱 안 공지 화면 N-04(그 공지가 펼쳐진 채)로 가고, 일반 공지는 닫으면 이 기기에서 다시 안 보임(필독은 노출 기간 동안 늘 보임).
// 제목은 두 줄까지, 넘치면 말줄임(2026-11-11 QA 4구간 D2, hg-banner__one). 맨 위 띠는 하나만이라 홈이 순서대로 고름(D3)
const noticesQuery = {
  queryKey: qk.notices,
  // 대상 조건(우리 둘 상태, 앱 버전, 가입 주차)은 서버가 봄. 앱 버전은 브리지 값(웹은 없음)
  queryFn: () => fetchActiveNotices(detectPlatform(), window.sweetwo?.appVersion),
  staleTime: 10 * 60_000,
};

// 앱 안 공지 화면 N-04(2026-11-16): 노출 중인 공지 + 끝난 지 90일 안 지난 공지(20개까지). 대상 조건은 서버가 봄
const historyQuery = {
  queryKey: qk.noticeHistory,
  queryFn: () => fetchNoticeHistory(detectPlatform(), window.sweetwo?.appVersion),
  staleTime: 10 * 60_000,
};

/** N-04 공지 목록(들어올 때마다 다시 받음) */
export function useNoticeHistory(fresh = false) {
  return useQuery({ ...historyQuery, ...(fresh ? { staleTime: 0 } : {}) });
}

// 읽은 공지(이 기기, 닫은 공지와 같이 기기 설정. 공지 id는 모두에게 같아서 로그아웃해도 남김)
const READ_KEY = 'sweetwo.notice-read';
const readListeners = new Set<() => void>();
let readCache: { raw: string; ids: string[] } = { raw: '', ids: [] };
const readSnapshot = (): string[] => {
  let raw = '';
  try {
    raw = localStorage.getItem(READ_KEY) ?? '';
  } catch {
    /* 저장소를 못 쓰면 이번 실행에서만 */
  }
  if (raw !== readCache.raw) {
    let ids: string[] = [];
    try {
      ids = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      ids = [];
    }
    readCache = { raw, ids };
  }
  return readCache.ids;
};
/** 공지를 읽음으로(펼침). 서랍 ‘공지’ 줄의 새 알림 점이 꺼짐 */
export function markNoticeRead(id: string) {
  const ids = readSnapshot();
  if (ids.includes(id)) return;
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids, id].slice(-100)));
  } catch {
    readCache = { raw: '\0', ids: [...ids, id] };
  }
  readListeners.forEach((f) => f());
}
export function useReadNotices(): string[] {
  return useSyncExternalStore(
    (f) => {
      readListeners.add(f);
      return () => readListeners.delete(f);
    },
    readSnapshot,
    () => [],
  );
}

/**
 * 서랍 ‘공지’ 줄(2026-11-16): 보여 줄 공지(노출 중이거나 끝난 지 90일 안)가 하나라도 있으면 줄이 보이고,
 * 노출 중인데 안 읽은 공지가 있으면 새 알림 점. 서랍을 열었을 때만 불러옴
 */
export function useNoticeMenu(enabled: boolean): { show: boolean; unread: boolean } {
  const q = useQuery({ ...historyQuery, enabled });
  const read = useReadNotices();
  const list = q.data ?? [];
  return {
    show: list.length > 0,
    unread: list.some((n) => n.active && !read.includes(n.id)),
  };
}

export function useNoticeBand(): NoticeBand | null {
  const q = useQuery(noticesQuery);
  const [closed, setClosed] = useState(closedIds);
  const nav = useNavigate();
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
    <div className="hg-banner hg-banner--line hg-banner--notice hg-body__banner" role="status">
      <Icon name="info" size={16} />
      <span className="hg-stack" style={{ gap: 'var(--space-1)' }}>
        <strong className="hg-banner__one">{n.title}</strong>
      </span>
      {n.body && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            track('home_banner_tapped', {
              banner: must ? 'must_notice' : 'notice',
              action: 'open',
            });
            // 공지 화면 N-04에서 그 공지가 펼쳐진 채로 열림(2026-11-16)
            nav(`/notices?open=${encodeURIComponent(n.id)}`);
          }}
        >
          {copy.noticeOpen}
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
