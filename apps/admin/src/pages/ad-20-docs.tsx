import { useMemo, useState } from 'react';
import { copy } from '../copy';
import { docs, DESIGN_PREVIEW_URL } from '../docs';
import { Frame } from '../frame';
import { Markdown } from '../markdown';

// AD-20 문서: 저장소 docs/(기획서, 디자인, 개발 가이드)를 읽기 전용으로. 왼쪽 목차, 위 검색, 문서마다 마지막 수정일과 커밋.
// 로그인한 관리자 모두 읽기, 수정은 저장소에서만.
export function AD20Docs() {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(docs[0]?.path ?? '');
  const list = useMemo(
    () => docs.filter((d) => !q || (d.title + d.body).toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  const cur = docs.find((d) => d.path === sel);
  return (
    <Frame
      menu="docs"
      title={copy.menus.docs}
      actions={
        <a
          className="hg-btn hg-btn--link"
          href={DESIGN_PREVIEW_URL}
          target="_blank"
          rel="noreferrer"
        >
          {copy.designPreview}
        </a>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr)',
          gap: 'var(--space-6)',
          userSelect: 'text',
        }}
      >
        <nav aria-label={copy.menus.docs} className="hg-stack">
          <input
            className="hg-input"
            aria-label={copy.docSearch}
            placeholder={copy.docSearch}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul
            className="hg-stack"
            style={{ listStyle: 'none', padding: 0, margin: 0, gap: 'var(--space-1)' }}
          >
            {list.map((d) => (
              <li key={d.path}>
                <button
                  type="button"
                  className="hg-btn hg-btn--ghost hg-btn--sm"
                  onClick={() => setSel(d.path)}
                  aria-current={d.path === sel ? 'page' : undefined}
                >
                  {d.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <article aria-label={cur?.title}>
          <p className="hg-help">
            {cur?.path}
            {__DOCS_COMMIT__ ? ` ${__DOCS_COMMIT__}` : ''}
          </p>
          {cur && <Markdown text={cur.body} />}
        </article>
      </div>
    </Frame>
  );
}
