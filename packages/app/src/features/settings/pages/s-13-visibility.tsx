import {
  fetchAssets,
  fetchGoals,
  qk,
  updateAsset,
  updateGoal,
  updateMe,
  type Asset,
} from '@sweetwo/api';
import { Button, ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Vis = 'all' | 'sum' | 'private';
const VIS: Vis[] = ['all', 'sum', 'private'];
/** 내 목표는 두 가지(숨기기 없음): 모두 보여 주기 / 금액만 보여 주기(25 S-13 3번, 22 공개) */
type GoalVis = 'all' | 'amount';
const GOAL_VIS: GoalVis[] = ['all', 'amount'];

function VisSelect<V extends string>({
  label,
  value,
  onChange,
  options = VIS as unknown as V[],
  names = copy.vis,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options?: V[];
  names?: Record<string, string>;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="hg-sr">
        {label}
      </label>
      <select
        id={id}
        className="hg-input"
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {names[v]}
          </option>
        ))}
      </select>
    </>
  );
}

// S-13 공개 범위(docs/spec/25-settings.md, 08 4장): 새 항목 기본값(바꾸면 “이미 있는 항목 n개도 바꿀까요?”),
// 항상 함께 보는 것 3줄(보기만), 내 명의 항목마다 공개 범위(바로 반영). 다시 연결 뒤 한 번 확인할 때는 ?next=/ 로 열고 ‘확인’.
export function S13Visibility() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = params.get('next');
  const d = useSettingsData();
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const [ask, setAsk] = useState<Vis | null>(null);
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.me || assets.isLoading || goals.isLoading)
    return <MainFrame current={null} columns={[null]} />;
  const me = d.me;
  const mine = (assets.data ?? []).filter((a) => a.owner === 'person' && a.owner_user_id === me.id);
  // 내 목표(비상금은 늘 우리 목표). 혼자 쓰기·미합류면 볼 사람이 없어 묶음을 숨김
  const myGoals = d.c?.joined
    ? (goals.data ?? []).filter((g) => g.owner_user_id === me.id && g.template !== 'emergency')
    : [];
  const run = async (f: () => Promise<unknown>, keys: readonly (readonly string[])[]) => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
      await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(copy.saved);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const setDefault = (v: Vis, all: boolean) =>
    run(async () => {
      await updateMe({ default_visibility: v });
      if (all)
        await Promise.all(
          mine.filter((a) => a.visibility !== v).map((a) => updateAsset(a.id, { visibility: v })),
        );
    }, [qk.me, qk.assets]);
  const differ = (v: Vis) => mine.filter((a) => a.visibility !== v).length;
  const label = (a: Asset) => (a.side === 'debt' ? `${a.name} ${copy.visDebt}` : a.name);

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.visTitle}
        backLabel={copy.back}
        backTo={next ? undefined : copy.title}
        onBack={() => nav(next ?? '/settings')}
      />
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.visDefault} />
        <p className="hg-q__help">{copy.visDefaultSub}</p>
        <VisSelect
          label={copy.visDefault}
          value={me.default_visibility}
          onChange={(v) => {
            if (v === me.default_visibility) return;
            if (differ(v) > 0) setAsk(v);
            else void setDefault(v, false);
          }}
        />
        {ask && (
          <div className="hg-stack" role="alertdialog" aria-label={copy.visApplyAll(differ(ask))}>
            <b>{copy.visApplyAll(differ(ask))}</b>
            <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const v = ask;
                  setAsk(null);
                  void setDefault(v, true);
                }}
              >
                {copy.visAll}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const v = ask;
                  setAsk(null);
                  void setDefault(v, false);
                }}
              >
                {copy.visNewOnly}
              </Button>
            </div>
          </div>
        )}
      </section>
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.visFixedTitle} />
        <div className="hg-list">
          {copy.visFixed.map((t) => (
            <ListRow key={t} label={t} chevron={false} />
          ))}
        </div>
      </section>
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.visMine} />
        {mine.length === 0 ? (
          !myGoals.length && <p className="hg-q__help">{copy.visNone}</p>
        ) : (
          <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
            {mine.map((a) => (
              <div
                key={a.id}
                className="hg-row"
                style={{ gap: 'var(--space-3)', alignItems: 'center' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{label(a)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <VisSelect
                    label={copy.visLabel(a.name)}
                    value={a.visibility}
                    onChange={(v) =>
                      void run(() => updateAsset(a.id, { visibility: v }), [qk.assets])
                    }
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      {!!myGoals.length && (
        <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
          <SectionHeader title={copy.visGoals} />
          <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
            {myGoals.map((g) => (
              <div
                key={g.id}
                className="hg-row"
                style={{ gap: 'var(--space-3)', alignItems: 'center' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{g.name}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <VisSelect<GoalVis>
                    label={copy.visLabel(g.name)}
                    value={g.visibility === 'amount' ? 'amount' : 'all'}
                    options={GOAL_VIS}
                    names={copy.goalVis}
                    onChange={(v) =>
                      void run(() => updateGoal(g.id, { visibility: v }), [qk.goals])
                    }
                  />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {next && (
        <div className="hg-row">
          <Button variant="primary" onClick={() => nav(next, { replace: true })}>
            {copy.ok}
          </Button>
        </div>
      )}
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
