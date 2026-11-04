import { settleMatured } from '@sweetwo/api';
import { todayKst } from '@sweetwo/core';
import { ChoiceCards, DateWheel, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { canEdit, useAssetsData, useRefreshAssets } from '../data';

const path = (id: string, step?: 'to' | 'date') => `/assets/${id}/matured${step ? `/${step}` : ''}`;

// F-04a 만기된 돈 정리(23 F-04 아래 ‘만기일 당일’): 만기일 당일 알림·홈 할 일에서 들어옴.
// a “만기된 돈은 어디로 옮겼어요?” 다른 통장으로 → 통장 고르기(그 통장 + 만기 금액, 이 항목은 ‘만기 완료’로 보관)
//   / 다시 가입했어요 → 새 만기일(F-03f와 같은 질문). 고칠 수 있는 사람만, 만기 전이면 F-04로(옛 주소로 들어온 경우)
const pad = (n: number) => String(n).padStart(2, '0');
const ymdOf = (s: string) => ({
  y: Number(s.slice(0, 4)),
  m: Number(s.slice(5, 7)),
  d: Number(s.slice(8, 10)),
});

export function F04aMatured() {
  const { id = '', step } = useParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const { masked } = useMask();
  const [date, setDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (d.loading) return null;
  const a = d.items.find((x) => x.id === id);
  if (!a || !canEdit(a, d.me?.id) || a.side !== 'asset') return <Navigate to="/assets" replace />;
  const today = todayKst();
  if (!a.maturity_date || a.maturity_date > today)
    return <Navigate to={`/assets/${a.id}`} replace />;
  const save = async (how: { to: string } | { newDate: string }) => {
    if (busy) return;
    setBusy(true);
    try {
      await settleMatured(a.id, how);
      await refresh();
      toast(copy.maturedDone);
      nav('to' in how ? `/assets/${how.to}` : `/assets/${a.id}`, { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setBusy(false);
    }
  };
  const progress = { total: 2, now: step ? 1 : 0, fill: 50 };

  if (step === 'to') {
    const targets = d.items.filter(
      (x) =>
        x.id !== a.id &&
        x.side === 'asset' &&
        (x.grp === 'cash' || x.grp === 'deposit') &&
        canEdit(x, d.me?.id),
    );
    return (
      <QuestionLayout steps={progress} title={copy.maturedPick} onBack={() => nav(path(a.id))}>
        {targets.length ? (
          <ChoiceCards<string>
            label={copy.maturedPick}
            value={null}
            onChange={() => undefined}
            onPick={(to) => void save({ to })}
            options={targets.map((x) => ({
              value: x.id,
              label: x.name,
              sub: `${money(x.amount, masked)} → ${money(x.amount + a.amount, masked)}`,
            }))}
          />
        ) : (
          <p className="hg-help">{copy.maturedNoAccount}</p>
        )}
      </QuestionLayout>
    );
  }

  if (step === 'date') {
    const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
    const picked = date ?? nextYear;
    const ok = picked > today;
    return (
      <QuestionLayout
        steps={progress}
        title={copy.maturity}
        onBack={() => nav(path(a.id))}
        primary={{ label: copy.saveEdit, disabled: !ok, loading: busy }}
        onSubmit={() => ok && void save({ newDate: picked })}
      >
        {/* 2026-11-04 다른 날짜 질문과 같은 휠(처음 값 1년 뒤 오늘) */}
        <DateWheel
          label={copy.maturity}
          value={date ? ymdOf(date) : null}
          initial={ymdOf(nextYear)}
          minYear={Number(today.slice(0, 4))}
          maxYear={Number(today.slice(0, 4)) + 40}
          onChange={(v) => setDate(`${v.y}-${pad(v.m)}-${pad(v.d)}`)}
        />
        {date && !ok && <p className="hg-help is-error">{copy.maturedDateError}</p>}
      </QuestionLayout>
    );
  }

  type H = 'to' | 'date';
  return (
    <QuestionLayout
      steps={progress}
      title={copy.maturedTitle}
      onBack={() => nav(`/assets/${a.id}`)}
    >
      <ChoiceCards<H>
        label={copy.maturedTitle}
        value={null}
        onChange={() => undefined}
        onPick={(h) => nav(path(a.id, h))}
        options={[
          { value: 'to', label: copy.maturedMoved, sub: `${a.name} ${money(a.amount, masked)}` },
          { value: 'date', label: copy.maturedRejoin },
        ]}
      />
    </QuestionLayout>
  );
}
