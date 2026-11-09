import { fetchGoals, qk } from '@sweetwo/api';
import { pickGuides } from '@sweetwo/core';
import { ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { LoadFailed } from '../load-failed';
import { GUIDES, TOPIC_KEYS, checkPath, readPath, useChecklist } from '../guides';

// S-01 가이드 모아보기(25 S-01): 지금 단계 체크리스트(진행률, 항목은 보기만 → S-02), 맞춤 정보 3개(저금 항목 이름·거주 형태·자녀 계획),
// 주제별 가이드 6개(→ S-03), 우리 둘 대화 카드 다시 보기(W-04i). 완료는 이번 달 할 일에서만.
export function S01Guides() {
  const nav = useNavigate();
  const d = useSettingsData();
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const ck = useChecklist(d.space);
  if (d.failed || ck.failed || goals.isError)
    return (
      <LoadFailed
        onRetry={() => {
          d.retry();
          ck.retry();
          void goals.refetch();
        }}
      />
    );
  if (d.loading || ck.loading || goals.isLoading || !d.space)
    return <LoadingFrame sub="settings" current={null} />;
  const mine = pickGuides({
    housing: d.space.housing,
    childPlan: d.space.child_plan,
    templates: (goals.data ?? []).filter((g) => !g.deleted_at).map((g) => g.template),
    names: (goals.data ?? []).filter((g) => !g.deleted_at).map((g) => g.name),
  });
  const guide = (key: string) => GUIDES.find((g) => g.key === key);
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.guidesTitle}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <section className="hg-stack">
        <SectionHeader
          title={ck.stage ? copy.checklistStage(ck.stage.name) : copy.noStage}
          count={ck.stage ? copy.checklistCount(ck.count, ck.total) : undefined}
        />
        {ck.stage && (
          <div className="hg-list">
            {ck.stage.items.map((i) => (
              <ListRow
                key={i.key}
                icon={ck.doneOf(i.key) ? 'check' : undefined}
                label={i.title}
                onClick={() => nav(checkPath(i.key))}
              />
            ))}
          </div>
        )}
      </section>
      <section className="hg-stack">
        <SectionHeader title={copy.forUs} />
        <div className="hg-list">
          {mine.map((k) => (
            <ListRow key={k} label={guide(k)?.title ?? ''} onClick={() => nav(readPath(k))} />
          ))}
        </div>
      </section>
      <section className="hg-stack">
        <SectionHeader title={copy.topics} />
        <div className="hg-list">
          {TOPIC_KEYS.map((k) => (
            <ListRow
              key={k}
              label={guide(k)?.topic ?? ''}
              sub={guide(k)?.title}
              onClick={() => nav(readPath(k))}
            />
          ))}
        </div>
      </section>
      <div className="hg-list">
        <ListRow label={copy.talkCards} onClick={() => nav('/settings/guides/talk')} />
      </div>
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
