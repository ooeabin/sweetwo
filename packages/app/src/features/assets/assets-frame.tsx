import { Button, Tabs } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainFrame } from '../frame';
import { copy } from './copy';

type Tab = 'overview' | 'items';
const PATH: Record<Tab, string> = {
  overview: '/assets',
  items: '/assets/items',
};
const KEY = 'sweetwo.assets-tab';

/** 마지막 본 하위 탭(F-01 1번). 기기에만 */
export const lastAssetsTab = () => {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'items' ? '/assets/items' : '/assets';
  } catch {
    return '/assets';
  }
};

// 자산 관리 첫 화면 틀: 화면 제목 줄(“자산 관리” + ‘+ 추가’) + 하위 탭 “요약” “자산·부채”(23 1번, 2개 고정).
// 2026-11-09 회색 바탕(tone="alt") 위 흰 상자, 좁은 창 추가는 F-02 목록 끝 ‘+ 자산 추가’·‘+ 부채 추가’ 줄
export function AssetsFrame({
  tab,
  addSide = 'asset',
  children,
}: {
  tab: Tab;
  addSide?: 'asset' | 'debt';
  children: ReactNode;
}) {
  const nav = useNavigate();
  try {
    localStorage.setItem(KEY, tab);
  } catch {
    /* 기억 못 해도 됨 */
  }
  return (
    <MainFrame
      current="assets"
      tone="alt"
      page={{
        title: copy.title,
        actions: (
          // 넓은 창만. 좁은 창은 F-02 목록 끝 ‘+ 자산 추가’·‘+ 부채 추가’ 줄(2026-11-09 + 버튼 대신)
          <Button
            variant="primary"
            className="hg-wide-only"
            onClick={() => nav(`/assets/new?side=${addSide}`)}
          >
            {copy.add}
          </Button>
        ),
      }}
      columns={[
        <div key="c" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
          <Tabs<Tab>
            label={copy.tabsLabel}
            value={tab}
            onChange={(t) => PATH[t] && nav(PATH[t])}
            items={[
              { value: 'overview', label: copy.tabs.overview },
              { value: 'items', label: copy.tabs.items },
            ]}
          />
          {children}
        </div>,
      ]}
    />
  );
}
