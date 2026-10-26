import { formatDateFull, giftRepeated } from '@sweetwo/core';
import { EmptyState, ListRow, PageHeader, SectionHeader, Tabs } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useCalendarData } from '../data';

type View = 'care' | 'year';
const VIEW_KEY = 'sweetwo.gift-view';
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'year' ? 'year' : 'care';
  } catch {
    return 'care';
  }
};

// Y-09 드린 기록(24 Y-09, 재기획): 무엇을, 언제, 얼마 드렸는지. 챙길 날별 / 연도별 보기(기기에 기억).
// 같은 챙길 날에 2년 안 같은 선물이면 “작년에도 드렸어요”. 행 → 그 챙길 날 상세(Y-05). 사진은 기록 사진(Y-08c)과 함께 다음 단계.
export function Y09GiftLog() {
  const nav = useNavigate();
  const c = useCalendarData();
  const { masked } = useMask();
  const m = (x: number) => money(x, masked);
  const [view, setView] = useState<View>(readView);
  if (c.loading) return <MainFrame current="calendar" columns={[null]} />;

  const careOf = (id: string) => c.cares.find((x) => x.id === id);
  const rows = c.records
    .filter((r) => careOf(r.care_day_id))
    .sort((a, b) => (a.occurs_on < b.occurs_on ? 1 : -1));
  const what = (r: (typeof rows)[number]) =>
    copy.giftedWhat(
      (['cash', 'gift', 'meal'] as const)
        .filter((g) => r.gifts.includes(g))
        .map((g) => (g === 'gift' && r.gift_name ? r.gift_name : copy.gifts[g])),
    );

  // 묶음: 챙길 날별(가장 최근 기록 순) / 연도별(최근 해부터)
  const groups: { key: string; title: string; items: typeof rows }[] = [];
  const push = (key: string, title: string, r: (typeof rows)[number]) => {
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(r);
    else groups.push({ key, title, items: [r] });
  };
  for (const r of rows)
    if (view === 'year')
      push(r.occurs_on.slice(0, 4), copy.giftedYear(Number(r.occurs_on.slice(0, 4))), r);
    else push(r.care_day_id, careOf(r.care_day_id)?.name ?? '', r);

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.gifted} backLabel={copy.back} onBack={() => nav(-1)} />
      <Tabs<View>
        variant="seg"
        label={copy.giftedViewsLabel}
        value={view}
        onChange={(v) => {
          setView(v);
          try {
            localStorage.setItem(VIEW_KEY, v);
          } catch {
            /* 기억 못 해도 됨 */
          }
        }}
        items={[
          { value: 'care', label: copy.giftedViews.care },
          { value: 'year', label: copy.giftedViews.year },
        ]}
      />
      {!rows.length ? (
        <EmptyState title={copy.giftedEmpty} />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="hg-stack" aria-label={g.title}>
            <SectionHeader
              title={g.title}
              count={copy.giftedSum(m(g.items.reduce((t, r) => t + r.amount, 0)))}
            />
            <div className="hg-list">
              {g.items.map((r) => {
                const care = careOf(r.care_day_id);
                const again = giftRepeated(c.records, r);
                return (
                  <ListRow
                    key={r.id}
                    label={care?.name ?? ''}
                    sub={[formatDateFull(r.occurs_on), what(r), again ? copy.giftAgain : null]
                      .filter(Boolean)
                      .join(', ')}
                    value={m(r.amount)}
                    onClick={() => nav(`/calendar/day/${r.care_day_id}`)}
                  />
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
  return <MainFrame current="calendar" columns={[body]} />;
}
