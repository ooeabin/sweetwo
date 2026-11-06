import { fetchAdminDashboard } from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { Icon } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { Frame } from '../frame';

// AD-01 대시보드(MVP: 상시 경보, 실패 건수, 미처리 문의). 경보가 없으면 영역 숨김.
// 경보는 지금 AD-19 평균 금리 90일 넘음만(성공 지표 3장 경보는 분석 도구 연결 뒤). 누르면 콘텐츠 › 계산·기준 데이터.
// 집계 실패면 칸 “—” + 마지막 집계 시각.
export function AD01Dashboard() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: fetchAdminDashboard });
  const v = (n: number | undefined) =>
    q.isError || n === undefined ? '—' : n.toLocaleString('ko-KR');
  return (
    <Frame menu="dashboard" title={copy.menus.dashboard}>
      {(q.data?.alerts.length ?? 0) > 0 && (
        <section className="hg-stack" style={{ gap: 'var(--space-2)' }} aria-label={copy.alerts}>
          {q.data?.alerts.map((x) => (
            <button
              key={x.kind}
              type="button"
              className="hg-admin__alert"
              onClick={() => nav('/content', { state: { tab: 'data' } })}
            >
              <Icon name="circle-alert" />
              <b>{copy.alertKinds[x.kind] ?? x.kind}</b>
              <span>{copy.alertValue(x.kind, x.value, x.limit)}</span>
              <Icon name="chevron-right" />
            </button>
          ))}
        </section>
      )}
      <div className="hg-admin__grid2">
        <section className="hg-card" aria-label={copy.failedJobs}>
          <span className="hg-card__label">{copy.failedJobs}</span>
          <div className="hg-admin__stats">
            <Stat
              label={copy.failedPlans}
              value={v(q.data?.failed.plans)}
              bad={!!q.data?.failed.plans}
            />
            <Stat
              label={copy.failedNotis}
              value={v(q.data?.failed.notifications)}
              bad={!!q.data?.failed.notifications}
            />
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

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={`hg-admin__stat${bad ? ' is-bad' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
