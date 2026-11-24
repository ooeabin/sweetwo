import { AddText, Button, LineTabs } from '@sweetwo/ui';
import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainFrame, rememberAssetsTab, type AssetsTab } from '../frame';
import { copy } from './copy';

type Tab = AssetsTab;
// 하위 탭 셋(2026-11-23): 요약 / 자산 / 부채. 자산·부채는 F-02(`/assets/items`, 부채는 ?side=debt)
type ViewTab = 'overview' | 'asset' | 'debt';
const PATH: Record<ViewTab, string> = {
  overview: '/assets',
  asset: '/assets/items',
  debt: '/assets/items?side=debt',
};

// 자산 관리 첫 화면 틀: 화면 제목 줄(“자산 관리” + ‘+ 추가’) + 하위 탭 “요약” “자산” “부채”(23 1번, 3개 고정, 2026-11-23).
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
  // 마지막 본 하위 탭(F-01 1번, 기기에만). 들어올 때 frame lastAssetsTab으로 이 탭을 엶(2026-11-12 S8-10)
  useEffect(() => rememberAssetsTab(tab), [tab]);
  return (
    <MainFrame
      current="assets"
     
      page={{
        // 제목 = 서랍 줄 이름(2026-11-18): F-02는 ‘자산·부채’, 서랍에 없는 F-01은 탭 이름 ‘자산 관리’
        title: tab === 'items' ? copy.tabs.items : copy.title,
        actions: (
          // 넓은 창만. 좁은 창은 F-02 목록 끝 ‘+ 자산 추가’·‘+ 부채 추가’ 줄(2026-11-09 + 버튼 대신).
          // 메뉴 제목 줄 ‘추가’는 보조 버튼(DESIGN.md, 2026-11-12 QA 8구간 S8-11)
          <Button
            variant="secondary"
            className="hg-wide-only"
            aria-label={copy.add}
            onClick={() => nav(`/assets/new?side=${addSide}`)}
          >
            <AddText>{copy.add}</AddText>
          </Button>
        ),
      }}
      columns={[
        <div key="c" className="hg-stack">
          <LineTabs<ViewTab>
            label={copy.tabsLabel}
            value={tab === 'overview' ? 'overview' : addSide}
            onChange={(t) => nav(PATH[t], { replace: tab === 'items' && t !== 'overview' })}
            items={[
              { value: 'overview', label: copy.tabs.overview },
              { value: 'asset', label: copy.tabs.asset },
              { value: 'debt', label: copy.tabs.debt },
            ]}
          />
          {children}
        </div>,
      ]}
    />
  );
}
