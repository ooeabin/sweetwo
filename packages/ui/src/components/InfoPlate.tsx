import type { ReactNode } from 'react';
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

/** 완료 표시: 완료 화면 제목 아래 큰 체크(옅은 분홍 원 + 분홍 체크) */
export function DoneMark() {
  return (
    <span className="hg-donemark" aria-hidden="true">
      <Icon name="check" size={24} />
    </span>
  );
}
