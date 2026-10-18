import { fetchGoals, qk } from '@sweetwo/api';
import { Button, ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { replanPath, useReplan } from '../../assets';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useSettingsData } from '../data';

export const answerPath = (f: 'housing' | 'employment' | 'child' | 'split') =>
  `/settings/answers/${f}`;

// S-17 내 답 다시 보기(25 S-17): 온보딩 파트별 답 요약 + 다시 답하기, “계획 다시 세우기”(F-07a).
// 사실값(수입·월급날·고정지출·자산·부채)은 바로, 배분 결정(용돈·생활비·분담)은 연결된 부부면 제안 — 각 고치는 화면이 지킴.
// 결혼 상태·결혼 전 돈 관리 방식(파트 1) 바꾸기는 결혼일 전환(H-T)과 함께라 여기서는 보기만.
export function S17Answers() {
  const nav = useNavigate();
  const d = useSettingsData();
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const { masked } = useMask();
  if (d.loading || goals.isLoading || !d.me || !d.space || !d.c)
    return <MainFrame current={null} columns={[null]} />;
  const me = d.me;
  const sp = d.space;
  const c = d.c;
  const m = (v: number | null) => (v === null ? '' : money(v, masked));
  const pct = sp.split_mode === 'custom' ? c.myRatio : null;
  const part = (title: string, rows: ReactNode) => (
    <section className="hg-stack">
      <SectionHeader title={title} />
      <div className="hg-list">{rows}</div>
    </section>
  );
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.answersTitle} backLabel={copy.back} onBack={() => nav('/settings')} />
      {part(
        copy.parts.p0,
        <>
          <ListRow
            label={copy.answerRows.nickname}
            value={c.myName}
            onClick={() => nav('/settings/me/nickname')}
          />
          <ListRow
            label={copy.answerRows.side}
            value={me.side ? copy.sides[me.side] : ''}
            onClick={() => nav('/settings/me/side')}
          />
        </>,
      )}
      {part(
        copy.parts.p1,
        <>
          <ListRow
            label={copy.answerRows.marriage}
            value={copy.marriageState[sp.marriage_status ?? ''] ?? ''}
          />
          <ListRow
            label={copy.answerRows.housing}
            value={sp.housing ? copy.housingOptions[sp.housing] : ''}
            onClick={() => nav(answerPath('housing'))}
          />
          <ListRow
            label={copy.answerRows.employment}
            value={me.employment ? copy.employmentOptions[me.employment] : ''}
            onClick={() => nav(answerPath('employment'))}
          />
          <ListRow
            label={copy.answerRows.child}
            value={sp.child_plan ? copy.childOptions[sp.child_plan] : ''}
            onClick={() => nav(answerPath('child'))}
          />
        </>,
      )}
      {part(
        copy.parts.p2,
        <ListRow
          label={copy.answerRows.goals}
          value={copy.goalsCount((goals.data ?? []).length)}
          onClick={() => nav('/goals')}
        />,
      )}
      {part(
        copy.parts.p3,
        <>
          <ListRow
            label={copy.answerRows.income}
            value={m(me.monthly_income)}
            onClick={() => nav('/assets/money/income')}
          />
          <ListRow
            label={copy.answerRows.fixed}
            value={m(sp.fixed_total)}
            onClick={() => nav('/assets/money/fixed')}
          />
          <ListRow
            label={copy.answerRows.living}
            value={m(sp.living_budget)}
            onClick={() => nav('/assets/money/living')}
          />
        </>,
      )}
      {part(
        copy.parts.p4,
        <ListRow label={copy.answerRows.assets} onClick={() => nav('/assets/items')} />,
      )}
      {part(
        copy.parts.p5,
        <>
          <ListRow
            label={copy.answerRows.allowance}
            value={m(me.allowance)}
            onClick={() => nav('/assets/money/allowance')}
          />
          {c.joined && (
            <ListRow
              label={copy.answerRows.split}
              value={
                sp.split_mode
                  ? pct !== null
                    ? `${copy.splitModes.custom} ${pct} : ${100 - pct}`
                    : copy.splitModes[sp.split_mode]
                  : ''
              }
              onClick={() => nav(answerPath('split'))}
            />
          )}
        </>,
      )}
      <Button
        variant="secondary"
        onClick={() => {
          useReplan.getState().reset();
          nav(replanPath.start);
        }}
      >
        {copy.replan}
      </Button>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.answersTitle }} columns={[body]} />;
}
