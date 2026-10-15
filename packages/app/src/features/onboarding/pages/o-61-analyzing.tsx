import { QuestionLayout } from '@sweetwo/ui';
import { useEffect, useRef, useState } from 'react';
import { copy } from '../copy';
import { syncEmergency } from '../result';
import { useStep } from '../step';

const MS = 1500;

// O-61 분석 중(Q7, 버튼 없음). 답으로 비상금 기준을 맞추고 1.5초 뒤 O-62. 실패하면 토스트 + 다시 시도(useStep).
export function O61Analyzing() {
  const s = useStep('o-61');
  const [pct, setPct] = useState(0);
  const started = useRef(false);

  // 진행 막대(보기만)
  useEffect(() => {
    const t0 = Date.now();
    const tick = setInterval(
      () => setPct(Math.min(100, Math.round(((Date.now() - t0) / MS) * 100))),
      100,
    );
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!s.ready || started.current) return;
    started.current = true;
    const wait = new Promise((r) => setTimeout(r, MS));
    void s.done(async () => {
      await syncEmergency(s.state);
      await wait;
    });
  }, [s.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s.ready) return null;
  return (
    <QuestionLayout steps={s.steps} title={copy.analyzing}>
      <div
        className="hg-stackbar"
        role="progressbar"
        aria-label={copy.analyzing}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ background: 'var(--surface-alt)' }}
      >
        <span style={{ width: `${pct}%`, background: 'var(--ink)' }} />
      </div>
    </QuestionLayout>
  );
}
