import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@sweetwo/ui/styles.css';
import { docs, DESIGN_PREVIEW_URL } from './docs';

// AD-20 문서 메뉴의 뼈대. 목차 + 검색 + 본문(지금은 원문 그대로). 렌더러와 어드민 로그인은 어드민 단계에서.
function DocsPage() {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(docs[0]?.path ?? '');
  const list = useMemo(() => docs.filter((d) => (d.title + d.body).includes(q)), [q]);
  const cur = docs.find((d) => d.path === sel);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, padding: 24 }}>
      <nav aria-label="문서 목차">
        <input className="hg-input" placeholder="문서 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {list.map((d) => (
            <li key={d.path}>
              <button className="hg-btn hg-btn--ghost" onClick={() => setSel(d.path)} aria-current={d.path === sel}>
                {d.title}
              </button>
            </li>
          ))}
        </ul>
        <a className="hg-btn hg-btn--link" href={DESIGN_PREVIEW_URL} target="_blank" rel="noreferrer">
          디자인 시스템 미리보기
        </a>
      </nav>
      <article>
        <p className="hg-help">{cur?.path}</p>
        <pre style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}>{cur?.body}</pre>
      </article>
    </div>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root가 없어요');

createRoot(rootEl).render(
  <StrictMode>
    <div className="hg-root">
      <DocsPage />
    </div>
  </StrictMode>,
);
