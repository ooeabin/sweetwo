import {
  insertCareDays,
  insertFamily,
  qk,
  updateCareDay,
  updateFamily,
  type CareDay,
  type FamilyMember,
} from '@sweetwo/api';
import { firstBirthday, milestones } from '@sweetwo/core';
import { Chip, ChoiceCards, QuestionLayout, ShortText } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { create } from 'zustand';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { syncFamilyGoal } from '../sync';
import { useCalendarData } from '../data';
import { badMonthDay, MonthDayFields, type MonthDay } from '../date-fields';

// Y-03 가족 추가·수정(docs/spec/24-calendar.md 화면별 정의): a 어느 쪽 → b 누구 → c 호칭(추천 칩) → d 생일(양력/음력, 태어난 해 선택)
// → d2 칠순·팔순 세는 방식(태어난 해를 넣었을 때) → e 또 챙길 날(결혼기념일 / 제사 / 없어요) → e2 그 날짜 → f 메모.
// 저장: 가족 + 생일(생신) 챙길 날 + 태어난 해가 있으면 환갑·칠순·팔순(한 번), 조카는 돌(태어난 날 + 1년) + 고른 날(매년).
// 수정(`/calendar/family/:id`)은 c·d·d2·f만, 없는 자동 챙길 날만 새로 만듦. ‘2년 전 목표로 미리 모아볼까요?’는 다음 단계.

type Side = 'groom' | 'bride';
type Relation = FamilyMember['relation'];
type Extra = 'parents_anniversary' | 'jesa' | 'none';
interface Draft extends MonthDay {
  id: string | null;
  side: Side | null;
  relation: Relation | null;
  title: string;
  year: number | null;
  koreanAge: boolean;
  extra: Extra | null;
  extraDate: MonthDay;
  memo: string;
}
const blank: MonthDay = { month: null, day: null, lunar: false, leap: false };
const start = (): Draft => ({
  ...blank,
  id: null,
  side: null,
  relation: null,
  title: '',
  year: null,
  koreanAge: true,
  extra: null,
  extraDate: blank,
  memo: '',
});
const fromMember = (m: FamilyMember): Draft => ({
  ...start(),
  id: m.id,
  side: m.side,
  relation: m.relation,
  title: m.title,
  month: m.birth_month,
  day: m.birth_day,
  lunar: m.birth_lunar,
  leap: m.birth_leap,
  year: m.birth_year,
  koreanAge: m.korean_age,
  memo: m.memo ?? '',
});
const useDraft = create<{ d: Draft; set: (p: Partial<Draft>) => void; load: (d: Draft) => void }>(
  (set, get) => ({
    d: start(),
    set: (p) => set({ d: { ...get().d, ...p } }),
    load: (d) => set({ d }),
  }),
);
/** 가족 추가 시작(Y-01 8번 ‘추가’) */
export const startFamilyAdd = () => useDraft.getState().load(start());

const RELATIONS: Relation[] = [
  'parent',
  'grandparent',
  'sibling',
  'sibling_spouse',
  'nephew',
  'other',
];
/** 추천 호칭 칩: 내 쪽 / 배우자 쪽(보는 사람이 신랑인지 신부인지) [확인 필요] */
function titleChips(relation: Relation | null, own: boolean, iAmBride: boolean): string[] {
  switch (relation) {
    case 'parent':
      return own
        ? ['아버지', '어머니']
        : iAmBride
          ? ['시아버지', '시어머니']
          : ['장인어른', '장모님'];
    case 'grandparent':
      return ['할아버지', '할머니', '외할아버지', '외할머니'];
    case 'sibling':
      return own
        ? ['형', '오빠', '누나', '언니', '동생']
        : iAmBride
          ? ['아주버님', '도련님', '아가씨', '형님']
          : ['처형', '처남', '처제'];
    case 'sibling_spouse':
      return own
        ? ['형수님', '매형', '형부', '제부', '올케', '제수씨']
        : ['형님', '동서', '처남댁'];
    case 'nephew':
      return ['조카'];
    default:
      return [];
  }
}

export function Y03Family() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id, step: stepParam } = useParams();
  const c = useCalendarData();
  const { d, set, load } = useDraft();
  const [saving, setSaving] = useState(false);
  const member = id ? c.family.find((m) => m.id === id) : undefined;
  const editing = !!id;
  // 수정: 그 가족으로 채움
  useEffect(() => {
    if (member && d.id !== member.id) load(fromMember(member));
  }, [member, d.id, load]);

  if (c.loading) return null;
  if (editing && !member) return <Navigate to="/calendar/list" replace />;
  if (editing && d.id !== id) return null;

  const year = Number(c.today.slice(0, 4));
  const yearBad = d.year !== null && (d.year < 1900 || d.year > year);
  const steps = editing
    ? ['c', 'd', ...(d.year !== null ? ['d2'] : []), 'f']
    : [
        'a',
        'b',
        'c',
        'd',
        ...(d.year !== null ? ['d2'] : []),
        'e',
        ...(d.extra && d.extra !== 'none' ? ['e2'] : []),
        'f',
      ];
  const step = stepParam ?? steps[0] ?? 'a';
  const i = Math.max(steps.indexOf(step), 0);
  const progress = { total: steps.length, now: i };
  const base = editing ? `/calendar/family/${id}` : '/calendar/family/new';
  const go = (n: number) => nav(`${base}/${steps[n] ?? steps[0]}`);
  const back = () => (i > 0 ? go(i - 1) : nav(-1));
  const sideName = (s: Side) => copy.side(s === 'groom' ? c.names.groom : c.names.bride);
  const iAmBride = c.me?.side === 'bride';

  /** 저장: 가족 + 자동 챙길 날(없는 것만) */
  const save = async (o: Partial<Draft> = {}) => {
    const d = { ...useDraft.getState().d, ...o };
    if (saving || !d.side || !d.relation) return;
    setSaving(true);
    try {
      const row = {
        title: d.title.trim(),
        birth_month: d.month,
        birth_day: d.day,
        birth_lunar: d.lunar,
        birth_leap: d.leap,
        birth_year: d.year,
        korean_age: d.koreanAge,
        memo: d.memo.trim() || null,
      };
      let memberId = d.id;
      if (memberId) await updateFamily(memberId, row);
      else {
        const sort = Math.max(-1, ...c.family.map((m) => m.sort)) + 1;
        [memberId = null] = await insertFamily([
          { ...row, side: d.side, relation: d.relation, sort },
        ]);
      }
      if (!memberId) throw new Error('no id');
      const mine = c.cares.filter((x) => x.member_id === memberId);
      const has = (kind: string) => mine.find((x) => x.kind === kind);
      const elder = d.relation === 'parent' || d.relation === 'grandparent';
      const common = { category: 'family' as const, member_id: memberId, side: d.side };
      const rows: Parameters<typeof insertCareDays>[0] = [];
      // 생일: 있으면 날짜·이름만 고침
      if (d.month !== null && d.day !== null) {
        const bd = {
          name: elder ? copy.names.birthday(row.title) : copy.names.birthdayPlain(row.title),
          date_rule: d.lunar ? ('lunar_yearly' as const) : ('solar_yearly' as const),
          month: d.month,
          day: d.day,
          leap: d.leap,
        };
        const cur: CareDay | undefined = has('birthday');
        if (cur) await updateCareDay(cur.id, bd);
        else
          rows.push({
            ...common,
            ...bd,
            kind: 'birthday',
            carer: d.side,
            budget: d.relation === 'parent' ? c.unitOf('birthday') : 0,
          });
      }
      const mm = { ...row, birth_year: d.year };
      for (const x of milestones(mm, c.today))
        if (!has(x.kind))
          rows.push({
            ...common,
            kind: x.kind,
            name: copy.names.of(row.title, copy.names.milestone[x.kind]),
            date_rule: 'once',
            once_on: x.date,
          });
      const dol = d.relation === 'nephew' ? firstBirthday(mm, c.today) : null;
      if (dol && !has('dol'))
        rows.push({
          ...common,
          kind: 'dol',
          name: copy.names.dol(row.title),
          date_rule: 'once',
          once_on: dol,
        });
      const e = d.extraDate;
      if (d.extra && d.extra !== 'none' && e.month !== null && e.day !== null)
        rows.push({
          ...common,
          kind: d.extra,
          name: copy.names.of(row.title, copy.extras[d.extra]),
          date_rule: e.lunar ? 'lunar_yearly' : 'solar_yearly',
          month: e.month,
          day: e.day,
          leap: e.leap,
          budget: c.unitOf(d.extra),
        });
      await insertCareDays(rows);
      await syncFamilyGoal(qc).catch(() => undefined);
      await Promise.all([qk.family, qk.careDays].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(editing ? copy.familyEdited : copy.familySaved);
      load(start());
      nav('/calendar/list', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  const nextOrSave = () => (i === steps.length - 1 ? void save() : go(i + 1));

  if (step === 'a')
    return (
      <QuestionLayout steps={progress} title={copy.familySideQ} onBack={back}>
        <ChoiceCards<Side>
          label={copy.familySideQ}
          value={d.side}
          onChange={(side) => set({ side })}
          onPick={() => go(i + 1)}
          options={(['groom', 'bride'] as const).map((s) => ({ value: s, label: sideName(s) }))}
        />
      </QuestionLayout>
    );

  if (step === 'b')
    return (
      <QuestionLayout steps={progress} title={copy.familyWhoQ} onBack={back}>
        <ChoiceCards<Relation>
          label={copy.familyWhoQ}
          value={d.relation}
          onChange={(relation) => set({ relation, title: '' })}
          onPick={() => go(i + 1)}
          options={RELATIONS.map((r) => ({ value: r, label: copy.relations[r] }))}
        />
      </QuestionLayout>
    );

  if (step === 'c') {
    const chips = titleChips(d.relation, d.side === c.me?.side, iAmBride);
    const ok = !!d.title.trim();
    return (
      <QuestionLayout
        steps={progress}
        title={copy.titleQ}
        onBack={back}
        primary={{ label: copy.nextStep, disabled: !ok }}
        onSubmit={() => ok && go(i + 1)}
      >
        <ShortText
          label={copy.titleLabel}
          value={d.title}
          onChange={(title) => set({ title })}
          max={15}
        />
        {!!chips.length && (
          <div className="hg-row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {chips.map((t) => (
              <Chip key={t} small selected={d.title === t} onClick={() => set({ title: t })}>
                {t}
              </Chip>
            ))}
          </div>
        )}
      </QuestionLayout>
    );
  }

  if (step === 'd') {
    const half = (d.month === null) !== (d.day === null);
    const bad = badMonthDay(d) || yearBad || half;
    return (
      <QuestionLayout
        steps={progress}
        title={copy.birthdayQ3}
        help={d.title}
        onBack={back}
        later={{
          label: copy.notApplicable,
          onClick: () => {
            set({ ...blank, year: null });
            // 태어난 해가 없으니 d2 없이 다음
            const s = steps.filter((x) => x !== 'd2');
            nav(`${base}/${s[s.indexOf('d') + 1] ?? 'f'}`);
          },
        }}
        primary={{ label: copy.nextStep, disabled: d.month === null || bad }}
        onSubmit={() => d.month !== null && !bad && nextOrSave()}
      >
        <MonthDayFields
          label={copy.birthdayQ3}
          value={d}
          onChange={set}
          year={{
            value: d.year,
            onChange: (v) => set({ year: v }),
            error: yearBad ? copy.yearError : undefined,
          }}
        />
      </QuestionLayout>
    );
  }

  if (step === 'd2')
    return (
      <QuestionLayout steps={progress} title={copy.ageQ} onBack={back}>
        <ChoiceCards<'korean' | 'intl'>
          label={copy.ageQ}
          value={d.koreanAge ? 'korean' : 'intl'}
          onChange={(v) => set({ koreanAge: v === 'korean' })}
          onPick={() => go(i + 1)}
          options={[
            { value: 'korean', label: copy.ageKorean },
            { value: 'intl', label: copy.ageIntl },
          ]}
        />
      </QuestionLayout>
    );

  if (step === 'e')
    return (
      <QuestionLayout steps={progress} title={copy.extraQ} onBack={back}>
        <ChoiceCards<Extra>
          label={copy.extraQ}
          value={d.extra}
          onChange={(extra) => set({ extra, extraDate: blank })}
          onPick={(extra) => nav(`${base}/${extra === 'none' ? 'f' : 'e2'}`)}
          options={(['parents_anniversary', 'jesa', 'none'] as const).map((x) => ({
            value: x,
            label: copy.extras[x],
          }))}
        />
      </QuestionLayout>
    );

  if (step === 'e2' && d.extra && d.extra !== 'none') {
    const e = d.extraDate;
    const title = copy.extraDateQ(d.title, copy.extras[d.extra]);
    const ok = e.month !== null && e.day !== null && !badMonthDay(e);
    return (
      <QuestionLayout
        steps={progress}
        title={title}
        onBack={back}
        primary={{ label: copy.nextStep, disabled: !ok }}
        onSubmit={() => ok && go(i + 1)}
      >
        <MonthDayFields
          label={title}
          value={e}
          onChange={(p) => set({ extraDate: { ...e, ...p } })}
        />
      </QuestionLayout>
    );
  }

  if (step === 'f')
    return (
      <QuestionLayout
        steps={progress}
        title={copy.memoQ}
        help={d.title}
        onBack={back}
        later={editing ? undefined : { label: copy.skip, onClick: () => void save({ memo: '' }) }}
        primary={{ label: editing ? copy.save : copy.addOk, loading: saving }}
        onSubmit={() => void save()}
      >
        <ShortText label={copy.memo} value={d.memo} onChange={(memo) => set({ memo })} max={200} />
      </QuestionLayout>
    );

  return <Navigate to={`${base}/${steps[0]}`} replace />;
}
