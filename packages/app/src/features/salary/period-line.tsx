import { periodFilledBand, periodFillPct, periodFull, type MoneyInPeriod } from '@sweetwo/core';
import { HubLine, PeriodBar } from '@sweetwo/ui';
import { useEffect } from 'react';
import { track } from '../../shared/analytics';
import { money, useMask } from '../../shared/mask';
import { spoken } from '../../shared/masked-text';
import { copy } from './copy';

/**
 * H-13 기간 한 줄(07 6장, 19 ‘H-11 상태’ 날짜 없음): 홈 H-11 자리와 월급 탭 ‘이번 달’ 자리(날짜 없는 사람)가 같이 씀.
 * 기간 없음 “돈이 들어오면 알려 주세요” / 1~15일째 “이번 기간 들어온 돈 …” / 16일째부터 PeriodBar(중립 색, 판정 문장 없음)
 * / 빈 날 “지난번 돈이 들어온 지 n일 됐어요”. 상자 전체 → W-20(“돈 들어왔어요 ›”). 분석 money_in_period_viewed(상태마다 한 번)
 */
export function PeriodLine({ period, onGo }: { period: MoneyInPeriod; onGo: () => void }) {
  const { masked } = useMask();
  const won = (v: number) => money(v, masked);
  const state = period.status;
  useEffect(() => {
    if (state === 'none') return;
    track('money_in_period_viewed', { state, filled_band: periodFilledBand(period) });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = copy.moneyInGo;
  if (state === 'bar' && period.start) {
    const inn = copy.periodIn(won(period.received));
    const need = copy.periodNeed(won(period.needed ?? 0));
    const since = copy.periodSince(period.start);
    const full = periodFull(period);
    return (
      <HubLine
        go={go}
        label={spoken(
          [copy.periodBarLabel(won(period.received), won(period.needed ?? 0), since)]
            .concat(full ? [copy.periodFull] : [])
            .join(', '),
        )}
        bar={
          <PeriodBar
            inLabel={inn}
            needLabel={need}
            percent={periodFillPct(period.received, period.needed) ?? 0}
            since={since}
            full={full ? copy.periodFull : undefined}
          />
        }
        onClick={onGo}
      />
    );
  }
  const text =
    state === 'early'
      ? copy.periodEarly(won(period.received))
      : state === 'gap'
        ? copy.periodGap(period.gapDays ?? 0)
        : copy.periodNone;
  return <HubLine text={text} go={go} label={spoken(`${text}, ${go}`)} onClick={onGo} />;
}
