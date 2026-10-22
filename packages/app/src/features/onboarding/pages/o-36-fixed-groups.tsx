import { insertFixedExpenses, trashFixedExpenses } from '@sweetwo/api';
import { fixedGroupByKey, fixedGroups } from '@sweetwo/core';
import { Chip, QuestionLayout, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveSpace, useFixedExpenses, type FixedExpense } from '../data';
import { useStep } from '../step';

const CUSTOM = 'custom';
type Row = Pick<FixedExpense, 'group_key' | 'name' | 'burden' | 'sort'>;
/** 고른 그룹 → 고른 세부 항목(비면 그룹만) */
type Picks = Record<string, string[]>;

function picksFrom(rows: FixedExpense[]): { picks: Picks; custom: string[] } {
  const picks: Picks = {};
  const custom: string[] = [];
  for (const r of rows) {
    if (r.group_key === CUSTOM) {
      custom.push(r.name);
      continue;
    }
    const g = fixedGroupByKey(r.group_key);
    if (!g) continue;
    const items = (picks[g.key] ??= []);
    if (r.name !== g.name) items.push(r.name);
  }
  return { picks, custom };
}

function rowsFrom(picks: Picks, custom: string[]): Row[] {
  const rows: Row[] = [];
  for (const g of fixedGroups) {
    const items = picks[g.key];
    if (!items) continue;
    if (!items.length)
      rows.push({ group_key: g.key, name: g.name, burden: 'shared', sort: rows.length });
    else
      g.items
        .filter((it) => items.includes(it.name))
        .forEach((it) =>
          rows.push({ group_key: g.key, name: it.name, burden: it.burden, sort: rows.length }),
        );
  }
  custom.forEach((name) =>
    rows.push({ group_key: CUSTOM, name, burden: 'shared', sort: rows.length }),
  );
  return rows;
}

const keyOf = (r: Pick<Row, 'group_key' | 'name'>) => `${r.group_key}/${r.name}`;

// O-36 공동 고정지출 그룹 칩(Q2, 3열) + 고른 그룹 아래 세부 항목. 합계는 O-36t, 항목별 금액은 첫 주 4일째(O-37).
export function O36FixedGroups() {
  const s = useStep('o-36');
  const fixed = useFixedExpenses();
  const [state, setState] = useState<{ picks: Picks; custom: string[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  if (!s.ready || fixed.isLoading) return null;
  const existing = fixed.data ?? [];
  const cur = state ?? picksFrom(existing);
  const n = Object.keys(cur.picks).length + cur.custom.length;

  const toggleGroup = (key: string) => {
    // 그룹 해제: 그 그룹 세부 항목만 지움(합계는 그대로)
    const picks: Picks = cur.picks[key]
      ? Object.fromEntries(Object.entries(cur.picks).filter(([k]) => k !== key))
      : { ...cur.picks, [key]: [] };
    setState({ ...cur, picks });
  };
  const toggleItem = (key: string, name: string) => {
    const items = cur.picks[key] ?? [];
    const next = items.includes(name) ? items.filter((x) => x !== name) : [...items, name];
    setState({ ...cur, picks: { ...cur.picks, [key]: next } });
  };
  const addCustom = () => {
    const name = draft.trim();
    if (name && !cur.custom.includes(name)) setState({ ...cur, custom: [...cur.custom, name] });
    setDraft('');
    setAdding(false);
  };

  /** 고른 대로 항목 맞추기(바뀐 것만 지우고 넣음) */
  const sync = async (want: Row[]) => {
    const wantKeys = new Set(want.map(keyOf));
    const haveKeys = new Set(existing.map(keyOf));
    await trashFixedExpenses(existing.filter((r) => !wantKeys.has(keyOf(r))).map((r) => r.id));
    await insertFixedExpenses(want.filter((r) => !haveKeys.has(keyOf(r))));
    await fixed.refetch();
  };

  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.fixedGroups}
      help={copy.fixedGroupsHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: n === 0, loading: s.saving }}
      onSubmit={() =>
        void s.done(async () => {
          await sync(rowsFrom(cur.picks, cur.custom));
          // ‘해당 없어요’ 뒤에 다시 골랐으면 합계를 다시 묻는다
          if (s.state.space?.fixed_total === 0) await saveSpace({ fixed_total: null });
        })
      }
    >
      <div
        role="group"
        aria-label={copy.fixedGroups}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}
      >
        {fixedGroups.map((g) => (
          <Chip
            key={g.key}
            selected={!!cur.picks[g.key]}
            onClick={() => toggleGroup(g.key)}
            style={{ justifyContent: 'center' }}
          >
            {g.name}
          </Chip>
        ))}
        <Chip
          selected={adding || cur.custom.length > 0}
          onClick={() => setAdding((a) => !a)}
          style={{ justifyContent: 'center' }}
        >
          {copy.addOwn}
        </Chip>
      </div>

      {fixedGroups
        .filter((g) => cur.picks[g.key])
        .map((g) => (
          <div key={g.key} className="hg-quick" role="group" aria-label={g.name}>
            {g.items.map((it) => (
              <Chip
                key={it.name}
                small
                selected={(cur.picks[g.key] ?? []).includes(it.name)}
                onClick={() => toggleItem(g.key, it.name)}
              >
                {it.name}
              </Chip>
            ))}
          </div>
        ))}

      {cur.custom.length > 0 && (
        <div className="hg-quick" role="group" aria-label={copy.addOwn}>
          {cur.custom.map((name) => (
            <Chip
              key={name}
              small
              selected
              onClick={() => setState({ ...cur, custom: cur.custom.filter((x) => x !== name) })}
            >
              {name}
            </Chip>
          ))}
        </div>
      )}

      {adding && (
        <div
          className="hg-row"
          style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault(); // 폼 ‘다음’ 대신 추가
            addCustom();
          }}
        >
          <div style={{ flex: 1 }}>
            <ShortText
              label={copy.addOwn}
              value={draft}
              onChange={setDraft}
              max={20}
              placeholder={copy.addOwnPlaceholder}
            />
          </div>
          <button
            type="button"
            className="hg-btn hg-btn--secondary"
            disabled={!draft.trim()}
            onClick={addCustom}
          >
            {copy.add}
          </button>
        </div>
      )}

      <p className="hg-q__help" aria-live="polite" style={{ margin: 0 }}>
        {n > 0 ? copy.picked(n) : ''}
      </p>
      <button
        type="button"
        className="hg-btn hg-btn--link"
        style={{ alignSelf: 'flex-start' }}
        onClick={() =>
          void s.done(
            async () => {
              await sync([]);
              await saveSpace({ fixed_total: 0, fixed_total_estimated: false });
            },
            () => 'o-38',
          )
        }
      >
        {copy.noneApply}
      </button>
    </QuestionLayout>
  );
}
