import { QuestionLayout } from '@sweetwo/ui';
import { Navigate, useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { UnlinkDeleted } from '../unlink';

// S-12a 연결 해제 안내(25 ‘연결 해제 요청과 확인’): 같이 쓰던 데이터는 나누지 않고 모두 지움(목록), 확정 시점(상대 확인 또는 14일),
// 혼자 쓰기로 처음부터, ‘먼저 내보내기’(→ S-18). 다음 → S-12c.
export function S12aUnlinkIntro() {
  const nav = useNavigate();
  const d = useSettingsData();
  if (d.loading || !d.c || !d.space) return null;
  if (d.space.couple_state !== 'connected') return <Navigate to="/settings/couple" replace />;
  return (
    <QuestionLayout
      steps={{ total: 2, now: 0 }}
      title={copy.unlinkQ}
      onBack={() => nav('/settings/couple')}
      primary={{ label: copy.next }}
      onSubmit={() => nav('/settings/couple/unlink/confirm')}
      later={{ label: copy.exportFirst, onClick: () => nav('/settings/data') }}
    >
      <UnlinkDeleted />
      <ul className="hg-stack" style={{ gap: 'var(--space-2)', paddingLeft: 'var(--space-5)' }}>
        <li>{copy.unlinkWhen(d.c.partnerName)}</li>
        <li>{copy.unlinkRestart}</li>
      </ul>
    </QuestionLayout>
  );
}
