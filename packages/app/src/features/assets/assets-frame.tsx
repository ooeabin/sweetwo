import { Button, Tabs } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainFrame } from '../month';
import { copy } from './copy';

type Tab = 'overview' | 'items' | 'diagnosis';
const PATH: Record<Tab, string> = {
  overview: '/assets',
  items: '/assets/items',
  diagnosis: '/assets/diagnosis',
};
const KEY = 'sweetwo.assets-tab';

/** 마지막 본 하위 탭(F-01 1번). 기기에만 */
export const lastAssetsTab = () => {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'items' ? '/assets/items' : t === 'diagnosis' ? '/assets/diagnosis' : '/assets';
  } catch {
    return '/assets';
  }
};

// 우리 자산 첫 화면 틀: 화면 제목 줄(“우리 자산” + ‘+ 추가’) + 하위 탭 “한눈에” “자산·부채” “재정 진단”
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
      page={{
        title: copy.title,
        actions: (
          <Button variant="primary" onClick={() => nav(`/assets/new?side=${addSide}`)}>
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
              { value: 'diagnosis', label: copy.tabs.diagnosis },
            ]}
          />
          {children}
        </div>,
      ]}
    />
  );
}
