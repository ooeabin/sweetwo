import { formatDateFull, formatMonthDay, kstDateOf, todayKst } from '@sweetwo/core';
import { Accordion, Button, EmptyState, PageHeader, SkelRows, useDelayed } from '@sweetwo/ui';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { markNoticeRead, MainFrame, useNoticeHistory, useReadNotices } from '../../frame';
import { copy } from '../copy';

// N-04 공지(docs/spec/14-notifications.md, 2026-11-16 사용자 결정): 메뉴 서랍 ‘공지’와 홈 공지 띠 ‘보기’가 들어오는 앱 안 공지 화면.
// 지금 노출 중인 공지와 끝난 지 90일 안 지난 공지를 최근 시작 순으로, 줄 = 제목 + 날짜. 누르면 같은 화면에서 본문이 펼쳐지고
// (펼치면 읽음, 서랍 ‘공지’ 줄 새 알림 점이 꺼짐) 공지 띠에서 들어오면(`?open=공지 id`) 그 공지가 펼쳐진 채로 열림.
// 어떤 공지가 나에게 보이는지는 서버가 정함(대상 조건). 빈 상태는 문구만(할 일 버튼 없음).
const dateOf = (iso: string): string => {
  const d = kstDateOf(iso);
  return d.slice(0, 4) === todayKst().slice(0, 4) ? formatMonthDay(d) : formatDateFull(d);
};

export function N04Notices() {
  const nav = useNavigate();
  const loc = useLocation();
  const [sp] = useSearchParams();
  const openId = sp.get('open') ?? undefined;
  const q = useNoticeHistory(true);
  const read = useReadNotices();
  const slow = useDelayed();
  const list = useMemo(() => q.data ?? [], [q.data]);
  const target = openId && list.some((n) => n.id === openId) ? openId : undefined;
  // 띠에서 들어온 공지는 펼쳐 보이므로 읽음
  useEffect(() => {
    if (target) markNoticeRead(target);
  }, [target]);
  useEffect(() => {
    if (q.isSuccess) track('notice_list_viewed', { count: list.length });
  }, [q.isSuccess, list.length]);
  // ‹ = 온 곳으로. 앱 안에서 이 화면이 첫 기록이면(바로 열림) 홈으로
  const goBack = () => (loc.key !== 'default' ? nav(-1) : nav('/'));
  const items = list.map((n) => ({
    id: n.id,
    q: n.title,
    sub: n.active ? dateOf(n.starts_at) : `${dateOf(n.starts_at)} (${copy.noticesEnded})`,
    unread: n.active && !read.includes(n.id) && n.id !== target,
    a: <span style={{ whiteSpace: 'pre-wrap' }}>{n.body || copy.noticesNoBody}</span>,
  }));
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.noticesTitle} backLabel={copy.back} onBack={goBack} />
      {q.isLoading ? (
        slow ? (
          <SkelRows rows={[[56], [56], [56]]} />
        ) : null
      ) : q.isError ? (
        <EmptyState
          title={copy.noticesLoadFailed}
          action={
            <Button variant="secondary" onClick={() => void q.refetch()}>
              {copy.retry}
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState list title={copy.noticesEmpty} />
      ) : (
        <Accordion
          // 공지 띠에서 들어온 공지가 바뀌면 다시 그려 펼침
          key={target ?? 'none'}
          items={items}
          initialOpen={target}
          unreadLabel={copy.noticesNew}
          onOpen={(id) => {
            const n = list.find((x) => x.id === id);
            markNoticeRead(id);
            track('notice_opened', {
              kind: n?.kind ?? 'unknown',
              importance: n?.importance ?? 'normal',
              active: !!n?.active,
              from: 'list',
            });
          }}
        />
      )}
    </div>
  );
  return (
    <MainFrame sub="settings" current={null} narrowTitle={copy.noticesTitle} columns={[body]} />
  );
}
