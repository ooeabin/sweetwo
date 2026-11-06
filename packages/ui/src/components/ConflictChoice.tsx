import { useId } from 'react';
import { Button } from './Button';

// 충돌 선택(docs/design/components/ConflictChoice.md): 제목 → 설명 → 같은 크기 버튼 두 개(이름 + 값)
export function ConflictChoice(p: {
  title: string;
  body: string;
  sub?: string;
  mine: { label: string; value: string };
  theirs: { label: string; value: string };
  onMine: () => void;
  onTheirs: () => void;
  busy?: boolean;
}) {
  const id = useId();
  return (
    <section className="hg-conflict" role="group" aria-labelledby={`${id}-t`}>
      <p className="hg-conflict__title" id={`${id}-t`} role="status">
        {p.title}
      </p>
      <p className="hg-conflict__body">{p.body}</p>
      {p.sub && <p className="hg-conflict__body">{p.sub}</p>}
      <div className="hg-conflict__actions">
        <Button onClick={p.onMine} disabled={p.busy}>
          {p.mine.label}
          <small>{p.mine.value}</small>
        </Button>
        <Button onClick={p.onTheirs} disabled={p.busy}>
          {p.theirs.label}
          <small>{p.theirs.value}</small>
        </Button>
      </div>
    </section>
  );
}
