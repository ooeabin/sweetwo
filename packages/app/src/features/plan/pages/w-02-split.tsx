import { formatDot, type Side } from '@sweetwo/core';
import { Badge, Button, PageHeader, Tabs, TransferRow } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame, useMonthView } from '../../month';
import { useSplitActions } from '../actions';
import { copy } from '../copy';

type Who = 'me' | 'partner';
const FROM: Record<string, string> = {
  emergency_to_living: 'emergency',
  goal_to_living: 'goal_fund',
};

// W-02 월급 나누기(docs/spec/20-salary-plan.md): 앱은 돈을 옮기지 않고, 은행 앱에서 옮긴 뒤 ‘옮겼어요’로 기록.
// 사람 탭(내 탭 기본, 배우자 탭은 보기만 + ‘대신 체크’), 공동 통장 줄만. 체크하면 바로 완료 + ‘취소’, ‘다른 금액을 옮겼어요’ → W-02a.
// 내 몫이 다 끝나면 W-02 끝 “월급을 다 나눴어요” + 배우자 진행. 배우자가 합류하고 통장 역할을 나눈 부부만
export function W02Split() {
  const nav = useNavigate();
  const v = useMonthView();
  const { masked } = useMask();
  const m = (x: number) => money(x, masked);
  const [who, setWho] = useState<Who>('me');
  const [proxy, setProxy] = useState(false);
  const act = useSplitActions(v?.partnerName ?? '');
  if (!v) return <MainFrame current="month" columns={[null]} />;
  if (!v.hasSplit) return <Navigate to="/plan" replace />;

  const s = v.split;
  const rows = who === 'me' ? s.mine : s.partner;
  const side: Side = who === 'me' ? s.mySide : s.partnerSide;
  const editable = who === 'me' || proxy;
  const myDone = s.mine.length > 0 && s.mine.every((r) => r.done);
  const partnerDone = s.partner.filter((r) => r.done).length;
  const day = (d: string | null) => (d ? formatDot(d) : '');

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.splitTitle}
        backLabel={copy.back}
        backTo={copy.backPlan}
        onBack={() => nav('/plan')}
      />
      {who === 'me' && myDone && (
        <section className="hg-card hg-stack" aria-label={copy.allDone}>
          <b>{copy.allDone}</b>
          <span className="hg-card__meta">
            {copy.partnerProgress(v.partnerName, partnerDone, s.partner.length)}
          </span>
          <Button variant="primary" onClick={() => nav('/')} style={{ alignSelf: 'flex-start' }}>
            {copy.close}
          </Button>
        </section>
      )}
      <Tabs<Who>
        variant="seg"
        label={copy.sideTabs}
        value={who}
        onChange={(w) => {
          setWho(w);
          setProxy(false);
        }}
        items={[
          { value: 'me', label: `${s.myName} ${day(s.myPayday)}` },
          { value: 'partner', label: `${v.partnerName} ${day(s.partnerPayday)}` },
        ]}
      />
      {who === 'partner' && (
        <div className="hg-row" style={{ gap: 'var(--space-3)' }}>
          <span className="hg-help">{copy.proxyNote(v.partnerName)}</span>
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={proxy}
            onClick={() => setProxy((x) => !x)}
          >
            {copy.proxy(v.partnerName)}
          </Button>
        </div>
      )}
      <div className="hg-card">
        {rows.length === 0 && <p className="hg-card__meta">{copy.nothing}</p>}
        {rows.map((r) => {
          const role = copy.roles[r.role] ?? r.role;
          const from = FROM[r.kind];
          const differs = r.done && r.doneAmount !== null && r.doneAmount !== r.amount;
          return (
            <TransferRow
              key={r.lineId}
              label={copy.rowLabel(role)}
              meta={
                [
                  from ? copy.autoFrom(copy.roles[from] ?? from) : '',
                  differs ? copy.actual(m(r.doneAmount ?? 0)) : '',
                ]
                  .filter(Boolean)
                  .join(', ') || undefined
              }
              badge={from ? <Badge kind="together">{copy.auto}</Badge> : undefined}
              amount={m(r.doneAmount ?? r.amount)}
              done={r.done}
              checkLabel={copy.moved(role)}
              disabled={!editable}
              onToggle={() =>
                void (r.done ? act.uncheck(r.lineId, side) : act.check(r.lineId, side))
              }
              actions={
                !editable ? undefined : r.done ? (
                  <button
                    type="button"
                    className="hg-btn hg-btn--link"
                    onClick={() => void act.uncheck(r.lineId, side)}
                  >
                    {copy.cancel}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="hg-btn hg-btn--link"
                    onClick={() => nav(`/plan/split/${r.lineId}?side=${side}`)}
                  >
                    {copy.other}
                  </button>
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
  return <MainFrame current="month" columns={[body]} />;
}
