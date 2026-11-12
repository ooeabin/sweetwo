import { qk, restoreTrash, trashCareDay, updateCareDay, type CareDay } from '@sweetwo/api';
import { dday, formatMonthDay, nextCareDate, quickChips, solarToLunar } from '@sweetwo/core';
import {
  AmountInput,
  Button,
  Chip,
  Field,
  ListRow,
  Menu,
  PageHeader,
  QuestionLayout,
  StatBlock,
  QuestionSkeleton,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { careUndo, trackCareShared, useCalendarData } from '../data';
import { CalendarLoadError } from '../frame';
import { startCareEdit } from './y-07-care-add';

const ALERTS = [30, 14, 7, 0];

/** 이번 회차 상태: 정한 날짜가 이번 회차와 다르면 ‘아직’ */
const statusOf = (c: CareDay, date: string | null) =>
  c.status_on && date && c.status_on === date ? c.status : 'todo';

// Y-05 경조사 상세(24 Y-05, 재기획): 제목(이름, 날짜, 음력이면 “(음력 8월 3일)”, D-day) + ‘수정’(이름·날짜 → Y-07 화면),
// 금액 메모(수정 = Q3, 계산에 안 들어감), 반복, 준비 상황(아직 / 준비 중 / 다녀왔어요 → Y-08, 기록 없이 7일 지나면 ‘지남’ + ‘기록하기’),
// 미리 알림 칩, 작년에는(지난 회차 기록), 메모(두 사람이 같이 봄), ⋯ → 지우기(휴지통 + ‘되돌리기’).
export function Y05CareDay() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const c = useCalendarData();
  const { masked } = useMask();
  const m = (x: number) => money(x, masked);
  const [memo, setMemo] = useState<string | null>(null);
  // 준비 상황 칩을 저장하는 동안 누른 칩을 바로 고른 것으로(2026-11-06)
  const [picking, setPicking] = useState<'todo' | 'preparing' | null>(null);
  // 못 불러오면 목록으로 튕기지 않고 오류 카드 + ‘다시 시도’(2026-11-12 S9-02)
  if (c.failed) return <CareDayError onBack={() => nav(-1)} onRetry={c.retry} />;
  if (c.loading) return <LoadingFrame sub="detail" current={'calendar'} />;
  const care = c.cares.find((x) => x.id === id);
  if (!care) return <Navigate to="/calendar/list" replace />;
  const date = nextCareDate(care, c.today);
  const lunar = care.date_rule === 'lunar_yearly' && date ? solarToLunar(date) : null;
  const st = statusOf(care, date);
  const overdue = c.overdue.find((x) => x.care.id === care.id)?.date ?? null;
  const record = (on?: string) => nav(`/calendar/day/${care.id}/record/a${on ? `?on=${on}` : ''}`);
  // 작년에는(6번): 지난 회차 기록
  const last = c.records.find((r) => r.care_day_id === care.id && (!date || r.occurs_on < date));
  const lastGift = last
    ? (last.gift_name ??
      (last.gifts.includes('cash')
        ? copy.gifts.cash
        : last.gifts.includes('meal')
          ? copy.gifts.meal
          : null))
    : null;

  const refresh = () => qc.invalidateQueries({ queryKey: qk.careDays });
  type Patch = Parameters<typeof updateCareDay>[1];
  // 고치면 Toast “고쳤어요” + ‘되돌리기’(고치기 전 값, 2026-11-12 S9-04). 메모는 상대 알림이 가는 동작이라 shared_item_changed
  const patch = async (p: Patch, prev: Patch) => {
    try {
      await updateCareDay(care.id, p);
      await refresh();
      toast(copy.edited, careUndo(qc, care.id, prev));
      if ('memo' in p) trackCareShared(!!c.couple?.joined);
    } catch {
      toast(copy.loadFailed);
    }
  };
  const remove = async () => {
    try {
      await trashCareDay(care.id);
      await refresh();
      carryToast(copy.removed, {
        label: copy.undo,
        onClick: () => quietly(restoreTrash('care_day', care.id).then(refresh)),
      });
      nav('/calendar/list', { replace: true });
    } catch {
      toast(copy.loadFailed);
    }
  };

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={care.name}
        backLabel={copy.back}
        onBack={() => nav(-1)}
        action={
          <Menu
            label={copy.menu}
            actions={[
              {
                label: copy.edit,
                icon: 'pencil',
                onSelect: () => {
                  startCareEdit(care, c.today);
                  nav('/calendar/add/a');
                },
              },
              { label: copy.remove, icon: 'trash-2', danger: true, onSelect: () => void remove() },
            ]}
          />
        }
      />
      {/* 1 제목(2026-11-04): 이름은 머리에 있으니 카드는 큰 D-day + 날짜만 */}
      <section className="hg-card" aria-label={care.name}>
        <StatBlock
          as="div"
          big={date ? copy.dday(dday(c.today, date)) : undefined}
          sub={
            <>
              {date ? formatMonthDay(date) : copy.noDate}
              {lunar && ` ${copy.lunarOf(lunar.month, lunar.day, lunar.leap)}`}
            </>
          }
        />
      </section>
      <div className="hg-list">
        <ListRow
          label={copy.amountMemo}
          value={care.budget > 0 ? m(care.budget) : copy.noAmount}
          onClick={() => nav(`/calendar/day/${care.id}/budget`)}
        />
        <ListRow
          label={copy.repeat}
          value={care.date_rule === 'once' ? copy.repeatOnce : copy.repeatYearly}
        />
      </div>
      <section className="hg-stack" aria-label={copy.status}>
        <span className="hg-card__label">{copy.status}</span>
        {overdue ? (
          <div className="hg-row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
            <span className="hg-help">
              {copy.overdue}, {formatMonthDay(overdue)}
            </span>
            <Button variant="primary" size="sm" onClick={() => record(overdue)}>
              {copy.recordNow}
            </Button>
          </div>
        ) : (
          <div
            className="hg-row"
            role="group"
            aria-label={copy.status}
            style={{ gap: 'var(--space-2)' }}
          >
            {/* 2026-11-04 칩은 ‘아직’ ‘준비 중’만. ‘다녀왔어요’는 그날부터 아래 주 버튼(누르면 기록 화면이라 칩과 다르게) */}
            {(['todo', 'preparing'] as const).map((s) => (
              <Chip
                key={s}
                small
                selected={(picking ?? st) === s}
                onClick={() => {
                  if (picking) return;
                  setPicking(s);
                  void patch(
                    { status: s, status_on: date },
                    { status: care.status, status_on: care.status_on },
                  ).finally(() => setPicking(null));
                }}
              >
                {copy.statuses[s]}
              </Chip>
            ))}
          </div>
        )}
        {!overdue && date && date <= c.today && st !== 'done' && (
          <Button variant="primary" block onClick={() => record(date)}>
            {copy.statuses.done}
          </Button>
        )}
      </section>
      <section className="hg-stack" aria-label={copy.alerts}>
        <span className="hg-card__label">{copy.alerts}</span>
        {/* 2026-11-04 미리 알림은 체크 목록(여러 개 고름, iOS 미리 알림·Rodeo처럼) */}
        <div className="hg-list" role="group" aria-label={copy.alerts}>
          {ALERTS.map((n) => {
            const on = care.alerts.includes(n);
            return (
              <button
                key={n}
                type="button"
                role="checkbox"
                aria-checked={on}
                className="hg-listrow"
                onClick={() =>
                  void patch(
                    {
                      alerts: on
                        ? care.alerts.filter((x) => x !== n)
                        : [...care.alerts, n].sort((a, b) => b - a),
                    },
                    { alerts: care.alerts },
                  )
                }
              >
                <span />
                <span className="hg-listrow__text">
                  <span className="hg-listrow__label">{copy.alertRow(n)}</span>
                </span>
                <span className={on ? 'hg-check is-on' : 'hg-check'} aria-hidden="true" />
                <span />
              </button>
            );
          })}
        </div>
      </section>
      {last && lastGift && (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.lastYear(lastGift, m(last.amount))}
        </p>
      )}
      <Field
        label={copy.memo}
        placeholder={copy.dayMemoPlaceholder}
        value={memo ?? care.memo ?? ''}
        maxLength={200}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={() => {
          if (memo === null || memo === (care.memo ?? '')) return;
          void patch({ memo: memo.trim() || null }, { memo: care.memo }).then(() => setMemo(null));
        }}
      />
    </div>
  );
  return <MainFrame sub="detail" current="calendar" columns={[body]} />;
}

/** Y-05 금액 메모 수정(Q3, 비워 둘 수 있음) */
export function Y05Budget() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const c = useCalendarData();
  const [value, setValue] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  if (c.failed) return <CareDayError onBack={() => nav(`/calendar/day/${id}`)} onRetry={c.retry} />;
  if (c.loading) return <QuestionSkeleton />;
  const care = c.cares.find((x) => x.id === id);
  if (!care) return <Navigate to="/calendar/list" replace />;
  const v = value === undefined ? care.budget || null : value;
  return (
    <QuestionLayout
      title={copy.amountQ}
      help={care.name}
      onBack={() => nav(`/calendar/day/${care.id}`)}
      primary={{ label: copy.save, loading: saving }}
      onSubmit={async () => {
        if (saving) return;
        setSaving(true);
        try {
          const prev = care.budget;
          await updateCareDay(care.id, { budget: v ?? 0 });
          await qc.invalidateQueries({ queryKey: qk.careDays });
          // 2026-11-12 S9-04 Toast “고쳤어요” + ‘되돌리기’(고치기 전 금액 메모)
          if (prev !== (v ?? 0)) carryToast(copy.edited, careUndo(qc, care.id, { budget: prev }));
          nav(`/calendar/day/${care.id}`, { replace: true });
        } catch {
          toast(copy.loadFailed);
        } finally {
          setSaving(false);
        }
      }}
    >
      <AmountInput
        label={copy.amountQ}
        value={v}
        onChange={setValue}
        quick={quickChips.small}
        allowZero
      />
    </QuestionLayout>
  );
}

/** Y-05·금액 메모를 못 불러옴(2026-11-12 S9-02): 머리 ‘‹’ + 오류 카드 */
function CareDayError({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return (
    <MainFrame
      sub="detail"
      current="calendar"
      columns={[
        <div key="e" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
          <PageHeader title={copy.title} backLabel={copy.back} onBack={onBack} />
          <CalendarLoadError onRetry={onRetry} />
        </div>,
      ]}
    />
  );
}
