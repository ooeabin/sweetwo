import { fetchAccounts, qk } from '@sweetwo/api';
import { formatManWon, spaceBaseDay, type PlanParts } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { onboardingCopy as oc, TempNote } from '../../onboarding';
import { useJoinStep } from '../join-step';
import { revisit } from '../revisit';
import { Was } from '../was';

const ROLE: Record<keyof PlanParts, 'living' | 'goal_fund' | 'emergency'> = {
  living: 'living',
  goalFund: 'goal_fund',
  emergency: 'emergency',
};
const man = (v: number) => `${formatManWon(v)} 원`;

// O-63 통장 구조 다시 보기(합류 뒤). 시작한 사람이 정한 통장과 두 사람 실제 값으로 다시 계산한 월 금액.
// 바뀐 금액은 이전 값에 취소선. 금액, 분담, 기준일을 바꾸는 건 제안이라 여기서는 보기만.
export function O63Revisit() {
  const s = useJoinStep('o-63');
  const d = s.d;
  const accounts = useQuery({ queryKey: qk.accounts, queryFn: fetchAccounts });
  if (!d.ready || accounts.isLoading || !d.space || !d.couple) return null;
  const r = revisit(d);
  if (!r) return null;
  const sp = d.space;
  const c = d.couple;
  const roles = sp.account_mode === 'roles' || r.now.separate;
  const keys = (
    r.now.separate ? ['goalFund'] : ['living', 'goalFund', 'emergency']
  ) as (keyof PlanParts)[];
  const nameOf = (k: keyof PlanParts) => {
    const role = r.now.separate ? 'wedding' : ROLE[k];
    const a = (accounts.data ?? []).find((x) => x.role === role);
    return roles && a ? a.name : oc.roles[role];
  };
  const base = spaceBaseDay(sp, c);
  const title = r.now.separate ? oc.accountsWedding : roles ? oc.accounts : oc.accountsSingle;

  return (
    <QuestionLayout
      wide
      steps={s.steps}
      title={title}
      onBack={s.onBack}
      primary={{ label: oc.next, loading: s.saving }}
      onSubmit={() => void s.done()}
    >
      <TempNote reason={r.temp} />
      <div className="hg-q__cols">
        <section className="hg-stack">
          <ul className="hg-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {keys.map((k) => (
              <li key={k} className="hg-listrow" style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="hg-listrow__label">{nameOf(k)}</span>
                <span className="hg-listrow__value">
                  <Was
                    now={oc.perMonth(formatManWon(r.now.parts[k]))}
                    before={oc.perMonth(formatManWon(r.before.parts[k]))}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="hg-stack">
          {!r.now.separate && (
            <div className="hg-card hg-stack">
              <span className="hg-card__label">{oc.allowanceAccounts}</span>
              <span>
                {c.myName} <b>{man(c.myAllowance ?? 0)}</b>
              </span>
              <span>
                {c.partnerName} <b>{man(c.partnerAllowance ?? c.myAllowance ?? 0)}</b>
              </span>
            </div>
          )}
          <div className="hg-card hg-stack">
            <span className="hg-card__label">{oc.monthlyTransfer}</span>
            <span>{oc.splitModes[r.mode]}</span>
            <span>
              <span className="hg-help">{c.myName}</span>{' '}
              <b>
                <Was now={man(r.now.shares.me)} before={man(r.before.shares.me)} />
              </b>
            </span>
            <span>
              <span className="hg-help">{c.partnerName}</span>{' '}
              <b>
                <Was now={man(r.now.shares.partner)} before={man(r.before.shares.partner)} />
              </b>
            </span>
            {base !== null && <span className="hg-help">{oc.baseDayLine(oc.dayText(base))}</span>}
          </div>
        </section>
      </div>
    </QuestionLayout>
  );
}
