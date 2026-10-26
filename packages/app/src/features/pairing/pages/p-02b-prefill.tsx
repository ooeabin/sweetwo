import { discardPrefill, fetchAssets, qk, recordPrefillConsent } from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { ListRow, QuestionLayout } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';

// P-02b 사전 입력 확인·동의(18): 시작한 사람이 합류 전에 대신 입력한 내 명의 자산·부채를 처음 보는 화면.
// ‘확인하고 이어 쓸게요’ = 동의 기록(합류를 마치면 소유가 내게 넘어감) / ‘지우고 새로 입력할게요’ = 그 항목을 휴지통으로.
export function P02bPrefill() {
  const s = useJoinStep('p-02b');
  const d = s.d;
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  if (!d.ready || !d.me || assets.isLoading) return null;
  const starter = d.couple?.partnerName ?? '';
  const items = (assets.data ?? []).filter(
    (a) => a.owner === 'person' && a.owner_user_id === null && a.created_by !== d.me?.id,
  );
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
