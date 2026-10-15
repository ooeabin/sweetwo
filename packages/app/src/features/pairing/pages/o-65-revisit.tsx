import { needsLook, type Signal } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { onboardingCopy as oc, TempNote } from '../../onboarding';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';
import { revisit } from '../revisit';
import { Was } from '../was';

const tagClass = (sig: Signal) => (sig === 'unknown' ? 'hg-badge hg-badge--temp' : 'hg-tag');

// O-65 재정 진단 다시 보기(합류 뒤). 지표 5개 + 신호, 바뀐 비율은 이전 값 취소선. 버튼 “이번 달로”.
// 개선 액션(첫 주 할 일)은 시작한 사람 온보딩에서 이미 만들어져 이번 달 할 일에 있음.
export function O65Revisit() {
  const s = useJoinStep('o-65');
  const d = s.d;
  const nav = useNavigate();
  if (!d.ready) return null;
  const r = revisit(d);
  if (!r) return null;
  const look = needsLook(r.now.diag);
  const title = look.length
    ? oc.lookAt(look.map((x) => oc.indicators[x.key]).join(', '))
    : oc.allGood;
  const pct = (v: number | null) => (v === null ? '' : `${v}%`);

  return (
    <QuestionLayout
      wide
      steps={s.steps}
      title={title}
      onBack={s.onBack}
      primary={{ label: copy.toMonth }}
      onSubmit={() => nav('/', { replace: true })}
    >
      <TempNote reason={r.temp} />
      <ul className="hg-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {r.now.diag.map((x) => {
          const b = r.before.diag.find((y) => y.key === x.key);
          return (
            <li key={x.key} className="hg-listrow" style={{ gridTemplateColumns: '1fr auto auto' }}>
              <span
                className="hg-listrow__label"
                style={x.signal === 'unknown' ? { color: 'var(--stone)' } : undefined}
              >
                {oc.indicators[x.key]}
              </span>
              <span className="hg-listrow__value is-soft">
                <Was now={pct(x.pct)} before={pct(b?.pct ?? null)} />
              </span>
              <span className={tagClass(x.signal)}>{oc.signals[x.signal]}</span>
            </li>
          );
        })}
      </ul>
    </QuestionLayout>
  );
}
