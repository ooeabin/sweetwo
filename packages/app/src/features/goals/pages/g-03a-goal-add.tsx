import { goalTabs, pickableGoals, type GoalTab } from '@sweetwo/core';
import { GoalPick, QuestionLayout, Tabs } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { useAddDraft } from '../add/draft';
import { useAddStep } from '../add/step';

// G-03a 목표 추가: 분류 탭(첫 탭 ‘자주 고르는’) + 템플릿, 하나 고르면 바로 질문으로. 같은 템플릿 여러 개 가능.
// 자동 목표(비상금, 결혼 비용, 양가 비용)는 없음(pickableGoals). 직접 만들기는 모든 탭 마지막 카드.
export function G03aGoalAdd() {
  const s = useAddStep('g-03a');
  const start = useAddDraft((x) => x.start);
  const [tab, setTab] = useState<GoalTab | 'popular'>('popular');
  const pick = (key: string) => {
    start(key);
    s.next({ template: key, answers: {} });
  };
  return (
    <QuestionLayout steps={s.steps} title={copy.addTitle} onBack={s.onBack}>
      <Tabs
        label={copy.addTabs}
        value={tab}
        onChange={setTab}
        items={goalTabs.map((t) => ({ value: t.key, label: t.label }))}
      />
      {/* 2026-11-03 온보딩 목표 고르기(O-21)와 같은 아이콘 카드. 하나 고르면 바로 다음, 직접 만들기는 마지막 카드 */}
      <GoalPick
        items={pickableGoals(tab).map((t) => ({
          key: t.key,
          name: t.name,
          illustration: t.illustration,
        }))}
        order={() => undefined}
        onToggle={pick}
        customKey="custom"
        customLabel={copy.makeOwn}
        recommendedLabel=""
      />
    </QuestionLayout>
  );
}
