import { fetchAdminDashboard } from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { Frame } from '../frame';

// AD-01 대시보드(MVP: 실패 건수, 미처리 문의). 상시 경보는 지표 도구 연결 뒤(경보가 없으면 영역 숨김).
// 집계 실패면 칸 “—” + 마지막 집계 시각.
export function AD01Dashboard() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: fetchAdminDashboard });
  const v = (n: number | undefined) =>
    q.isError || n === undefined ? '—' : n.toLocaleString('ko-KR');
  return (
    <Frame menu="dashboard" title={copy.menus.dashboard}>
      <div className="hg-row" style={{ gap: 'var(--space-5)', alignItems: 'stretch' }}>
        <section className="hg-card hg-stack" aria-label={copy.failedJobs} style={{ flex: 1 }}>
          <span className="hg-card__label">{copy.failedJobs}</span>
          <div className="hg-row" style={{ justifyContent: 'space-between' }}>
            <span>{copy.failedPlans}</span>
            <b>{v(q.data?.failed.plans)}</b>
          </div>
          <div className="hg-row" style={{ justifyContent: 'space-between' }}>
            <span>{copy.failedNotis}</span>
            <b>{v(q.data?.failed.notifications)}</b>
          </div>
        </section>
        <section
          className="hg-card hg-stack"
          aria-label={copy.openInquiries}
          style={{ flex: 1, cursor: 'pointer' }}
          role="link"
          tabIndex={0}
          onClick={() => nav('/inquiries')}
          onKeyDown={(e) => e.key === 'Enter' && nav('/inquiries')}
        >
          <span className="hg-card__label">{copy.openInquiries}</span>
          <div className="hg-row" style={{ justifyContent: 'space-between' }}>
            <span>{copy.received}</span>
            <b>{v(q.data?.inquiries.received)}</b>
          </div>
          <div className="hg-row" style={{ justifyContent: 'space-between' }}>
            <span>{copy.inProgress}</span>
            <b>{v(q.data?.inquiries.in_progress)}</b>
          </div>
        </section>
      </div>
      {q.data && <p className="hg-help">{copy.aggregatedAt(formatKstDateTime(q.data.at))}</p>}
    </Frame>
  );
}
