import { PageHeader } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { MainFrame } from '../../month';
import { TALK_CARDS } from '../../month-close';
import { copy } from '../copy';
import { guidesPath } from '../guides';

// S-01 부부 대화 카드 다시 보기(W-04i 카드 전체). 보기만.
export function S01Talk() {
  const nav = useNavigate();
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-4)' }}>
      <PageHeader
        title={copy.talkCards}
        backLabel={copy.back}
        backTo={copy.guidesTitle}
        onBack={() => nav(guidesPath)}
      />
      {TALK_CARDS.map((c) => (
        <div key={c} className="hg-card">
          <p className="hg-card__title" style={{ margin: 0 }}>
            {c}
          </p>
        </div>
      ))}
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.talkCards }} columns={[body]} />;
}
