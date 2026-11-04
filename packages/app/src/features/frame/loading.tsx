import type { AppTab } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { MainFrame } from './frame';

/** 불러오는 중(19 예외, 13 공통 상태): 0.3초 넘으면 카드 모양 스켈레톤, 그 전엔 빈 본문 */
export function LoadingFrame({
  current,
  sub,
}: {
  current: AppTab | null;
  /** 상세·설정 하위 화면(앱 머리 없이 ‹ 제목). 2026-11-04 빈 흰 화면 대신 머리 자리 + 뼈대 */
  sub?: 'detail' | 'settings';
}) {
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
      sub={sub}
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }} aria-busy="true">
          {show && sub && (
            <span
              className="hg-skel"
              aria-hidden="true"
              style={{ height: 'var(--space-6)', width: '40%', alignSelf: 'center' }}
            />
          )}
          {show && [card('a'), card('b')]}
        </div>,
      ]}
    />
  );
}
