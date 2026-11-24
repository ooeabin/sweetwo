import { AssetForbiddenError, settleMatured } from '@sweetwo/api';
import { todayKst } from '@sweetwo/core';
import {
  Chip,
  DateWheel,
  FormHero,
  FormScreen,
  FormSection,
  QuestionSkeleton,
  SegChoice,
} from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { canEdit, useAssetsData, useRefreshAssets } from '../data';

// F-04a 만기 금액 정리(23 F-04 아래 ‘만기일 당일’, 2026-11-24 한 화면 입력 FormScreen): 만기일 당일 알림·홈 할 일에서 들어옴.
// 맨 위 요약 문장(“청년 적금 / 960만 원 정리할까요?”) + “만기 금액은 어디로 옮겼어요?”(다른 통장으로 / 다시 가입했어요)
//   + 해당 섹션: 다른 통장으로 → “어느 통장으로 옮겼어요?” 통장 칩(그 통장 + 만기 금액, 이 항목은 ‘만기 완료’로 보관)
//   / 다시 가입했어요 → “새 만기일” 날짜 휠(F-03f와 같은 휠). 아래 “정리하기”. 고칠 수 있는 사람만, 만기 전이면 F-04로(옛 주소로 들어온 경우)
const pad = (n: number) => String(n).padStart(2, '0');
const ymdOf = (s: string) => ({
  y: Number(s.slice(0, 4)),
  m: Number(s.slice(5, 7)),
  d: Number(s.slice(8, 10)),
});

type How = 'to' | 'date';

export function F04aMatured() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const [how, setHow] = useState<How>('to');
  const [toSel, setToSel] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (d.loading) return <QuestionSkeleton />;
  const a = d.items.find((x) => x.id === id);
  if (!a || !canEdit(a, d.me?.id) || a.side !== 'asset') return <Navigate to="/assets" replace />;
  const today = todayKst();
  if (!a.maturity_date || a.maturity_date > today)
    return <Navigate to={`/assets/${a.id}`} replace />;
  const targets = d.items.filter(
    (x) =>
      x.id !== a.id &&
      x.side === 'asset' &&
      (x.grp === 'cash' || x.grp === 'deposit') &&
      canEdit(x, d.me?.id),
  );
  const sel = toSel ?? targets[0]?.id ?? null;
  const target = targets.find((x) => x.id === sel);
  const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  const picked = date ?? nextYear;
  const dateOk = picked > today;
  const ready = how === 'to' ? !!target : dateOk;

  const save = async () => {
    if (busy || !ready) return;
    setBusy(true);
    try {
      await settleMatured(a.id, how === 'to' && target ? { to: target.id } : { newDate: picked });
      // 옮긴 뒤 새로 읽기(만기 완료 항목이 목록에서 빠져도 이 화면의 확인에 걸리지 않게)
      carryToast(copy.maturedDone);
      nav(how === 'to' && target ? `/assets/${target.id}` : `/assets/${a.id}`, { replace: true });
      await refresh();
    } catch (e) {
      // 13 공통 상태 10번·8번(2026-11-12 S8-16)
      toast(
        e instanceof AssetForbiddenError
          ? copy.readOnly(d.couple?.partnerName ?? '')
          : copy.saveFailed,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title={copy.maturedSettle}
      onBack={() => nav(`/assets/${a.id}`)}
      hero={
        <FormHero
          lines={[
            [{ text: a.name }],
            [{ text: m(a.amount), tone: 'accent' }, { text: ` ${copy.maturedHero}` }],
          ]}
        />
      }
      primary={{ label: copy.maturedDo, disabled: !ready, loading: busy }}
      onSubmit={() => void save()}
    >
      <FormSection title={copy.maturedTitle}>
        <SegChoice<How>
          label={copy.maturedTitle}
          items={[
            { value: 'to', label: copy.maturedMoved },
            { value: 'date', label: copy.maturedRejoin },
          ]}
          value={how}
          onChange={setHow}
        />
      </FormSection>
      {how === 'to' ? (
        <FormSection title={copy.maturedPick}>
          {targets.length ? (
            <>
              <div className="hg-form__chips" role="group" aria-label={copy.maturedPick}>
                {targets.map((x) => (
                  <Chip key={x.id} small selected={sel === x.id} onClick={() => setToSel(x.id)}>
                    {x.name}
                  </Chip>
                ))}
              </div>
              {target && (
                <p className="hg-form__hint">
                  {copy.soldToLine(target.name, m(target.amount), m(target.amount + a.amount))}
                </p>
              )}
            </>
          ) : (
            <p className="hg-form__hint">{copy.maturedNoAccount}</p>
          )}
        </FormSection>
      ) : (
        <FormSection title={copy.maturedDateQ}>
          {/* 2026-11-04 다른 날짜 질문과 같은 휠(처음 값 1년 뒤 오늘) */}
          <DateWheel
            label={copy.maturedDateQ}
            value={date ? ymdOf(date) : null}
            initial={ymdOf(nextYear)}
            minYear={Number(today.slice(0, 4))}
            maxYear={Number(today.slice(0, 4)) + 40}
            onChange={(v) => setDate(`${v.y}-${pad(v.m)}-${pad(v.d)}`)}
          />
          {date && !dateOk && <p className="hg-help is-error">{copy.maturedDateError}</p>}
        </FormSection>
      )}
    </FormScreen>
  );
}
