import { qk, updateCareDay, type CareDay } from '@sweetwo/api';
import { dday, formatMonthDay, nextCareDate, quickChips, solarToLunar } from '@sweetwo/core';
import {
  AmountInput,
  Button,
  Chip,
  Field,
  ListRow,
  PageHeader,
  QuestionLayout,
  Tabs,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { syncFamilyGoal } from '../sync';
import { carerLabel, sideLabel, useCalendarData } from '../data';

const ALERTS = [30, 14, 7, 0];

/** 이번 회차 상태: 정한 날짜가 이번 회차와 다르면 ‘아직’ */
const statusOf = (c: CareDay, date: string | null) =>
  c.status_on && date && c.status_on === date ? c.status : 'todo';

// Y-05 챙길 날 상세(docs/spec/24-calendar.md): 제목 + 구분, 날짜(음력이면 “(음력 8월 3일)”), D-day, 쓸 돈(수정 → Q3),
// 챙길 사람, 반복, 준비 상황(아직 / 준비 중 / 다녀왔어요 → Y-08), 기록 없이 7일 지나면 ‘지남’ + ‘기록하기’,
// 작년에는(지난 회차 기록), 미리 알림 칩, 메모. 이름·날짜 수정, 명절 할 일 목록, 알림 보내기는 다음 단계.
export function Y05CareDay() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const c = useCalendarData();
  const { masked } = useMask();
  const m = (x: number) => money(x, masked);
  const [memo, setMemo] = useState<string | null>(null);
  if (c.loading) return <MainFrame current="calendar" columns={[null]} />;
  const care = c.cares.find((x) => x.id === id);
  if (!care) return <Navigate to="/calendar/list" replace />;
  const date = nextCareDate(care, c.today);
  const lunar = care.date_rule === 'lunar_yearly' && date ? solarToLunar(date) : null;
  const st = statusOf(care, date);
  const overdue = c.overdue.find((x) => x.care.id === care.id)?.date ?? null;
  const record = (on?: string) => nav(`/calendar/day/${care.id}/record/a${on ? `?on=${on}` : ''}`);
  // 작년에는(7번): 지난 회차 기록
  const last = c.records.find((r) => r.care_day_id === care.id && (!date || r.occurs_on < date));
  const lastGift = last
    ? (last.gift_name ??
      (last.gifts.includes('cash')
        ? copy.gifts.cash
        : last.gifts.includes('meal')
          ? copy.gifts.meal
          : null))
    : null;

  const patch = async (p: Parameters<typeof updateCareDay>[1]) => {
    try {
      await updateCareDay(care.id, p);
      await qc.invalidateQueries({ queryKey: qk.careDays });
    } catch {
      toast(copy.loadFailed);
    }
  };
  const names = c.names;

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={care.name} backLabel={copy.back} onBack={() => nav(-1)} />
      <section className="hg-card hg-stack" aria-label={care.name}>
        <span className="hg-card__label">{sideLabel(care, names)}</span>
        <b>
          {date ? formatMonthDay(date) : copy.noDate}
          {lunar && ` ${copy.lunarOf(lunar.month, lunar.day, lunar.leap)}`}
        </b>
        {date && <span className="hg-card__meta">{copy.dday(dday(c.today, date))}</span>}
      </section>
      <div className="hg-list">
        <ListRow
          label={copy.spend}
          sub={care.budget === 0 ? copy.zeroBudget : undefined}
          value={m(care.budget)}
          onClick={() => nav(`/calendar/day/${care.id}/budget`)}
        />
        <ListRow
          label={copy.repeat}
          value={care.date_rule === 'once' ? copy.repeatOnce : copy.repeatYearly}
        />
      </div>
      <section className="hg-stack" aria-label={copy.carerLabel}>
        <span className="hg-card__label">{copy.carerLabel}</span>
        <Tabs<CareDay['carer']>
          variant="seg"
          label={copy.carerLabel}
          value={care.carer}
          onChange={(carer) => void patch({ carer })}
          items={[
            { value: 'groom', label: names.groom },
            { value: 'bride', label: names.bride },
            { value: 'together', label: copy.together },
          ]}
        />
        <span className="hg-help">{carerLabel(care, names)}</span>
      </section>
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
            {(['todo', 'preparing', 'done'] as const).map((s) => (
              <Chip
                key={s}
                small
                selected={st === s}
                onClick={() =>
                  s === 'done' ? record() : void patch({ status: s, status_on: date })
                }
              >
                {copy.statuses[s]}
              </Chip>
            ))}
          </div>
        )}
      </section>
      {last && lastGift && (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.lastYear(lastGift, m(last.amount))}
        </p>
      )}
      <section className="hg-stack" aria-label={copy.alerts}>
        <span className="hg-card__label">{copy.alerts}</span>
        <div
          className="hg-row"
          role="group"
          aria-label={copy.alerts}
          style={{ gap: 'var(--space-2)' }}
        >
          {ALERTS.map((n) => {
            const on = care.alerts.includes(n);
            return (
              <Chip
                key={n}
                small
                selected={on}
                onClick={() =>
                  void patch({
                    alerts: on
                      ? care.alerts.filter((x) => x !== n)
                      : [...care.alerts, n].sort((a, b) => b - a),
                  })
                }
              >
                {copy.alertChip(n)}
              </Chip>
            );
          })}
        </div>
      </section>
      <Field
        label={copy.memo}
        value={memo ?? care.memo ?? ''}
        maxLength={200}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={() =>
          memo !== null && memo !== (care.memo ?? '') && void patch({ memo: memo.trim() || null })
        }
      />
    </div>
  );
  return <MainFrame current="calendar" columns={[body]} />;
}

/** Y-05 쓸 돈 수정(Q3) */
export function Y05Budget() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const c = useCalendarData();
  const [value, setValue] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  if (c.loading) return null;
  const care = c.cares.find((x) => x.id === id);
  if (!care) return <Navigate to="/calendar/list" replace />;
  const v = value === undefined ? care.budget : value;
  return (
    <QuestionLayout
      title={copy.budgetQ}
      help={care.name}
      onBack={() => nav(`/calendar/day/${care.id}`)}
      primary={{ label: copy.save, disabled: v === null, loading: saving }}
      onSubmit={async () => {
        if (v === null || saving) return;
        setSaving(true);
        try {
          await updateCareDay(care.id, { budget: v });
          await syncFamilyGoal(qc).catch(() => undefined);
          await qc.invalidateQueries({ queryKey: qk.careDays });
          nav(`/calendar/day/${care.id}`, { replace: true });
        } catch {
          toast(copy.loadFailed);
        } finally {
          setSaving(false);
        }
      }}
    >
      <AmountInput
        label={copy.budgetQ}
        value={v}
        onChange={setValue}
        quick={quickChips.small}
        allowZero
      />
    </QuestionLayout>
  );
}
