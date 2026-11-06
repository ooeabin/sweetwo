import { Fragment, type ReactNode } from 'react';

// 어드민·내보내기용 표(docs/design/components/DataTable.md, hg-table). 사용자 화면에는 쓰지 않음.
// 숫자 열은 오른쪽 정렬, 모르는 값은 “—”. 행을 누르면 onRow(키보드 Enter도).
// expanded가 값을 주면 그 행 바로 아래에 펼친 줄(hg-table__more)을 그림.
export interface DataColumn<T> {
  key: string;
  label: string;
  num?: boolean;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  onRow,
  expanded,
  empty,
}: {
  label: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRow?: (row: T) => void;
  /** 행 아래 펼친 내용(없으면 null) */
  expanded?: (row: T) => ReactNode | null;
  empty?: ReactNode;
}) {
  return (
    <table className="hg-table" aria-label={label}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={c.num ? 'is-num' : undefined}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && empty ? (
          <tr>
            <td colSpan={columns.length}>{empty}</td>
          </tr>
        ) : (
          rows.map((r) => {
            const more = expanded?.(r) ?? null;
            return (
              <Fragment key={rowKey(r)}>
                <tr
                  tabIndex={onRow ? 0 : undefined}
                  style={onRow ? { cursor: 'pointer' } : undefined}
                  onClick={onRow ? () => onRow(r) : undefined}
                  onKeyDown={
                    onRow
                      ? (e) => {
                          if (e.key === 'Enter') onRow(r);
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.num ? 'is-num' : undefined}>
                      {c.render(r) ?? '—'}
                    </td>
                  ))}
                </tr>
                {more !== null && (
                  <tr className="hg-table__more">
                    <td colSpan={columns.length}>{more}</td>
                  </tr>
                )}
              </Fragment>
            );
          })
        )}
      </tbody>
    </table>
  );
}
