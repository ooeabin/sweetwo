import { formatMonthDay } from '@sweetwo/core';
import { Badge, Button, QuestionLayout, SceneMedia } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { describeProposal, proposalCopy } from '../../proposals';
import { copy } from '../copy';
import { useCloseData } from '../data';

// W-04 끝(docs/spec/21-month-close.md). 혼자 정리: 이 정리에서 바꾼 값(묶음 제안) 목록 + “제안 중”,
// “반대 없으면 {날짜}부터 적용돼요”, ‘보낸 제안 보기’. 바뀐 값이 없으면 “바뀐 값이 없어요”.
// 배우자 미합류·혼자 쓰기는 제안 없이 바로 적용이라 바뀐 값 목록이 없음.
export function W04End() {
  const nav = useNavigate();
  const d = useCloseData();
  if (d.loading) return null;
  const bundle = d.close ? d.proposals.filter((p) => p.month_close_id === d.close?.id) : [];
  const c = d.couple;
  const names =
    c && d.me
      ? { myId: d.me.id, myName: c.myName, partnerName: c.partnerName, starter: c.starter }
      : null;
  const goals = d.goals.map((g) => ({ id: g.id, name: g.name }));
  const applyOn = bundle.map((p) => p.apply_on).sort()[0];
  return (
    <QuestionLayout
      title={copy.doneTitle(d.month)}
      help={
        d.rest
          ? copy.restDone
          : bundle.length && names
            ? copy.sentTitle(bundle.length, names.partnerName)
            : copy.noChange
      }
      primary={{ label: copy.toMonth }}
      onSubmit={() => {
        d.clearTarget();
        nav('/', { replace: true });
      }}
    >
      <SceneMedia scene="W-04" />
      {bundle.length > 0 && names && (
        <section className="hg-card hg-stack" aria-label={copy.pending}>
          {bundle.map((p) => {
            const line = describeProposal(p, names, goals);
            return (
              <div key={p.id} className="hg-row" style={{ justifyContent: 'space-between' }}>
                <span>
                  {line.label} {proposalCopy.change(line.before, line.after)}
                </span>
                <Badge kind="temp">{copy.pending}</Badge>
              </div>
            );
          })}
          {applyOn && <p className="hg-card__meta">{copy.applyFrom(formatMonthDay(applyOn))}</p>}
          <Button variant="secondary" size="sm" onClick={() => nav(`/proposals/${bundle[0]?.id}`)}>
            {copy.seeSent}
          </Button>
        </section>
      )}
    </QuestionLayout>
  );
}
