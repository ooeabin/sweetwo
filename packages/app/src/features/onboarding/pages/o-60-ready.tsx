import { DoneMark, Icon, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { useStep } from '../step';

// O-60 준비 끝(17 온보딩 ②, 2026-11-02 다시 둠). 홈에 들어가기 전 한 장: 무엇을 해 뒀고 홈에서 무엇을 할지.
// ‘홈으로 갈게요’ → 온보딩을 마치고 홈. 진행 막대, 뒤로 없음
export function O60Ready() {
  const s = useStep('o-60');
  if (!s.ready) return null;
  const me = s.state.me;
  const day = me?.payday_last ? copy.paydayLast : me?.payday ? `${me.payday}일` : null;
  const items = me?.monthly_income
    ? [
        { icon: 'wallet' as const, text: copy.readyDone.split },
        ...(day ? [{ icon: 'calendar-check' as const, text: copy.readyDone.checklist(day) }] : []),
        { icon: 'flag-pennant' as const, text: copy.readyDone.goal },
      ]
    : [
        { icon: 'wallet' as const, text: copy.readyDone.salary },
        { icon: 'flag-pennant' as const, text: copy.readyDone.goal },
      ];
  return (
    <QuestionLayout
      title={copy.readyTitle(me?.nickname ?? '')}
      help={copy.readyHelp}
      primary={{ label: copy.readyGo, loading: s.saving }}
      onSubmit={() => void s.finish()}
      center
      hero={<DoneMark />}
    >
      <ul className="hg-intro-steps">
        {items.map((x) => (
          <li key={x.text}>
            <span className="hg-intro-steps__icon" aria-hidden="true">
              <Icon name={x.icon} />
            </span>
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
    </QuestionLayout>
  );
}
