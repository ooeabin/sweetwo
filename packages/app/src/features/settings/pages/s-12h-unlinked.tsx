import { qk, startAfterUnlink } from '@sweetwo/api';
import { Illustration, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';

// S-12h 혼자 쓰기 전환(25 ‘연결 해제, 대기와 혼자 쓰기’ 4·6번): 96px 상태 그림 자리(2026-11-11 S3-16, 그림이 들어올 때까지 회색 빈 자리)
// + “연결이 해제됐어요” / “같이 쓰던 데이터는 지웠어요. 혼자 쓰기로 처음부터 시작해요”, “30일 안에 다시 연결하면 되돌릴 수 있어요”
// + 다시 연결 위치 안내 한 줄. ‘시작하기’ → 온보딩 O-11(이름 O-03, 초대 O-06은 건너뜀). 확정 뒤 처음 열 때 1회(홈이 여기로).
export function S12hUnlinked() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <QuestionLayout
      hero={<Illustration name="status-unlinked" className="hg-auth__art" />}
      title={copy.unlinkedTitle}
      help={copy.unlinkedHelp}
      center
      primary={{ label: copy.startSolo, loading: busy }}
      onSubmit={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await startAfterUnlink();
          await qc.invalidateQueries({ queryKey: qk.me });
          nav('/onboarding/o-11', { replace: true });
        } catch {
          toast(copy.failed);
          setBusy(false);
        }
      }}
    >
      <p className="hg-help" style={{ margin: 0, textAlign: 'center' }}>
        {copy.reconnectNote}
        <br />
        {copy.reconnectWhere}
      </p>
    </QuestionLayout>
  );
}
