import type { ReactNode } from 'react';
import { hasIllustration, Illustration } from './Illustration';
import { Icon } from './Icon';

// 조건 요약 판(docs/design/components/InfoPlate.md). 회색 판 위 이름–값 두 열(dl). 줄 사이 선 없음.
export function InfoPlate({
  title,
  rows,
  note,
  label,
}: {
  title?: ReactNode;
  rows: { label: ReactNode; value: ReactNode; sub?: boolean }[];
  note?: ReactNode;
  /** 화면 읽기 이름(제목이 없을 때) */
  label?: string;
}) {
  return (
    <section className="hg-kv" aria-label={label}>
      {title && <h2 className="hg-kv__title">{title}</h2>}
      <dl style={{ display: 'contents' }}>
        {rows.map((r, i) => (
          <div key={i} className={r.sub ? 'hg-kv__row is-sub' : 'hg-kv__row'}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="hg-kv__note">{note}</p>}
    </section>
  );
}

/**
 * 완료 표시: 3D 완료 그림(Illustrations `done-check`, 팔았어요는 `done-sold`, 96px, 2026-11-05).
 * 그림 파일이 없으면 큰 체크(옅은 오렌지 원 + 오렌지 체크)
 */
export function DoneMark({ art = 'done-check' }: { art?: string } = {}) {
  // 축하(폭죽)는 한 번 터지는 움직이는 그림(2026-11-05), 나머지는 톡 커짐
  if (hasIllustration(art)) return <Illustration name={art} className="hg-doneart" motion />;
  return (
    <span className="hg-donemark" aria-hidden="true">
      <Icon name="check" size={24} />
    </span>
  );
}
