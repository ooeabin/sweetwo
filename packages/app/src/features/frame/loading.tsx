import type { AppTab } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { MainFrame } from './frame';

/** 불러오는 중(19 예외, 13 공통 상태): 0.3초 넘으면 카드 모양 스켈레톤, 그 전엔 빈 본문 */
export function LoadingFrame({ current }: { current: AppTab | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);
  const card = (k: string) => (
    <div key={k} className="hg-card hg-stack" aria-hidden="true">
      <span className="hg-skel" style={{ height: 'var(--space-5)', width: '40%' }} />
      <span className="hg-skel" style={{ height: 'var(--space-3)' }} />
      <span className="hg-skel" style={{ height: 'var(--space-3)', width: '70%' }} />
    </div>
  );
  return (
    <MainFrame
      current={current}
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }} aria-busy="true">
          {show && [card('a'), card('b')]}
        </div>,
      ]}
    />
  );
}
