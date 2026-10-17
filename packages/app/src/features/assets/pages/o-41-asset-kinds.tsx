import { QUICK_ASSETS } from '@sweetwo/core';
import { Chip, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { LUMP, useWeek, weekPath } from '../week/week';

// O-41 가진 돈 종류(Q2 그룹 칩, 첫 주 2일째 ‘자산 정리하기’): 고른 것마다 O-42, ‘결혼 후 남은 목돈’이면 O-43.
// 위에 “쓰던 통장 {n}개는 이미 넣어뒀어요”(O-63 통장 자산). O-15 전세·월세면 부동산 미리 선택.
export function O41AssetKinds() {
  const w = useWeek('assets');
  const [picks, setPicks] = useState<string[] | null>(null);
  if (w.d.loading) return null;
  const housed = w.d.space?.housing === 'jeonse' || w.d.space?.housing === 'monthly_rent';
  const cur = picks ?? (w.draft.picks.length ? w.draft.picks : housed ? ['real_estate'] : []);
  const accounts = w.d.accounts.filter(
    (a) => a.asset_id && w.d.items.some((x) => x.id === a.asset_id),
  ).length;
  const flip = (k: string) => setPicks(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);
  const total = 1 + cur.length + (cur.includes(LUMP) ? 1 : 0);

  return (
    <QuestionLayout
      steps={{ total, now: 0 }}
      title={copy.weekAssets}
      help={accounts ? copy.weekAccountsIn(accounts) : undefined}
      onBack={w.close}
      later={{ label: copy.weekClose, onClick: w.close }}
      primary={{ label: copy.next, disabled: !cur.length }}
      onSubmit={() => {
        // 칩 순서대로
        const ordered = QUICK_ASSETS.map((q) => q.key).filter((k) => cur.includes(k));
        w.setPicks(ordered);
        w.nav(weekPath.asset(1));
      }}
    >
      <div
        role="group"
        aria-label={copy.weekAssets}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}
      >
        {QUICK_ASSETS.map((q) => (
          <Chip
            key={q.key}
            selected={cur.includes(q.key)}
            onClick={() => flip(q.key)}
            style={{ justifyContent: 'center' }}
          >
            {q.name}
          </Chip>
        ))}
      </div>
    </QuestionLayout>
  );
}
