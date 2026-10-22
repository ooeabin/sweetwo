import { Button, PageHeader } from '@sweetwo/ui';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { GUIDES, guidesPath } from '../guides';

// S-03 가이드 글(25 S-03): 본문 폭 640px, 3분 분량, 끝에 “우리에게 적용하기” + ‘투자·금융 자문 아님’ 고지. 제도·개념만, 상품 추천 없음.
export function S03Guide() {
  const { key = '' } = useParams();
  const nav = useNavigate();
  const g = GUIDES.find((x) => x.key === key);
  if (!g) return <Navigate to={guidesPath} replace />;
  const body = (
    <article className="hg-stack" style={{ gap: 'var(--space-4)', maxWidth: 'var(--content-max)' }}>
      <PageHeader
        title={g.title}
        backLabel={copy.back}
        backTo={copy.guidesTitle}
        onBack={() => nav(guidesPath)}
      />
      {g.paragraphs.map((p) => (
        <p key={p} style={{ margin: 0 }}>
          {p}
        </p>
      ))}
      {g.apply && (
        <Button variant="primary" onClick={() => g.apply && nav(g.apply.path)}>
          {`${copy.applyToUs}: ${g.apply.label}`}
        </Button>
      )}
      <p className="hg-card__meta">{copy.notAdvice}</p>
    </article>
  );
  return <MainFrame current={null} page={{ title: g.title }} columns={[body]} />;
}
