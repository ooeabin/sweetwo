import {
  formatYm,
  NET_WORTH_PERIODS,
  periodEnabled,
  periodSlice,
  startPeriod,
  type NetWorthPeriod,
} from '@sweetwo/core';
import { LineChart } from '@sweetwo/ui';
import { useState } from 'react';
import { money, useMask } from '../../shared/mask';
import { copy } from './copy';
import type { AssetsData } from './data';

// F-01 2·6번: 순자산(원금 기준) 머리 + 순자산 그래프(LineChart). 기간 탭은 기기에 기억.
const KEY = 'sweetwo.networth-period';
const readPeriod = (): NetWorthPeriod | undefined => {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? undefined : NET_WORTH_PERIODS.find((p) => String(p) === v);
  } catch {
    return undefined;
  }
};
const savePeriod = (p: NetWorthPeriod) => {
  try {
    localStorage.setItem(KEY, String(p));
  } catch {
    /* 저장 못 해도 이번 화면에는 적용 */
  }
};

export function NetWorthChart({ d }: { d: AssetsData }) {
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const n = d.series.length;
  const [period, setPeriod] = useState<NetWorthPeriod>(() => startPeriod(n, readPeriod()));
  const cur = periodEnabled(period, n) ? period : startPeriod(n);
  const nw = d.nw;

  return (
    <LineChart
      label={copy.netWorth}
      value={m(nw.net)}
      sub={
        nw.gain !== 0 ? (
          <span className="hg-networth__expected">
            {copy.expected(m(nw.expected))}
            {', '}
            {copy.gain(`${nw.gain > 0 ? '+' : '−'}${m(Math.abs(nw.gain))}`)}
          </span>
        ) : undefined
      }
      delta={
        d.change !== null && d.change !== 0
          ? d.change > 0
            ? { dir: 'up', text: copy.up(m(d.change)) }
            : { dir: 'down', text: copy.down(m(-d.change)) }
          : undefined
      }
      points={periodSlice(d.series, cur).map((x) => ({
        label: formatYm(x.month),
        value: x.net,
        expected: x.expected,
      }))}
      format={m}
      name={copy.netWorth}
      expectedName={copy.expectedName}
      expectedText={copy.expectedShort}
      plotLabel={copy.graphLabel}
      periodsLabel={copy.periodsLabel}
      periods={NET_WORTH_PERIODS.map((p, i) => ({
        label: copy.periods[i] ?? '',
        active: p === cur,
        disabled: !periodEnabled(p, n),
      }))}
      onPeriod={(i) => {
        const p = NET_WORTH_PERIODS[i];
        if (p === undefined) return;
        setPeriod(p);
        savePeriod(p);
      }}
    />
  );
}
