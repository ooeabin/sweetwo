import { insertGoals, trashGoals, updateGoal } from '@sweetwo/api';
import {
  goalTabs,
  pickableGoals,
  recommendedGoals,
  templateByKey,
  type GoalTab,
} from '@sweetwo/core';
import { GoalPick, QuestionLayout, Tabs } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { pickedGoals } from '../flow';
import { useStep } from '../step';

// O-21 목표 고르기(Q2 변형). 고른 순서 = 우선순위, 해제하면 당겨짐. 0개여도 진행.
// 고른 목표는 모두 우리 목표(owner_user_id null). 비상금은 자동(금액·기한은 O-50 분배표에서 정함).
// 디자인: 그림 카드 GoalPick(3열, 좁은 창 2열, 순번 원) + 알약 탭(docs/design/components/GoalPick.md, Tabs.md)
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
      list.map((p, i) => (p.id ? updateGoal(p.id, { priority: i + 1 }) : Promise.resolve())),
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

  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.goalsTitle}
      help={copy.goalsHelp}
      onBack={s.onBack}
      primary={{ label: primary, loading: s.saving }}
      onSubmit={() => void s.done(save)}
    >
      <Tabs
        label={copy.goalTabsLabel}
        value={tab}
        onChange={setTab}
        items={goalTabs.map((t) => ({ value: t.key, label: t.label }))}
      />
      <GoalPick
        items={pickableGoals(tab, engaged).map((t) => ({
          key: t.key,
          name: t.name,
          illustration: t.illustration,
          recommended: rec.includes(t.key),
        }))}
        order={order}
        onToggle={toggle}
        // 직접 만들기는 이름부터 물어야 해서 온보딩에서는 빼고 목표 탭(G-03a)에서(2026-11-02)
        recommendedLabel={copy.recommended}
      />
      <p className="hg-q__help" aria-live="polite">
        {list.length ? copy.picked(list.length) : ''}
      </p>
    </QuestionLayout>
  );
}
