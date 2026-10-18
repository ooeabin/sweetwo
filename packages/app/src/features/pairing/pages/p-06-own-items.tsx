import { fetchAssets, qk, updateAsset, type Asset } from '@sweetwo/api';
import { formatWon } from '@sweetwo/core';
import { AmountInput, Button, ChoiceCards, QuestionLayout, Tabs } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setWeekBack, weekPath } from '../../assets';
import { copy } from '../copy';
import { joinPath, useJoinStep } from '../join-step';

type Vis = 'all' | 'sum';
type More = 'assets' | 'loans' | 'none';
interface Fix {
  amount: number | null;
  vis: Vis;
  edit: boolean;
}

// P-06 내 명의 항목 확인, 추가(18 P-06). 시작한 사람이 대신 적은 내 명의 자산·부채를 항목마다 확인(‘맞아요’ / ‘고칠게요’)
// + 공개 범위(전체 / 합계만, 기본 합계만). 고친 값은 사실값이라 바로 반영, 추정 표시 해제.
// 이어서 “더 있는 돈이나 대출이 있나요?” → O-41~47(첫 주 정리와 같음, 끝나면 여기로) / ‘없어요’ → 다음(첫 주 ‘자산 정리하기’ 할 일 유지).
export function P06OwnItems() {
  const s = useJoinStep('p-06');
  const d = s.d;
  const nav = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const [fix, setFix] = useState<Record<string, Fix>>({});
  const [more, setMore] = useState<More | null>(null);
  useEffect(() => setWeekBack(null), []);
  if (!d.ready || !d.me || assets.isLoading) return null;
  const me = d.me;
  const mine: Asset[] = (assets.data ?? []).filter(
    (a) => a.owner === 'person' && a.owner_user_id === me.id && a.created_by !== me.id,
  );
  const asking = params.get('more') === '1' || mine.length === 0;

  if (asking) {
    const go = (m: More) => {
      if (m === 'none') return void s.done();
      setWeekBack(`${joinPath('p-06')}?more=1`);
      nav(m === 'assets' ? weekPath.assets : weekPath.loans);
    };
    return (
      <QuestionLayout
        steps={s.steps}
        title={copy.more}
        onBack={
          mine.length ? () => nav(joinPath('p-06'), { replace: true }) : (s.onBack ?? undefined)
        }
      >
        <ChoiceCards<More>
          label={copy.more}
          value={more}
          onChange={setMore}
          onPick={go}
          options={[
            { value: 'assets', label: copy.moreAssets },
            { value: 'loans', label: copy.moreLoans },
            { value: 'none', label: copy.none },
          ]}
        />
      </QuestionLayout>
    );
  }

  const of = (a: Asset): Fix =>
    fix[a.id] ?? { amount: a.amount, vis: a.visibility === 'all' ? 'all' : 'sum', edit: false };
  const put = (a: Asset, p: Partial<Fix>) => setFix((x) => ({ ...x, [a.id]: { ...of(a), ...p } }));
  const ready = mine.every((a) => (of(a).amount ?? 0) > 0);

  const save = () =>
    s.done(
      () =>
        Promise.all(
          mine.map((a) => {
            const f = of(a);
            return updateAsset(a.id, {
              amount: f.amount ?? a.amount,
              visibility: f.vis,
              estimated: false,
            });
          }),
        ).then(() => qc.invalidateQueries({ queryKey: qk.assets })),
      'p-06?more=1',
    );

  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.ownItems(d.couple?.partnerName ?? '', d.couple?.myName ?? '')}
      onBack={s.onBack}
      primary={{ label: copy.right, disabled: !ready, loading: s.saving }}
      onSubmit={() => ready && void save()}
    >
      <ul className="hg-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {mine.map((a) => {
          const f = of(a);
          return (
            <li key={a.id} className="hg-card hg-stack" aria-label={a.name}>
              <div className="hg-row" style={{ justifyContent: 'space-between' }}>
                <strong>{a.name}</strong>
                <span>
                  {formatWon(f.amount ?? a.amount)}
                  {a.estimated && !f.edit ? ` ${copy.estimatedTag}` : ''}
                </span>
              </div>
              {f.edit ? (
                <AmountInput
                  label={a.name}
                  value={f.amount}
                  onChange={(amount) => put(a, { amount })}
                />
              ) : (
                <Button variant="secondary" size="sm" onClick={() => put(a, { edit: true })}>
                  {copy.fix}
                </Button>
              )}
              <Tabs<Vis>
                variant="seg"
                label={`${a.name} ${copy.visLabel}`}
                value={f.vis}
                onChange={(vis) => put(a, { vis })}
                items={(['all', 'sum'] as const).map((v) => ({ value: v, label: copy.vis[v] }))}
              />
            </li>
          );
        })}
      </ul>
    </QuestionLayout>
  );
}
