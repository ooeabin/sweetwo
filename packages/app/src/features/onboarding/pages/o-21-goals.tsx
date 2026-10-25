import { insertGoals, trashGoals, updateGoal } from '@sweetwo/api';
import { goalTabs, pickableGoals, recommendedGoals, templateByKey, type GoalTab } from '@sweetwo/core';
import { Chip, QuestionLayout, Tabs } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { pickedGoals } from '../flow';
import { useStep } from '../step';

// O-21 목표 고르기(Q2 변형). 고른 순서 = 우선순위, 해제하면 당겨짐. 0개여도 진행.
// 고른 목표는 모두 우리 목표(owner_user_id null). 비상금은 자동(금액·기한은 O-50 분배표에서 정함).
// 디자인: 목표 고르기는 Chip(순번 hg-chip__order) + 알약 탭(docs/design/components/Chip.md, Tabs.md)
type Pick = { key: string; id?: string }; // id = 이미 저장된 목표

export function O21Goals() {
  const s = useStep('o-21');
  const [tab, setTab] = useState<GoalTab | 'popular'>('popular');
  const [picks, setPicks] = useState<Pick[] | null>(null);
  if (!s.ready) return null;
  const sp = s.state.space;
  const engaged = sp?.marriage_status === 'engaged';
  const saved = pickedGoals(s.state.goals);
  const list: Pick[] = picks ?? saved.map((g) => ({ key: g.template, id: g.id }));
  const rec = recommendedGoals(engaged);
  const order = (key: string) => list.findIndex((p) => p.key === key) + 1 || undefined;
  const toggle = (key: string) =>
    setPicks(order(key) ? list.filter((p) => p.key !== key) : [...list, { key }]);

  const primary = list.length ? copy.next : copy.onlyEmergency;

  const save = async () => {
    // 고른 목표: 남길 것은 순서만 바꾸고, 뺀 것은 휴지통, 새로 고른 것은 추가
    const keepIds = new Set(list.map((p) => p.id).filter(Boolean));
    await trashGoals(saved.filter((g) => !keepIds.has(g.id)).map((g) => g.id));
    await Promise.all(
      list.map((p, i) =>
        p.id ? updateGoal(p.id, { priority: i + 1 }) : Promise.resolve(),
      ),
    );
    await insertGoals(
      list.flatMap((p, i) => {
        if (p.id) return [];
        const t = templateByKey(p.key);
        if (!t) return [];
        return [
          {
            template: t.key,
            name: t.name,
            kind: t.kind({}),
            priority: i + 1,
          },
        ];
      }),
    );
    // 자동 목표: 비상금(우리 목표, 금액은 O-50에서 (고정지출 + 생활비) × 3)
    if (!(s.state.goals ?? []).some((g) => g.template === 'emergency')) {
      await insertGoals([{ template: 'emergency', name: '비상금', kind: 'once', priority: 0 }]);
    }
  };

  const prevTop = saved[0];
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.goalsTitle}
      help={copy.goalsHelp}
      onBack={s.onBack}
      primary={{ label: primary, loading: s.saving }}
      onSubmit={() =>
        void s.done(save, (fresh) => {
          // 1순위가 그대로이고 이미 답했으면 O-23·O-24를 다시 묻지 않는다
          const top = pickedGoals(fresh.goals)[0];
          if (top && prevTop && top.id === prevTop.id && top.target_amount !== null) return 'o-30';
          return undefined;
        })
      }
    >
      <p className="hg-banner hg-banner--info" style={{ margin: 0 }}>
        <span>{copy.autoEmergency}</span>
      </p>
      <Tabs
        label={copy.goalTabsLabel}
        value={tab}
        onChange={setTab}
        items={goalTabs.map((t) => ({ value: t.key, label: t.label }))}
      />
      <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
        {pickableGoals(tab, engaged).map((t) => (
          <Chip
            key={t.key}
            selected={!!order(t.key)}
            order={order(t.key)}
            onClick={() => toggle(t.key)}
          >
            {t.name}
            {rec.includes(t.key) && <span className="hg-tag">{copy.recommended}</span>}
          </Chip>
        ))}
        <Chip selected={!!order('custom')} order={order('custom')} onClick={() => toggle('custom')}>
          {copy.makeOwn}
        </Chip>
      </div>
      <p className="hg-q__help" aria-live="polite">
        {list.length ? copy.picked(list.length) : ''}
      </p>
    </QuestionLayout>
  );
}
