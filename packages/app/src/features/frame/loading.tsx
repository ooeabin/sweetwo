import { Skel, SkelRows, useDelayed, type AppTab } from '@sweetwo/ui';
import { MainFrame } from './frame';

/**
 * 뼈대 모양(docs/design/components/Skeleton.md). 2026-11-04 화면 모양별(당근·토스처럼):
 * list = 설정·상세 하위(머리 + 줄 카드), home = 홈(숫자 자리 + 카드), cards = 그 밖.
 * 2026-11-06 화면 제목 줄(page)이 따로 있는 화면의 본문만: rows = 줄 카드(자산·부채, 캘린더 목록),
 * tiles = 요약 카드 + 2열 타일, calendar = 달력 카드 + 줄 카드(Y-04)
 */
export type SkelShape = 'list' | 'home' | 'cards' | 'rows' | 'tiles' | 'calendar';

const card = (k: string) => (
  <div key={k} className="hg-card hg-stack" aria-hidden="true">
    <Skel h="var(--space-5)" w="40%" />
    <Skel h="var(--space-3)" />
    <Skel h="var(--space-3)" w="70%" />
  </div>
);

const rows = (
  <>
    <SkelRows rows={[[56, 72], [120], [72, 120]]} />
    <SkelRows
      rows={[
        [80, 96],
        [96, 80],
        [64, 72],
      ]}
    />
  </>
);

function shapeBody(s: SkelShape) {
  switch (s) {
    case 'list':
      return (
        <>
          <Skel h="var(--space-6)" w="40%" style={{ alignSelf: 'center' }} />
          {rows}
        </>
      );
    case 'rows':
      return rows;
    case 'home':
      // 2026-11-09 홈 허브 모양: 큰 상자(다음 월급날 + 막대) + 반 칸 타일 둘
      return (
        <div className="hg-hub" aria-hidden="true">
          <div className="hg-card hg-stack hg-hub__wide">
            <Skel w={120} />
            <Skel w={160} h={28} />
            <Skel h={10} round />
            <SkelRowsInline />
          </div>
          {['a', 'b'].map((k) => (
            <div key={k} className="hg-card hg-stack" style={{ minHeight: 164 }}>
              <Skel w="60%" h={18} />
              <Skel w="40%" />
            </div>
          ))}
        </div>
      );
    case 'tiles':
      return (
        <>
          <div className="hg-card hg-stack" aria-hidden="true">
            <Skel w="60%" />
            <Skel w={96} h="var(--space-3)" />
          </div>
          <div className="hg-goaltiles" aria-hidden="true">
            {['a', 'b', 'c', 'd'].map((k) => (
              <div key={k} className="hg-goaltile">
                <Skel h="auto" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
                <div
                  className="hg-stack"
                  style={{ gap: 'var(--space-2)', padding: 'var(--space-3)' }}
                >
                  <Skel w="70%" />
                  <Skel w="40%" h="var(--space-3)" />
                </div>
              </div>
            ))}
          </div>
        </>
      );
    case 'calendar':
      return (
        <>
          <div className="hg-card hg-stack" aria-hidden="true">
            <Skel w="30%" h={18} />
            <Skel h={320} />
          </div>
          <SkelRows rows={[[120, 72], [96]]} />
        </>
      );
    default:
      return [card('a'), card('b')];
  }
}

/** 본문 뼈대(0.3초 넘으면). 화면 제목 줄이나 탭은 그대로 두고 본문 자리에만 쓸 때 */
export function SkelBody({ shape }: { shape: SkelShape }) {
  const show = useDelayed();
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }} aria-busy="true">
      {show && shapeBody(shape)}
    </div>
  );
}

/**
 * 불러오는 중(19 예외, 13 공통 상태 5번): 0.3초 넘으면 실제 화면 모양 뼈대, 그 전엔 빈 본문.
 */
export function LoadingFrame({
  current,
  sub,
  shape,
}: {
  current: AppTab | null;
  /** 상세·설정 하위 화면(앱 머리 없이 ‹ 제목) */
  sub?: 'detail' | 'settings';
  shape?: SkelShape;
}) {
  const s = shape ?? (sub ? 'list' : current === 'month' ? 'home' : 'cards');
  // 홈·자산 관리 첫 화면은 회색 바탕(2026-11-09)
  const tone = !sub && (current === 'month' || current === 'assets') ? 'alt' : undefined;
  return (
    <MainFrame current={current} sub={sub} tone={tone} columns={[<SkelBody key="l" shape={s} />]} />
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
