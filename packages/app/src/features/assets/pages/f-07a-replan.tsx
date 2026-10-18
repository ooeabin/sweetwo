import { Chip, QuestionLayout } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { replanPath, useReplan, type ReplanKind } from '../replan/draft';

const KINDS: ReplanKind[] = ['move', 'baby', 'job', 'goals'];

/** 고른 바뀜 → 다시 물을 질문(F-07b). 목표 변화는 목표 화면에서 */
export const replanQuestions = (kinds: ReplanKind[]) =>
  (
    [
      ['job', 'income'],
      ['move', 'fixed'],
      ['baby', 'living'],
    ] as const
  )
    .filter(([k]) => kinds.includes(k))
    .map(([, q]) => q);

// F-07a “어떤 게 바뀌었나요?”(Q2 여러 개: 이사 / 출산 / 이직·수입 변화 / 목표 변화) → F-07b 바뀐 부분만 다시 묻기 → F-07c 비교·적용.
// 이번 달 할 일 ‘계획을 다시 세워볼까요?’, 수입 20% 이상 바꾼 뒤, 설정(S-17)에서 엶. 목표 변화만 고르면 목표 화면으로.
export function F07aReplan() {
  const nav = useNavigate();
  const kinds = useReplan((x) => x.kinds);
  const set = useReplan((x) => x.set);
  const flip = (k: ReplanKind) =>
    set({ kinds: kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k] });
  const next = () => {
    const qs = replanQuestions(kinds);
    const first = qs[0];
    if (first) nav(replanPath.question(first));
    else nav('/goals');
  };
  return (
    <QuestionLayout
      title={copy.replanWhat}
      onBack={() => nav(-1)}
      primary={{ label: copy.next, disabled: kinds.length === 0 }}
      onSubmit={() => kinds.length > 0 && next()}
    >
      <div
        className="hg-row"
        style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
        role="group"
        aria-label={copy.replanWhat}
      >
        {KINDS.map((k) => (
          <Chip key={k} selected={kinds.includes(k)} onClick={() => flip(k)}>
            {copy.replanKinds[k]}
          </Chip>
        ))}
      </div>
    </QuestionLayout>
  );
}
