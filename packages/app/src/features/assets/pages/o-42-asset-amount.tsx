import { quickChips } from '@sweetwo/core';
import { AmountInput, Field, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { LUMP, pickOf, useWeek, weekPath } from '../week/week';

// O-42 자산 금액(Q3 반복 + 소유자 토글 나 / 배우자 / 같이, 기본 ‘나’): O-41에서 고른 것마다. 청약은 납입 회차 추가.
// ‘다음’ = 바로 저장. 마지막이면 ‘결혼 후 남은 목돈’을 골랐을 때 O-43, 아니면 할 일 끝냄.
export function O42AssetAmount() {
  const w = useWeek('assets');
  const n = Number(useParams().n ?? '1');
  const [saving, setSaving] = useState(false);
  const key = w.draft.picks[n - 1];
  if (!key) return <Navigate to={weekPath.assets} replace />;
  if (w.d.loading) return null;
  const pick = pickOf('assets', key);
  const item = w.itemOf(key);
  const title = copy.weekAssetAmount(pick?.name ?? '');
  const sub = key === 'subscription';
  const hasLump = w.draft.picks.includes(LUMP);
  const total = 1 + w.draft.picks.length + (hasLump ? 1 : 0);

  const next = async () => {
    if (saving || (item?.amount ?? null) === null) return;
    setSaving(true);
    try {
      await w.save(key, {});
      if (n < w.draft.picks.length) w.nav(weekPath.asset(n + 1));
      else if (hasLump) w.nav(weekPath.lump);
      else {
        await w.finish();
        toast(copy.weekAssetsDone);
        w.nav('/', { replace: true });
      }
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      steps={{ total, now: n }}
      title={title}
      help={copy.weekCount(pick?.name ?? '', n, w.draft.picks.length)}
      onBack={() => w.nav(n > 1 ? weekPath.asset(n - 1) : weekPath.assets)}
      later={{ label: copy.weekClose, onClick: w.close }}
      primary={{ label: copy.next, disabled: (item?.amount ?? null) === null, loading: saving }}
      onSubmit={() => void next()}
    >
      {w.toggle(key)}
      <AmountInput
        key={key}
        label={title}
        value={item?.amount ?? null}
        onChange={(amount) => w.setItem(key, { amount })}
        quick={key === 'real_estate' ? quickChips.big : quickChips.small}
        allowZero
      />
      {sub && (
        <Field
          label={copy.paidCount}
          inputMode="numeric"
          value={item?.paidCount ?? ''}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
            w.setItem(key, { paidCount: v ? Number(v) : null });
          }}
          help={copy.paidCountUnit}
        />
      )}
    </QuestionLayout>
  );
}
