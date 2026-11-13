import { discardPrefill, recordPrefillConsent } from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { ListRow, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';

// P-02b 사전 입력 확인·동의(18): 시작한 사람이 합류 전에 대신 입력한 내 명의 자산·부채를 처음 보는 화면.
// ‘확인하고 이어 쓸게요’ = 동의 기록(합류를 마치면 소유가 내게 넘어감) / ‘지우고 새로 입력할게요’ = 그 항목을 휴지통으로.
// 좁은 창(320px)에서 글자 버튼이 잘리지 않게 줄바꿈(2026-11-11 S3-13, QuestionLayout 글자 버튼 공통)
export function P02bPrefill() {
  const s = useJoinStep('p-02b');
  const d = s.d;
  // 합류를 마치기 전이라 자산을 직접 못 읽음: 대신 입력한 내 명의 항목은 join_context로(2026-11-11 D1)
  if (!d.ready || !d.me || !d.ctx) return <QuestionSkeleton />;
  const starter = d.starterName;
  const items = d.ctx.prefill;
  return (
    <QuestionLayout
      title={copy.prefillTitle(starter)}
      primary={{ label: copy.prefillOk, loading: s.saving }}
      later={{
        label: copy.prefillClear,
        onClick: () => void s.done(() => discardPrefill(), 'p-03'),
      }}
      onSubmit={() => void s.done(() => recordPrefillConsent(d.me?.id ?? ''), 'p-03')}
    >
      <div className="hg-list">
        {items.map((a) => (
          <ListRow
            key={a.id}
            label={a.name}
            sub={a.estimated ? copy.estimated : undefined}
            value={readWon(a.amount)}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}
