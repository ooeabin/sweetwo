import { saveAccounts, trashAccounts } from '@sweetwo/api';
import {
  DEFAULT_ALLOWANCE,
  formatManWon,
  quickChips,
  splitShares,
  type BaseDay,
  type PlanParts,
} from '@sweetwo/core';
import { AmountInput, ChoiceCards, QuestionLayout, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveSpace, useAccounts, useRefresh, type Account } from '../data';
import { partnerJoined } from '../flow';
import { baseDayOf, monthlyParts, result, roleOfPart, splitOf } from '../result';
import { BaseDayEditor, TempNote } from '../result-parts';
import { onboardingPath, useStep } from '../step';

type Mode = 'single' | 'roles';
type Pick = 'existing' | 'new';
type Role = Account['role'];
interface Row {
  pick: Pick | null;
  name: string;
  balance: number | null;
}

const ODD = 100_000_000; // 잔액 1억 원 초과면 한 번 확인
const perMonth = (v: number) => copy.perMonth(formatManWon(v));

export const saveBaseDay = (d: BaseDay) =>
  saveSpace(
    d === 'last' ? { base_day: null, base_day_last: true } : { base_day: d, base_day_last: false },
  );

// O-63 통장 구조. 먼저 ‘통장 하나로 / 역할별로’. 역할별이면 공동 통장 3개마다 쓰던 통장(이름 + 잔액) / 새로 만들 통장(0원).
// 각자 관리 예비부부는 결혼 준비 통장 하나. 금액을 누르면 그 질문으로 갔다가 돌아온다.
export function O63Accounts() {
  const s = useStep('o-63');
  const nav = useNavigate();
  const refresh = useRefresh();
  const accounts = useAccounts();
  const ok = useConfirmOnce();
  const [mode, setMode] = useState<Mode | null | undefined>(undefined);
  const [rows, setRows] = useState<Partial<Record<Role, Row>>>({});
  if (!s.ready || !s.state.space || accounts.isLoading) return null;

  const sp = s.state.space;
  const r = result(s.state);
  const separate = r.separate;
  const parts = monthlyParts(s.state);
  const existing = accounts.data ?? [];
  const curMode: Mode | null = separate
    ? 'roles'
    : mode === undefined
      ? (sp.account_mode ?? null)
      : mode;
  const keys = (
    separate ? ['goalFund'] : ['living', 'goalFund', 'emergency']
  ) as (keyof PlanParts)[];
  const roles = keys.map((k) => ({ key: k, role: roleOfPart(k, separate) as Role }));

  const rowOf = (role: Role): Row => {
    const cur = rows[role];
    if (cur) return cur;
    const a = existing.find((x) => x.role === role);
    return a
      ? {
          pick: a.is_existing ? 'existing' : 'new',
          name: a.is_existing ? a.name : '',
          balance: a.start_balance,
        }
      : { pick: null, name: '', balance: null };
  };
  const setRow = (role: Role, patch: Partial<Row>) => {
    setRows({ ...rows, [role]: { ...rowOf(role), ...patch } });
    ok.reset();
  };
  const edit = (id: string) => nav(`${onboardingPath(id)}?return=o-63`);

  // 쓰던 통장 이름이 겹치면 막음(공동 생활비와 목표자금 문구가 기본)
  const used = roles
    .map(({ role }) => ({ role, row: rowOf(role) }))
    .filter((x) => x.row.pick === 'existing' && x.row.name.trim());
  const dup = used.filter(
    (x, i) => used.findIndex((y) => y.row.name.trim() === x.row.name.trim()) !== i,
  );
  const dupMsg =
    dup.length === 0
      ? null
      : used.some(
            (x) =>
              x.role === 'emergency' && dup.some((d) => d.row.name.trim() === x.row.name.trim()),
          )
        ? copy.sameAccountOther
        : copy.sameAccount;

  const rolesReady = roles.every(({ role }) => {
    const x = rowOf(role);
    return x.pick === 'new' || (x.pick === 'existing' && !!x.name.trim() && x.balance !== null);
  });
  const ready = curMode === 'single' || (curMode === 'roles' && rolesReady && !dupMsg);
  const odd = roles.some(
    ({ role }) => (rowOf(role).balance ?? 0) > ODD && rowOf(role).pick === 'existing',
  );

  const save = () =>
    s.done(async () => {
      if (!separate) await saveSpace({ account_mode: curMode });
      if (curMode === 'single') {
        await trashAccounts(existing.filter((a) => a.role !== 'personal').map((a) => a.id));
        return;
      }
      await saveAccounts(
        roles.map(({ role }, i) => {
          const x = rowOf(role);
          const isExisting = x.pick === 'existing';
          return {
            role,
            name: isExisting ? x.name.trim() : copy.accountName(copy.roles[role]),
            is_existing: isExisting,
            start_balance: isExisting ? x.balance : 0,
            sort: i,
          };
        }),
        existing,
      );
    });

  // 각자 용돈과 각자 매달 옮길 돈
  const me = s.state.me?.nickname ?? '';
  const partner = sp.partner_nickname ?? '';
  const joined = partnerJoined(s.state);
  const myAllowance = s.state.me?.allowance ?? DEFAULT_ALLOWANCE;
  const split = splitOf(s.state);
  const total = parts.living + parts.goalFund + parts.emergency;
  const shares = splitShares({ total, ...split });
  const base = baseDayOf(s.state);

  const amountRow = (key: keyof PlanParts, role: Role) => {
    const v = parts[key];
    const editTo = role === 'living' ? 'o-36' : role === 'goal_fund' ? 'o-21' : null;
    const empty = role === 'goal_fund' && v === 0;
    return (
      <div className="hg-row" style={{ justifyContent: 'space-between', opacity: empty ? 0.5 : 1 }}>
        <span className="hg-stack" style={{ gap: 0 }}>
          <b>{copy.roles[role]}</b>
          {empty && <span className="hg-help">{copy.goalFundEmpty}</span>}
        </span>
        {editTo ? (
          <button type="button" className="hg-btn hg-btn--link" onClick={() => edit(editTo)}>
            {perMonth(v)}
          </button>
        ) : (
          <span>{perMonth(v)}</span>
        )}
      </div>
    );
  };

  const title = separate
    ? copy.accountsWedding
    : curMode === 'roles'
      ? copy.accounts
      : copy.accountMode;

  return (
    <QuestionLayout
      wide
      steps={s.steps}
      title={title}
      help={curMode === 'roles' ? copy.accountsHelp : undefined}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !ready, loading: s.saving }}
      onSubmit={() => ok.check(odd) && void save()}
    >
      <TempNote reason={r.temp} />
      {!separate && (
        <ChoiceCards<Mode>
          label={copy.accountMode}
          value={curMode}
          onChange={setMode}
          autoAdvance={false}
          options={[
            { value: 'single', label: copy.accountModes.single },
            { value: 'roles', label: copy.accountModes.roles },
          ]}
        />
      )}

      {curMode && (
        <div className="hg-q__cols">
          <section className="hg-stack">
            {curMode === 'single' && (
              <h2 className="hg-card__label" style={{ margin: 0 }}>
                {copy.accountsSingle}
              </h2>
            )}
            {roles.map(({ key, role }) => {
              const x = rowOf(role);
              return (
                <div key={role} className="hg-card hg-stack">
                  {amountRow(key, role)}
                  {curMode === 'roles' && (
                    <>
                      <ChoiceCards<Pick>
                        label={`${copy.roles[role]} ${copy.whichAccount}`}
                        value={x.pick}
                        onChange={(v) => setRow(role, { pick: v })}
                        autoAdvance={false}
                        autoFocus={separate}
                        shortcuts={separate}
                        options={[
                          { value: 'existing', label: copy.existing },
                          { value: 'new', label: copy.newAccount, sub: copy.fromZero },
                        ]}
                      />
                      {x.pick === 'existing' && (
                        <>
                          <ShortText
                            label={`${copy.roles[role]} ${copy.accountNameLabel}`}
                            value={x.name}
                            onChange={(v) => setRow(role, { name: v })}
                            max={15}
                            placeholder={copy.accountNamePlaceholder}
                          />
                          <AmountInput
                            label={`${copy.roles[role]} ${copy.balanceLabel}`}
                            value={x.balance}
                            onChange={(v) => setRow(role, { balance: v })}
                            quick={quickChips.small}
                            allowZero
                            embedded
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {dupMsg && (
              <p className="hg-help is-error" role="alert" style={{ margin: 0 }}>
                {dupMsg}
              </p>
            )}
            {ok.banner}
          </section>

          <section className="hg-stack">
            {!separate && (
              <div className="hg-card hg-stack">
                <span className="hg-card__label">{copy.allowanceAccounts}</span>
                <button
                  type="button"
                  className="hg-btn hg-btn--link"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => edit('o-51')}
                >
                  {me} {formatManWon(myAllowance)} 원
                </button>
                {sp.couple_state !== 'solo' && (
                  <span className="hg-help">
                    {partner} {formatManWon(myAllowance)} 원 {!joined && copy.assumed}
                  </span>
                )}
              </div>
            )}
            {sp.couple_state !== 'solo' && (
              <div className="hg-card hg-stack">
                <span className="hg-card__label">{copy.monthlyTransfer}</span>
                <button
                  type="button"
                  className="hg-btn hg-btn--link"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => edit('o-52')}
                >
                  {copy.splitModes[split.mode]}
                </button>
                <div className="hg-row" style={{ gap: 'var(--space-4)' }}>
                  <span>
                    <span className="hg-help">{me}</span> <b>{formatManWon(shares.me)} 원</b>
                  </span>
                  <span>
                    <span className="hg-help">{partner}</span>{' '}
                    <b>{formatManWon(shares.partner)} 원</b>
                  </span>
                </div>
                <BaseDayEditor
                  value={base}
                  line={copy.baseDayLine}
                  onSave={async (d) => {
                    await saveBaseDay(d);
                    await refresh.space();
                  }}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </QuestionLayout>
  );
}
