import { Skel, useDelayed } from '@sweetwo/ui';

// 어드민 화면 불러오기 뼈대(2026-11-06 인터랙션 점검, docs/design/components/Skeleton.md ‘어드민’).
// 0.3초 안에 오면 그리지 않음. detail: 왼쪽 카드 둘 + 오른쪽 좁은 카드, stats: 숫자 칸 넷 + 카드.
export function PageSkel({ shape = 'detail' }: { shape?: 'detail' | 'stats' }) {
  const late = useDelayed(300);
  if (!late) return null;
  const card = (lines: number, key: number) => (
    <div key={key} className="hg-card hg-stack" aria-hidden="true">
      <Skel w={96} h={12} />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="hg-admin__kv">
          <Skel w={72} h={12} />
          <Skel w={`${[64, 48, 72, 56][i % 4]}%`} h={12} />
        </div>
      ))}
    </div>
  );
  if (shape === 'stats')
    return (
      <div className="hg-stack" aria-busy="true">
        <div className="hg-card hg-stack" aria-hidden="true">
          <Skel w={96} h={12} />
          <div className="hg-admin__stats">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="hg-admin__stat">
                <Skel w={80} h={12} />
                <Skel w={56} h={28} />
              </div>
            ))}
          </div>
        </div>
        <div className="hg-admin__grid2">{[card(3, 1), card(3, 2)]}</div>
      </div>
    );
  return (
    <div className="hg-admin__grid" aria-busy="true">
      <div className="hg-admin__col">{[card(5, 1), card(3, 2)]}</div>
      <div className="hg-admin__col">{card(3, 3)}</div>
    </div>
  );
}
