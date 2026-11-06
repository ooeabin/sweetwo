import { useId, useState } from 'react';
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
  // 누른 쪽만 도는 원(2026-11-06), 처리 중에는 두 버튼 모두 누르기 막음
  const [picked, setPicked] = useState<'mine' | 'theirs' | null>(null);
  return (
    <section className="hg-conflict" role="group" aria-labelledby={`${id}-t`}>
      <p className="hg-conflict__title" id={`${id}-t`} role="status">
        {p.title}
      </p>
      <p className="hg-conflict__body">{p.body}</p>
      {p.sub && <p className="hg-conflict__body">{p.sub}</p>}
      <div className="hg-conflict__actions">
        <Button
          onClick={() => {
            if (p.busy) return;
            setPicked('mine');
            p.onMine();
          }}
          loading={p.busy && picked === 'mine'}
        >
          {p.mine.label}
          <small>{p.mine.value}</small>
        </Button>
        <Button
          onClick={() => {
            if (p.busy) return;
            setPicked('theirs');
            p.onTheirs();
          }}
          loading={p.busy && picked === 'theirs'}
        >
          {p.theirs.label}
          <small>{p.theirs.value}</small>
        </Button>
      </div>
    </section>
  );
}
