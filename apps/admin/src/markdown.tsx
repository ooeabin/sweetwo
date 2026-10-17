import { Fragment, type ReactNode } from 'react';

// AD-20 문서 보기용 작은 마크다운 렌더러(읽기 전용, HTML 문자열을 쓰지 않음).
// 제목(#), 표(|), 목록(-, 1.), 인용(>), 코드 블록(```), 문단. 줄 안: **굵게**, `코드`.
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    out.push(
      t.startsWith('**') ? (
        <b key={i++}>{t.slice(2, -2)}</b>
      ) : (
        <code key={i++}>{t.slice(1, -1)}</code>
      ),
    );
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out.map((x, k) => <Fragment key={k}>{x}</Fragment>);
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim().replace(/\\\|/g, '|'));

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) body.push(lines[i++] ?? '');
      i++;
      blocks.push(
        <pre key={k++} className="hg-card" style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
          {body.join('\n')}
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = (h[1] ?? '#').length;
      const content = inline(h[2] ?? '');
      blocks.push(
        level === 1 ? (
          <h2 key={k++}>{content}</h2>
        ) : level === 2 ? (
          <h3 key={k++}>{content}</h3>
        ) : (
          <h4 key={k++}>{content}</h4>
        ),
      );
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|'))
        rows.push(lines[i++] ?? '');
      const [head, , ...body] = rows;
      blocks.push(
        <table key={k++} className="hg-table">
          <thead>
            <tr>
              {cells(head ?? '').map((c, j) => (
                <th key={j} scope="col">
                  {inline(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, j) => (
              <tr key={j}>
                {cells(r).map((c, n) => (
                  <td key={n} style={{ whiteSpace: 'normal' }}>
                    {inline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+\./.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i] ?? ''))
        items.push((lines[i++] ?? '').replace(/^\s*([-*]|\d+\.)\s+/, ''));
      const lis = items.map((t, j) => <li key={j}>{inline(t)}</li>);
      blocks.push(ordered ? <ol key={k++}>{lis}</ol> : <ul key={k++}>{lis}</ul>);
      continue;
    }
    if (line.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('>'))
        q.push((lines[i++] ?? '').replace(/^>\s?/, ''));
      blocks.push(
        <blockquote key={k++} className="hg-help">
          {inline(q.join(' '))}
        </blockquote>,
      );
      continue;
    }
    const p: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !/^(#|\||```|>|\s*([-*]|\d+\.)\s)/.test(lines[i] ?? '')
    )
      p.push(lines[i++] ?? '');
    blocks.push(<p key={k++}>{inline(p.join(' '))}</p>);
  }
  return <div className="hg-stack">{blocks}</div>;
}
