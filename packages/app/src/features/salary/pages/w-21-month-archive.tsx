import { fetchMoneyIns, fetchPastChecklists, qk } from '@sweetwo/api';
import { archiveRow, formatMonthDay, pastPeriods, todayKst } from '@sweetwo/core';
import { ListRow, PageHeader, SkelRows } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { speakMasked } from '../../../shared/masked-text';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { baseDayOf, cycleName, useShownPayday } from '../cycle';
import { useChecklists, useMe, usePartner, useSpace } from '../data';
import { incomeOf } from '../month-parts';
import { salaryPaths, togetherPaths } from '../paths';
import { lateLines, lateOpen } from './w-02-last-month';

// W-21 지난 달 모아보기(20 W-21, 2026-11-17 사용자 결정). 입구: 메뉴 서랍 ‘월급 › 지난 달 모아보기’, W-02 머리 링크(?from=w02).
// 지난 사이클(월급날 기준 달)을 최근 것부터: 제목 “10월 25일 월급”, 보조 결과(“계획대로 됐어요” / “확인을 마쳤어요” / “확인할 것 n개”)와
// “모은 금액 …”, 오른쪽 그 달 수입(W-02 1c 공유 이미지와 같은 기준). 줄 → W-02 지난 달 보기(`?cycle=`, 읽기 전용, 늦은 확인 규칙 그대로).
// 각자 엔진은 내 것만, 합쳐서는 공동 것. 날짜 없는 사람(확인 목록 없음)은 끝난 30일 기간별 수입 합(줄 → W-20b).
// 계산은 core `archiveRow`·`pastPeriods`(W-02 MonthBar와 같은 규칙).
export function W21MonthArchive() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const lists = useChecklists();
  const shownPayday = useShownPayday();
  const { masked } = useMask();
  const today = todayKst();
  const meId = me.data?.id;
  const joint = space.data?.salary_mode === 'joint';
  // 날짜 없는 사람(각자)은 확인 목록이 없어 기간 단위(20 W-02 ‘날짜 없는 사람은 W-02 없음’)
  const periodMode = !!me.data?.payday_none && !joint;
  const owner = joint ? null : (meId ?? null);
  const current = (lists.data ?? []).find((c) => c.owner_user_id === owner);
  const ready = !!me.data && !!space.data && lists.isSuccess;
  const past = useQuery({
    queryKey: qk.pastChecklists(owner, current?.cycle_start ?? today),
    queryFn: () => fetchPastChecklists(owner, current?.cycle_start ?? today),
    enabled: ready && !periodMode,
  });
  const ins = useQuery({
    queryKey: qk.moneyIns,
    queryFn: () => fetchMoneyIns(),
    enabled: ready && periodMode,
  });
  const entry = params.get('from') === 'w02' ? 'w02' : 'drawer';
  const periods = pastPeriods(
    (ins.data ?? []).filter((r) => r.owner_user_id === meId),
    today,
  );
  const rowCount = periodMode ? periods.length : (past.data?.length ?? 0);
  const loaded = periodMode ? ins.isSuccess : past.isSuccess;
  const sent = useRef(false);
  useEffect(() => {
    if (!loaded || sent.current) return;
    sent.current = true;
    track('month_archive_viewed', {
      kind: periodMode ? 'period' : 'cycle',
      rows: rowCount,
      entry,
    });
  }, [loaded, periodMode, rowCount, entry]);

  if (!me.data || !space.data) return <LoadingFrame current="salary" sub="detail" />;
  const m = (v: number) => money(v, masked);
  const sp = space.data;
  const base = baseDayOf(me.data, sp);
  const failed = periodMode ? ins.isError && !ins.data : past.isError && !past.data;
  const retry = () => void (periodMode ? ins.refetch() : past.refetch());
  const income = incomeOf(owner, me.data, partner.data);

  const row = (
    key: string,
    label: string,
    sub: React.ReactNode,
    value: number,
    onClick: () => void,
  ) => (
    <ListRow key={key} label={label} sub={sub} value={speakMasked(m(value))} onClick={onClick} />
  );

  const body = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.archiveTitle}
        backLabel={copy.back}
        backTo={copy.tabTitle}
        onBack={() => (window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist))}
      />
      {failed ? (
        <section className="hg-card hg-card--fill hg-stack" role="status">
          <p className="hg-card__meta">{copy.loadFailed}</p>
          <button
            type="button"
            className="hg-btn hg-btn--link"
            style={{ alignSelf: 'flex-start' }}
            onClick={retry}
          >
            {copy.retry}
          </button>
        </section>
      ) : !loaded ? (
        <SkelRows
          rows={[
            [120, 72],
            [96, 72],
          ]}
        />
      ) : rowCount === 0 ? (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.archiveEmpty}
        </p>
      ) : periodMode ? (
        <div className="hg-list">
          {periods.map((p) =>
            row(
              p.start,
              copy.archivePeriod(formatMonthDay(p.start), formatMonthDay(p.end)),
              copy.archivePeriodCount(p.count),
              p.received,
              () => nav(togetherPaths.moneyInList),
            ),
          )}
        </div>
      ) : (
        <div className="hg-list">
          {(past.data ?? []).map((l) => {
            const late = lateOpen(l, today, base, shownPayday) ? lateLines(l).length : 0;
            const r = archiveRow({ lines: l.pay_check_line, income, lateCount: late });
            return row(
              l.id,
              cycleName(shownPayday(l.cycle_start)),
              <>
                <span style={{ display: 'block' }}>
                  {r.result === 'late'
                    ? copy.archiveResult.late(r.lateCount)
                    : copy.archiveResult[r.result]}
                </span>
                <span style={{ display: 'block' }}>
                  {speakMasked(copy.archiveSaved(m(r.saved)))}
                </span>
              </>,
              r.income,
              () => nav(`${salaryPaths.checklist}?cycle=${l.id}`, { state: { from: 'archive' } }),
            );
          })}
        </div>
      )}
    </div>
  );
  return <MainFrame sub="detail" current="salary" columns={[body]} />;
}
