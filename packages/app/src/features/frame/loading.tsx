import { Skel, SkelRows, useDelayed, type AppTab } from '@sweetwo/ui';
import { MainFrame } from './frame';

/**
 * 불러오는 중(19 예외, 13 공통 상태 5번): 0.3초 넘으면 실제 화면 모양 뼈대, 그 전엔 빈 본문.
 * 2026-11-04 화면 모양별(당근·토스처럼): list = 설정·상세 하위(머리 + 줄 카드), home = 홈(숫자 자리 + 카드), cards = 그 밖
 */
export function LoadingFrame({
  current,
  sub,
  shape,
}: {
  current: AppTab | null;
  /** 상세·설정 하위 화면(앱 머리 없이 ‹ 제목) */
  sub?: 'detail' | 'settings';
  shape?: 'list' | 'home' | 'cards';
}) {
  const show = useDelayed();
  const s = shape ?? (sub ? 'list' : current === 'month' ? 'home' : 'cards');
  const card = (k: string) => (
    <div key={k} className="hg-card hg-stack" aria-hidden="true">
      <Skel h="var(--space-5)" w="40%" />
      <Skel h="var(--space-3)" />
      <Skel h="var(--space-3)" w="70%" />
    </div>
  );
  const body =
    s === 'list' ? (
      <>
        <Skel h="var(--space-6)" w="40%" style={{ alignSelf: 'center' }} />
        <SkelRows rows={[[56, 72], [120], [72, 120]]} />
        <SkelRows
          rows={[
            [80, 96],
            [96, 80],
            [64, 72],
          ]}
        />
      </>
    ) : s === 'home' ? (
      <>
        <div className="hg-stack" style={{ gap: 'var(--space-2)' }} aria-hidden="true">
          <Skel w={120} />
          <Skel w={200} h={32} />
        </div>
        <div className="hg-card hg-stack" aria-hidden="true">
          <Skel w="50%" h={18} />
          <Skel h={10} round />
          <SkelRowsInline />
        </div>
        <SkelRows
          rows={[
            [140, 80],
            [110, 80],
          ]}
        />
      </>
    ) : (
      [card('a'), card('b')]
    );
  return (
    <MainFrame
      current={current}
      sub={sub}
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }} aria-busy="true">
          {show && body}
        </div>,
      ]}
    />
  );
}

function SkelRowsInline() {
  return (
    <>
      <div className="hg-skelcard__row">
        <Skel w={100} />
        <Skel w={70} />
      </div>
      <div className="hg-skelcard__row">
        <Skel w={120} />
        <Skel w={60} />
      </div>
    </>
  );
}
