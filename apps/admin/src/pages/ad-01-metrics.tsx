import { fetchAdminMetrics } from '@sweetwo/api';
import type { AdminMetrics, MetricRatio } from '@sweetwo/core';
import { DataTable, Status } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { copy } from '../copy';

// AD-01 8번 지표 v2.2(27 AD-01, 32 0장, 2026-11-13 PR 14). 서버 admin_metrics가 센 집계 숫자만(사람·커플 ID 없음).
// 북극성(이번 달 + 지난 5달 표), 선행(DB로 셀 수 있는 것), 가드레일 넷(기준을 넘으면 빨간 숫자 + ‘기준 넘음’).
// 화면 이벤트로만 셀 수 있는 지표(공개 좁히기, 알림 끄기 등)는 분석 도구에서 봄(32 0-5)
type North = AdminMetrics['north_star'][number];
type Guard = AdminMetrics['guardrails'][number];
type LeadRow = { key: string; r: MetricRatio };

const leadRows = (l: AdminMetrics['leading']): LeadRow[] => [
  { key: 'first_saving', r: l.first_saving },
  { key: 'first_payday', r: l.first_payday },
  { key: 'auto_line', r: l.auto_line },
  { key: 'money_in_dated', r: l.money_in.dated },
  { key: 'money_in_none', r: l.money_in.none },
  { key: 'bundle', r: l.bundle },
  { key: 'split_accept', r: l.split_accept },
  { key: 'rank_pair', r: l.rank_pair },
];

export function MetricsCards() {
  const q = useQuery({ queryKey: ['admin', 'metrics'], queryFn: () => fetchAdminMetrics(6) });
  const m = q.data;
  const now = m?.north_star[m.north_star.length - 1];
  const n = (x: number | undefined) =>
    q.isError || x === undefined ? '—' : x.toLocaleString('ko-KR');
  const pctOf = (r: MetricRatio | undefined) => (q.isError || !r ? '—' : copy.pct(r.pct));
  return (
    <>
      <section className="hg-card" aria-label={copy.northStar}>
        <span className="hg-card__label">{copy.metricsTitle}</span>
        <div className="hg-admin__stats">
          <Stat
            label={copy.northStar}
            value={n(now?.couples)}
            sub={now ? copy.northConnected(now.connected) : undefined}
          />
          <Stat label={copy.northManual} value={pctOf(now?.manual)} />
          <Stat label={copy.northBundle} value={pctOf(now?.bundle)} />
          <Stat label={copy.northSolo} value={n(now?.solo)} />
        </div>
        {m && (
          <details className="hg-admin__more">
            <summary>{copy.northStar}</summary>
            <DataTable<North>
              label={copy.northStar}
              empty={copy.noRows}
              rows={[...m.north_star].reverse()}
              rowKey={(r) => r.month}
              columns={[
                { key: 'm', label: copy.northCols.month, render: (r) => r.month },
                {
                  key: 'c',
                  label: copy.northCols.couples,
                  num: true,
                  render: (r) => r.couples.toLocaleString('ko-KR'),
                },
                {
                  key: 'n',
                  label: copy.northCols.connected,
                  num: true,
                  render: (r) => r.connected.toLocaleString('ko-KR'),
                },
                {
                  key: 's',
                  label: copy.northCols.solo,
                  num: true,
                  render: (r) => r.solo.toLocaleString('ko-KR'),
                },
                {
                  key: 'h',
                  label: copy.northCols.manual,
                  num: true,
                  render: (r) => copy.pct(r.manual.pct),
                },
              ]}
            />
          </details>
        )}
      </section>

      <div className="hg-admin__grid2">
        <section className="hg-card" aria-label={copy.leadingTitle}>
          <span className="hg-card__label">{copy.leadingTitle}</span>
          <DataTable<LeadRow>
            label={copy.leadingTitle}
            empty={q.isError ? '—' : copy.noRows}
            rows={m ? leadRows(m.leading) : []}
            rowKey={(r) => r.key}
            columns={[
              {
                key: 'k',
                label: copy.metricCols.name,
                render: (r) => copy.leadingNames[r.key] ?? r.key,
              },
              {
                key: 'v',
                label: copy.metricCols.value,
                num: true,
                render: (r) => copy.pct(r.r.pct),
              },
              {
                key: 'b',
                label: copy.metricCols.base,
                num: true,
                render: (r) => copy.ratioBase(r.r.num, r.r.den),
              },
            ]}
          />
        </section>
        <section className="hg-card" aria-label={copy.guardTitle}>
          <span className="hg-card__label">{copy.guardTitle}</span>
          <DataTable<Guard>
            label={copy.guardTitle}
            empty={q.isError ? '—' : copy.noRows}
            rows={m?.guardrails ?? []}
            rowKey={(r) => r.kind}
            columns={[
              {
                key: 'k',
                label: copy.metricCols.name,
                render: (r) => copy.guardNames[r.kind] ?? r.kind,
              },
              { key: 'v', label: copy.metricCols.value, num: true, render: (r) => copy.pct(r.pct) },
              { key: 'l', label: copy.metricCols.limit, num: true, render: (r) => `${r.limit}%` },
              {
                key: 's',
                label: copy.metricCols.state,
                render: (r) => (
                  <Status tone={r.alert ? 'warn' : 'ok'}>
                    {r.alert ? copy.guardOver : copy.guardOk}
                  </Status>
                ),
              },
            ]}
          />
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="hg-admin__stat">
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}
