import { parseFaq, searchFaq } from '@sweetwo/core';
import { Accordion, Button, ListRow, PageHeader, Search, SectionHeader } from '@sweetwo/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import faqMd from '../../../content/faq.md?raw';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { openSite } from './s-19-about';

// S-20 도움말(docs/spec/25-settings.md): 자주 묻는 질문(웹사이트 L-06과 같은 원본 apps/site/src/content/faq.md,
// pnpm content:sync로 복사) + 위에 검색, 문의하기(S-19a), 내 문의, 약관·처리방침, 버전(S-19).
// 검색 결과가 없으면 “찾는 답이 없어요” + 문의하기.
export function S20Help() {
  const nav = useNavigate();
  const groups = useMemo(() => parseFaq(faqMd), []);
  const [q, setQ] = useState('');
  const found = q.trim() ? searchFaq(groups, q) : null;
  const toItems = (xs: { n: number; q: string; a: string }[]) =>
    xs.map((i) => ({ id: String(i.n), q: i.q, a: i.a }));
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.help}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <Search label={copy.faqSearch} placeholder={copy.faqSearch} value={q} onChange={setQ} />
      {found ? (
        found.length ? (
          <Accordion items={toItems(found)} />
        ) : (
          <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
            <p>{copy.faqNone}</p>
            <div className="hg-row">
              <Button variant="primary" onClick={() => nav('/settings/help/inquiry')}>
                {copy.contact}
              </Button>
            </div>
          </div>
        )
      ) : (
        groups.map((g) => (
          <section key={g.title} className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            <SectionHeader title={g.title} />
            <Accordion items={toItems(g.items)} />
          </section>
        ))
      )}
      <div className="hg-list">
        <ListRow label={copy.contact} onClick={() => nav('/settings/help/inquiry')} />
        <ListRow label={copy.myInquiries} onClick={() => nav('/settings/help/inquiries')} />
        <ListRow label={copy.terms} onClick={() => openSite('/terms')} />
        <ListRow label={copy.privacy} onClick={() => openSite('/privacy')} />
        <ListRow label={copy.version} onClick={() => nav('/settings/about')} />
      </div>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
