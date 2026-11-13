import { fetchSplits, qk, startAfterUnlink, updateMe } from '@sweetwo/api';
import { Illustration, QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';

// S-12h 혼자 쓰기 전환(25 ‘S-12 계열 문구’, 08 7장 v2.2): 96px 상태 그림 자리(그림이 들어올 때까지 회색 빈 자리)
// + “연결이 해제됐어요” / “같이 쓰던 것만 지웠어요. 내 저금과 자산은 그대로예요” + 다시 연결 위치 안내 한 줄.
// ‘시작하기’ → 내 월급 계획이 남았으면(각자 계열) 홈으로 이어 씀, 없으면(같이 계열이라 공동 계획만 있었음) 온보딩 O-30.
// 확정 뒤 처음 열 때 1회(홈이 onboarding_step 'S-12H'면 여기로).
export function S12hUnlinked() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const splits = useQuery({ queryKey: qk.splits, queryFn: fetchSplits });
  const [busy, setBusy] = useState(false);
  return (
    <QuestionLayout
      hero={<Illustration name="status-unlinked" className="hg-auth__art" />}
      title={copy.unlinkedTitle}
      help={copy.unlinkedHelp}
      center
      primary={{ label: copy.startSolo, loading: busy || splits.isLoading }}
      onSubmit={async () => {
        if (busy || splits.isLoading) return;
        setBusy(true);
        try {
          if (splits.data?.length) {
            // 각자 계열: 내 월급 계획·저금이 혼자 공간으로 옮겨 옴 → 그대로 홈
            await updateMe({ onboarding_step: 'O-60' });
            await qc.invalidateQueries();
            nav('/', { replace: true });
          } else {
            await startAfterUnlink();
            await updateMe({ onboarding_step: 'O-30' });
            await qc.invalidateQueries({ queryKey: qk.me });
            nav('/onboarding/o-30', { replace: true });
          }
        } catch {
          toast(copy.failed);
          setBusy(false);
        }
      }}
    >
      <p className="hg-help" style={{ margin: 0, textAlign: 'center' }}>
        {copy.reconnectWhere}
      </p>
    </QuestionLayout>
  );
}
