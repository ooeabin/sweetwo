import { fetchAdminDashboard } from '@sweetwo/api';
import { formatKstDateTime, formatMonthDay, type AdminDashboard } from '@sweetwo/core';
import { Button, DataTable, Icon, Status } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { canSee, Frame } from '../frame';
import { useAdmin } from '../gate';
import { PageSkel } from '../skel';
import { inquiryTone } from '../tones';
import { MetricsCards } from './ad-01-metrics';

// AD-01 대시보드. 1 상시 경보(없으면 숨김, 지금은 AD-19 평균 금리 90일 넘음만, 누르면 콘텐츠 › 계산·기준 데이터),
// 2 실패 건수, 3 미처리 문의, 4 회원 현황, 5 최근 7일 추이, 6 앱 버전, 7 최근 활동(2026-11-06), 8 지표 v2.2(ad-01-metrics.tsx).
// 집계 실패면 칸 “—” + 마지막 집계 시각. 최근 활동은 운영·CS·최고 관리자만(서버가 null로 줌).
// 누르는 곳(경보, 미처리 문의, 승인 대기)은 그 메뉴를 볼 수 있는 역할만 누름. 분석 역할은 숫자만(2026-11-12).
type Recent = NonNullable<AdminDashboard['recent']>;
type RecentInquiry = NonNullable<Recent['inquiries']>[number];
const TREND = ['joined', 'connected', 'checked'] as const;

export function AD01Dashboard() {
  const nav = useNavigate();
  const me = useAdmin();
  const toContent = canSee(me.roles, 'content');
  const toInquiries = canSee(me.roles, 'inquiries');
  const toSystem = canSee(me.roles, 'system');
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: fetchAdminDashboard });
  const d = q.data;
  const v = (n: number | undefined | null) =>
    q.isError || n === undefined || n === null ? '—' : n.toLocaleString('ko-KR');
  const recent = d?.recent;
  if (q.isLoading)
    return (
      <Frame menu="dashboard" title={copy.menus.dashboard}>
        <PageSkel shape="stats" />
      </Frame>
    );
  return (
    <Frame menu="dashboard" title={copy.menus.dashboard}>
      {(d?.alerts.length ?? 0) > 0 && (
        <section className="hg-stack" style={{ gap: 'var(--space-2)' }} aria-label={copy.alerts}>
          {d?.alerts.map((x) =>
            toContent ? (
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
            ) : (
              <div key={x.kind} className="hg-admin__alert" role="status">
                <Icon name="circle-alert" />
                <b>{copy.alertKinds[x.kind] ?? x.kind}</b>
                <span>{copy.alertValue(x.kind, x.value, x.limit)}</span>
              </div>
            ),
          )}
        </section>
      )}

      <section className="hg-card" aria-label={copy.membersTitle}>
        <span className="hg-card__label">{copy.membersTitle}</span>
        <div className="hg-admin__stats">
          <Stat label={copy.memberTotal} value={v(d?.members?.total)} />
          <Stat
            label={copy.joinedToday}
            value={v(d?.members?.joined_today)}
            sub={d?.members ? copy.vsYesterday(d.members.joined_yesterday) : undefined}
          />
          <Stat label={copy.connectedCouples} value={v(d?.members?.connected)} />
          <Stat label={copy.deletionToday} value={v(d?.members?.deletion_today)} />
        </div>
      </section>

      <div className="hg-admin__grid2">
        <section className="hg-card" aria-label={copy.failedJobs}>
          <span className="hg-card__label">{copy.failedJobs}</span>
          <div className="hg-admin__stats">
            <Stat label={copy.failedPlans} value={v(d?.failed.plans)} bad={!!d?.failed.plans} />
            <Stat
              label={copy.failedNotis}
              value={v(d?.failed.notifications)}
              bad={!!d?.failed.notifications}
            />
          </div>
        </section>
        <section
          className={toInquiries ? 'hg-card is-link' : 'hg-card'}
          aria-label={copy.openInquiries}
          {...(toInquiries && {
            role: 'link',
            tabIndex: 0,
            onClick: () => nav('/inquiries'),
            onKeyDown: (e: KeyboardEvent) => e.key === 'Enter' && nav('/inquiries'),
          })}
        >
          <span className="hg-card__label">{copy.openInquiries}</span>
          <div className="hg-admin__stats">
            <Stat label={copy.received} value={v(d?.inquiries.received)} />
            <Stat label={copy.inProgress} value={v(d?.inquiries.in_progress)} />
          </div>
        </section>
      </div>

      {d?.trend && <Trend trend={d.trend} />}

      {/* 8 지표 v2.2(북극성, 선행, 가드레일, 2026-11-13 PR 14) */}
      <MetricsCards />

      <div className="hg-admin__grid2">
        {d?.versions && (
          <section className="hg-card" aria-label={copy.versionsTitle}>
            <span className="hg-card__label">{copy.versionsTitle}</span>
            <div className="hg-admin__stats">
              <Stat
                label={copy.belowMin}
                value={v(d.versions.below_min)}
                bad={d.versions.below_min > 0}
              />
            </div>
            <DataTable<{ platform: string; version: string; devices: number }>
              label={copy.versionsTitle}
              rows={d.versions.top}
              rowKey={(r) => `${r.platform}-${r.version}`}
              empty={copy.none}
              columns={[
                {
                  key: 'p',
                  label: copy.versionCols.platform,
                  render: (r) => copy.platforms[r.platform] ?? r.platform,
                },
                { key: 'v', label: copy.versionCols.version, render: (r) => r.version },
                {
                  key: 'n',
                  label: copy.versionCols.devices,
                  num: true,
                  render: (r) => r.devices.toLocaleString('ko-KR'),
                },
              ]}
            />
          </section>
        )}
        {recent?.inquiries && (
          <section className="hg-card" aria-label={copy.recentTitle}>
            {recent.approvals !== null && toSystem && (
              <button
                type="button"
                className="hg-admin__alert is-quiet"
                onClick={() => nav('/system/approvals')}
              >
                <b>{copy.approvalsWaiting}</b>
                <span>{v(recent.approvals)}</span>
                <Icon name="chevron-right" />
              </button>
            )}
            <span className="hg-card__label">{copy.recentInquiries}</span>
            <DataTable<RecentInquiry>
              label={copy.recentInquiries}
              rows={recent.inquiries}
              rowKey={(r) => r.id}
              onRow={(r) => nav(`/inquiries/${r.id}`)}
              empty={copy.none}
              columns={[
                { key: 'no', label: copy.inqCols.no, render: (r) => r.no },
                {
                  key: 'c',
                  label: copy.inqCols.category,
                  render: (r) => copy.categories[r.category] ?? r.category,
                },
                {
                  key: 's',
                  label: copy.statusLabel,
                  render: (r) => (
                    <Status tone={inquiryTone[r.status] ?? 'off'}>
                      {copy.statuses[r.status] ?? r.status}
                    </Status>
                  ),
                },
                {
                  key: 't',
                  label: copy.inqCols.created,
                  render: (r) => formatKstDateTime(r.created_at),
                },
              ]}
            />
            {recent.audit && (
              <>
                <div className="hg-row" style={{ justifyContent: 'space-between' }}>
                  <span className="hg-card__label">{copy.recentAudit}</span>
                  <Button variant="link" size="sm" onClick={() => nav('/system/audit')}>
                    {copy.seeAll}
                  </Button>
                </div>
                {recent.audit.length === 0 ? (
                  <p className="hg-help">{copy.none}</p>
                ) : (
                  <ul className="hg-admin__log">
                    {recent.audit.map((l) => (
                      <li key={`${l.at}-${l.screen}`}>
                        <time>{formatKstDateTime(l.at)}</time>
                        <span>{l.admin_email ?? '—'}</span>
                        <span>
                          {copy.auditActions[l.action] ?? l.action} {l.screen}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {d && <p className="hg-help">{copy.aggregatedAt(formatKstDateTime(d.at))}</p>}
    </Frame>
  );
}

type TrendRow = NonNullable<AdminDashboard['trend']>[number];
function Trend({ trend }: { trend: TrendRow[] }) {
  return (
    <section className="hg-card" aria-label={copy.trendTitle}>
      <span className="hg-card__label">{copy.trendTitle}</span>
      <div className="hg-admin__trend">
        {TREND.map((k) => (
          <Bars
            key={k}
            label={copy.trendKinds[k] ?? k}
            days={trend.map((t) => ({ day: t.day, n: t[k] }))}
          />
        ))}
      </div>
      <details className="hg-admin__more">
        <summary>{copy.trendTable}</summary>
        <DataTable<TrendRow>
          label={copy.trendTable}
          empty={copy.noRows}
          rows={trend}
          rowKey={(t) => t.day}
          columns={[
            { key: 'day', label: copy.trendTitle, render: (t) => formatMonthDay(t.day) },
            ...TREND.map((k) => ({
              key: k,
              label: copy.trendKinds[k] ?? k,
              num: true,
              render: (t: TrendRow) => t[k].toLocaleString('ko-KR'),
            })),
          ]}
        />
      </details>
    </section>
  );
}

function Stat({
  label,
  value,
  bad,
  sub,
}: {
  label: string;
  value: string;
  bad?: boolean;
  sub?: string;
}) {
  return (
    <div className={`hg-admin__stat${bad ? ' is-bad' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

// 작은 막대 7개(한 계열, 한 색). 오늘 막대만 진하게, 나머지는 옅게. 값은 막대 위 title과 아래 표 보기.
function Bars({ label, days }: { label: string; days: { day: string; n: number }[] }) {
  const max = Math.max(1, ...days.map((x) => x.n));
  const last = days[days.length - 1];
  return (
    <figure className="hg-admin__bars" aria-label={label}>
      <figcaption>
        <span>{label}</span>
        <b>{(last?.n ?? 0).toLocaleString('ko-KR')}</b>
      </figcaption>
      <div className="hg-admin__bars-plot" aria-hidden="true">
        {days.map((x, i) => (
          <span
            key={x.day}
            className={i === days.length - 1 ? 'is-today' : undefined}
            title={`${formatMonthDay(x.day)} ${label} ${x.n.toLocaleString('ko-KR')}`}
            style={{ height: `${Math.max(2, Math.round((x.n / max) * 100))}%` }}
          />
        ))}
      </div>
      <div className="hg-admin__bars-x" aria-hidden="true">
        <span>{formatMonthDay(days[0]?.day ?? '')}</span>
        <span>{formatMonthDay(last?.day ?? '')}</span>
      </div>
    </figure>
  );
}
