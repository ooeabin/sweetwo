import { goalTabs, pickableGoals, type GoalTab } from '@sweetwo/core';
import { Chip, QuestionLayout, Tabs } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { useAddDraft } from '../add/draft';
import { useAddStep } from '../add/step';

// G-03a 목표 추가: 분류 탭(첫 탭 ‘자주 고르는’) + 템플릿, 하나 고르면 바로 질문으로. 같은 템플릿 여러 개 가능.
// 자동 목표(비상금, 결혼 비용, 양가 비용)는 없음(pickableGoals). 직접 만들기는 모든 탭 아래.
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
      <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
        {pickableGoals(tab).map((t) => (
          <Chip key={t.key} selected={s.draft.template === t.key} onClick={() => pick(t.key)}>
            {t.name}
          </Chip>
        ))}
      </div>
      <div className="hg-row">
        <Chip selected={s.draft.template === 'custom'} onClick={() => pick('custom')}>
          {copy.makeOwn}
        </Chip>
      </div>
    </QuestionLayout>
  );
}
