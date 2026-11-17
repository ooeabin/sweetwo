import { fetchGaReport } from '@sweetwo/api';
import { formatKstDateTime, GA_REPORT_DAYS, type GaReport, type GaReportDays } from '@sweetwo/core';
import { Button, DataTable, Tabs } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy } from '../copy';
import { Frame } from '../frame';
import { PageSkel } from '../skel';
import { Bars, Stat } from './ad-01-dashboard';

// AD-21 분석(27 AD-21, ADR 0010, 2026-11-17): Edge Function ga-report가 GA4 Data API에서 받은 집계값만.
// 최고 관리자·운영·분석만(33 2장). 비밀이 없으면 “GA 연결 안 됨”, 실패면 “불러오기 실패”. 차트는 대시보드 막대(Bars) + 표
type Ok = Extract<GaReport, { state: 'ok' }>;
const n = (x: number) => x.toLocaleString('ko-KR');
/** 비율(정수 %, 분모 0이면 —) */
const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num * 100) / den)}%` : '—');

export function AD21Analytics() {
  const [days, setDays] = useState<GaReportDays>(28);
  const q = useQuery({
    queryKey: ['admin', 'ga-report', days],
    queryFn: () => fetchGaReport(days),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const r = q.data;
  return (
    <Frame menu="analytics" title={copy.gaTitle}>
      <Tabs<`${GaReportDays}`>
        label={copy.gaPeriod}
        variant="seg"
        items={GA_REPORT_DAYS.map((d) => ({ value: `${d}`, label: copy.gaDays[d] ?? `${d}` }))}
        value={`${days}`}
        onChange={(v) => setDays(Number(v) as GaReportDays)}
      />
      {q.isLoading ? (
        <PageSkel shape="stats" />
      ) : q.isError || !r || r.state === 'failed' ? (
        <section className="hg-card hg-stack" role="status">
          <b>{copy.gaFailed}</b>
          <div>
            <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
              {copy.gaRetry}
            </Button>
          </div>
        </section>
      ) : r.state === 'not_connected' ? (
        <section className="hg-card hg-stack" role="status">
          <b>{copy.gaNotConnected}</b>
          <p className="hg-help">{copy.gaNotConnectedHelp}</p>
        </section>
      ) : (
        <Report r={r} />
      )}
    </Frame>
  );
}

function Report({ r }: { r: Ok }) {
  const first = r.funnel[0]?.users ?? 0;
  const top = Math.max(...r.funnel.map((f) => f.users), 0);
  return (
    <>
      <section className="hg-card" aria-label={copy.gaActive}>
        <span className="hg-card__label">{copy.gaActive}</span>
        <div className="hg-admin__stats">
          <Stat label={copy.gaDau} value={n(r.active.dau)} />
          <Stat label={copy.gaWau} value={n(r.active.wau)} />
          <Stat label={copy.gaMau} value={n(r.active.mau)} />
          <Stat label={copy.gaNew} value={n(r.users.new)} />
          <Stat label={copy.gaPeriodActive} value={n(r.users.active)} />
        </div>
      </section>

      {r.daily.length > 0 && (
        <section className="hg-card" aria-label={copy.gaDaily}>
          <div className="hg-admin__trend">
            <Bars label={copy.gaDaily} days={r.daily.map((d) => ({ day: d.date, n: d.users }))} />
          </div>
          <details className="hg-admin__more">
            <summary>{copy.gaDailyTable}</summary>
            <DataTable<Ok['daily'][number]>
              label={copy.gaDailyTable}
              empty={copy.noRows}
              rows={[...r.daily].reverse()}
              rowKey={(d) => d.date}
              columns={[
                { key: 'd', label: copy.gaDate, render: (d) => d.date },
                { key: 'u', label: copy.gaCols.users, num: true, render: (d) => n(d.users) },
              ]}
            />
          </details>
        </section>
      )}

      <div className="hg-admin__grid2">
        <section className="hg-card" aria-label={copy.gaFunnel}>
          <span className="hg-card__label">{copy.gaFunnel}</span>
          <DataTable<Ok['funnel'][number]>
            label={copy.gaFunnel}
            empty={copy.noRows}
            rows={r.funnel}
            rowKey={(f) => f.event}
            columns={[
              {
                key: 's',
                label: copy.gaCols.step,
                render: (f) => copy.gaSteps[f.event] ?? f.event,
              },
              { key: 'e', label: copy.gaCols.event, render: (f) => <code>{f.event}</code> },
              { key: 'u', label: copy.gaCols.users, num: true, render: (f) => n(f.users) },
              {
                key: 'r',
                label: copy.gaCols.rate,
                num: true,
                // 가입(서버 이벤트)이 0이면 가장 큰 단계를 기준으로
                render: (f) => pct(f.users, first > 0 ? first : top),
              },
            ]}
          />
          <p className="hg-help">{copy.gaFunnelHelp}</p>
        </section>
        <section className="hg-card" aria-label={copy.gaPlatforms}>
          <span className="hg-card__label">{copy.gaPlatforms}</span>
          <DataTable<Ok['platforms'][number]>
            label={copy.gaPlatforms}
            empty={copy.noRows}
            rows={r.platforms}
            rowKey={(p) => p.platform}
            columns={[
              {
                key: 'p',
                label: copy.gaCols.platform,
                render: (p) => copy.gaPlatformNames[p.platform] ?? p.platform,
              },
              { key: 'u', label: copy.gaCols.active, num: true, render: (p) => n(p.users) },
              { key: 'n', label: copy.gaCols.newUsers, num: true, render: (p) => n(p.new) },
            ]}
          />
        </section>
      </div>

      <div className="hg-admin__grid2">
        <section className="hg-card" aria-label={copy.gaEvents}>
          <span className="hg-card__label">{copy.gaEvents}</span>
          <DataTable<Ok['events'][number]>
            label={copy.gaEvents}
            empty={copy.noRows}
            rows={r.events}
            rowKey={(e) => e.event}
            columns={[
              { key: 'e', label: copy.gaCols.event, render: (e) => <code>{e.event}</code> },
              { key: 'c', label: copy.gaCols.count, num: true, render: (e) => n(e.count) },
              { key: 'u', label: copy.gaCols.users, num: true, render: (e) => n(e.users) },
            ]}
          />
        </section>
        <section className="hg-card" aria-label={copy.gaSources}>
          <span className="hg-card__label">{copy.gaSources}</span>
          <DataTable<Ok['sources'][number]>
            label={copy.gaSources}
            empty={copy.noRows}
            rows={r.sources}
            rowKey={(s) => s.source}
            columns={[
              { key: 's', label: copy.gaCols.source, render: (s) => s.source },
              { key: 'n', label: copy.gaCols.sessions, num: true, render: (s) => n(s.sessions) },
              {
                key: 'c',
                label: copy.gaCols.storeClicks,
                num: true,
                render: (s) => n(s.store_clicks),
              },
            ]}
          />
        </section>
      </div>

      <section className="hg-card" aria-label={copy.gaCohorts}>
        <span className="hg-card__label">{copy.gaCohorts}</span>
        <DataTable<Ok['cohorts'][number]>
          label={copy.gaCohorts}
          empty={copy.noRows}
          rows={[...r.cohorts].reverse()}
          rowKey={(c) => c.week}
          columns={[
            { key: 'w', label: copy.gaCols.week, render: (c) => c.week },
            { key: 'u', label: copy.gaCols.users, num: true, render: (c) => n(c.users) },
            ...([1, 2, 4, 8] as const).map((k) => ({
              key: `w${k}`,
              label: copy.gaCols.w(k),
              num: true,
              render: (c: Ok['cohorts'][number]) => pct(c[`w${k}`], c.users),
            })),
          ]}
        />
        <p className="hg-help">{copy.gaCohortsHelp}</p>
      </section>

      <p className="hg-help">{copy.gaAt(formatKstDateTime(r.at))}</p>
    </>
  );
}
