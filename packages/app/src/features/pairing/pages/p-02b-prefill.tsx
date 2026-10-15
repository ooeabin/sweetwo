import { recordPrefillConsent } from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { ListRow, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

// P-02b 사전 입력 확인·동의. 시작한 사람이 적어 둔 내 값(지금은 O-33 수입)을 처음 보는 화면.
// ‘확인하고 이어 쓸게요’ = 동의 기록 → 값이 P-05 초기값(추정 표시는 확인할 때까지). ‘지우고 새로’ = 빈 칸.
export function P02bPrefill() {
  const s = useJoinStep('p-02b');
  const d = s.d;
  if (!d.ready || !d.me || !d.space) return null;
  const starter = d.couple?.partnerName ?? '';
  const income = d.me.monthly_income;
  return (
    <QuestionLayout
      title={copy.prefillTitle(starter)}
      primary={{ label: copy.prefillOk, loading: s.saving }}
      later={{
        label: copy.prefillClear,
        onClick: () => void s.done(() => saveMe({ monthly_income: null }), 'p-03'),
      }}
      onSubmit={() => void s.done(() => recordPrefillConsent(d.me?.id ?? ''), 'p-03')}
    >
      <div className="hg-list">
        {income !== null && (
          <ListRow
            label={copy.prefillIncome}
            sub={d.space.partner_income_estimated ? copy.estimated : undefined}
            value={readWon(income)}
          />
        )}
      </div>
    </QuestionLayout>
  );
}
