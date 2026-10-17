import { QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { closePath } from '../data';
import { useDetailData } from '../detail';

const PER_MONTH = 3;

// W-04i 대화 카드(꼼꼼 모드, 선택): 주제별 질문 묶음에서 매달 3장(달마다 다른 3장). 넘기기 / 건너뛰기,
// 건너뛰어도 완료. 끝나면 정산 요약으로 돌아감. 지난 카드 모아보기(S-01)는 설정 가이드와 함께.
export function W04iTalk() {
  const nav = useNavigate();
  const d = useDetailData();
  const [n, setN] = useState(0);
  if (d.loading) return null;
  const all = copy.cards;
  const startAt = ((d.month - 1) * PER_MONTH) % all.length;
  const cards = Array.from({ length: PER_MONTH }, (_, i) => all[(startAt + i) % all.length] ?? '');
  const done = () => nav(closePath('w-04g'));

  return (
    <QuestionLayout
      steps={d.progress('w-04i')}
      title={copy.cardsTitle}
      help={copy.cardCount(n + 1, cards.length)}
      onBack={() => (n > 0 ? setN(n - 1) : nav(closePath(d.prevOf('w-04i'))))}
      later={{ label: copy.cardSkip, onClick: done }}
      primary={{ label: n < cards.length - 1 ? copy.cardNext : copy.next }}
      onSubmit={() => (n < cards.length - 1 ? setN(n + 1) : done())}
    >
      <div className="hg-card" aria-live="polite">
        <p className="hg-card__title" style={{ margin: 0 }}>
          {cards[n]}
        </p>
      </div>
    </QuestionLayout>
  );
}
