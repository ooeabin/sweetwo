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
      <div className="hg-admin__grid2">
        <section className="hg-card" aria-label={copy.failedJobs}>
          <span className="hg-card__label">{copy.failedJobs}</span>
          <div className="hg-admin__stats">
            <Stat label={copy.failedPlans} value={v(q.data?.failed.plans)} />
            <Stat label={copy.failedNotis} value={v(q.data?.failed.notifications)} />
          </div>
        </section>
        <section
          className="hg-card is-link"
          aria-label={copy.openInquiries}
          role="link"
          tabIndex={0}
          onClick={() => nav('/inquiries')}
          onKeyDown={(e) => e.key === 'Enter' && nav('/inquiries')}
        >
          <span className="hg-card__label">{copy.openInquiries}</span>
          <div className="hg-admin__stats">
            <Stat label={copy.received} value={v(q.data?.inquiries.received)} />
            <Stat label={copy.inProgress} value={v(q.data?.inquiries.in_progress)} />
          </div>
        </section>
      </div>
      {q.data && <p className="hg-help">{copy.aggregatedAt(formatKstDateTime(q.data.at))}</p>}
    </Frame>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hg-admin__stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
