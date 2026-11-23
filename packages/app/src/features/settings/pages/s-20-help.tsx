import { parseFaq, searchFaq } from '@sweetwo/core';
import { Accordion, LineTabs, ListRow, PageHeader, Search } from '@sweetwo/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import faqMd from '../../../content/faq.md?raw';
import { useBackOr } from '../../../shared/back-or';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { openSite } from './s-19-about';

// S-20 도움말(docs/spec/25-settings.md): 자주 묻는 질문(웹사이트 L-06과 같은 원본 apps/site/src/content/faq.md,
// pnpm content:sync로 복사) + 위에 검색, 문의하기(S-19a), 내 문의, 약관·처리방침, 버전(S-19).
// 검색 결과가 없으면 “찾는 답이 없어요” 한 줄(문의하기는 아래 상자 줄 하나, 2026-11-20).
// 2026-11-20: 검색 칸 아래 묶음 5개(faq.md의 ## 묶음). 2026-11-23 칩 줄 → 밑줄 탭(LineTabs): 첫 탭 ‘자주 묻는 질문’ = 기본(묶음마다 첫 질문, 5개),
// 다른 탭을 고르면 그 묶음만(예전 ‘같은 칩을 다시 누르면 기본으로’는 첫 탭이 대신함). 검색하면 칩을 무시하고 전체에서 찾음
// v2.2(Q4): 항목 “상대가 돈을 통제하거나 위협할 때”(1366 등)는 기관 검토 뒤 게시. 검토 전엔 이 플래그로 숨기고 출시
// (본문은 기관 검토를 받은 뒤 기획서 25 S-20에 넣고 플래그를 켬).
const HELP_ABUSE_ENABLED = false as boolean;

export function S20Help() {
  const nav = useNavigate();
  const goBack = useBackOr('/settings');
  const groups = useMemo(() => parseFaq(faqMd), []);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>(''); // '' = 기본 ‘자주 묻는 질문’
  const found = q.trim() ? searchFaq(groups, q) : null;
  const picked = groups.find((g) => g.title === group) ?? null;
  // 대표 질문 5개 = 묶음마다 첫 질문(faq.md 순서)
  const top = groups.flatMap((g) => g.items.slice(0, 1));
  const toItems = (xs: { n: number; q: string; a: string }[]) =>
    xs.map((i) => ({ id: String(i.n), q: i.q, a: i.a }));
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.help} backLabel={copy.back} backTo={copy.title} onBack={goBack} />
      <Search label={copy.faqSearch} placeholder={copy.faqSearch} value={q} onChange={setQ} />
      {found ? (
        found.length ? (
          <Accordion items={toItems(found)} />
        ) : (
          // 2026-11-20 결과 없음: 안내 한 줄만(slate). ‘문의하기’는 아래 상자 줄 하나(오렌지 채움 버튼이 줄과 겹쳐 두 번 나왔음)
          <p className="hg-help hg-empty__line" role="status">
            {copy.faqNone}
          </p>
        )
      ) : (
        <>
          <LineTabs<string>
            label={copy.faqGroups}
            value={group}
            onChange={setGroup}
            items={[
              { value: '', label: copy.faq },
              ...groups.map((g) => ({ value: g.title, label: g.title })),
            ]}
          />
          <Accordion items={toItems(picked ? picked.items : top)} />
        </>
      )}
      <div className="hg-list">
        {HELP_ABUSE_ENABLED && <ListRow label={copy.helpAbuse} chevron={false} />}
        <ListRow label={copy.contact} onClick={() => nav('/settings/help/inquiry')} />
        <ListRow label={copy.myInquiries} onClick={() => nav('/settings/help/inquiries')} />
        <ListRow label={copy.terms} onClick={() => openSite('/terms')} />
        <ListRow label={copy.privacy} onClick={() => openSite('/privacy')} />
        <ListRow label={copy.version} onClick={() => nav('/settings/about')} />
      </div>
    </div>
  );
  return <MainFrame sub="settings" current={null} tone="alt" columns={[body]} />;
}
