import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { Navigate, useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { UnlinkDeleted, type DataBack } from '../unlink';

// S-12a 연결 해제 안내(25 ‘S-12 계열 문구’, 08 7장 v2.2): “남는 것” / “지워지는 것”, 확정 시점(상대 확인 또는 14일),
// ‘먼저 내보내기’(→ S-18, 뒤로 = 이 화면). 다음 → S-12c. 30일 복구 안내는 없앰(2026-11-13 D10).
export function S12aUnlinkIntro() {
  const nav = useNavigate();
  const d = useSettingsData();
  if (d.loading || !d.c || !d.space) return <QuestionSkeleton />;
  if (d.space.couple_state !== 'connected') return <Navigate to="/settings/couple" replace />;
  return (
    <QuestionLayout
      steps={{ total: 2, now: 0 }}
      title={copy.unlinkQ}
      onBack={() => nav('/settings/couple')}
      primary={{ label: copy.next }}
      onSubmit={() => nav('/settings/couple/unlink/confirm')}
      later={{
        label: copy.exportFirst,
        onClick: () =>
          nav('/settings/data', {
            state: { back: '/settings/couple/unlink', backLabel: copy.unlink } satisfies DataBack,
          }),
      }}
    >
      <UnlinkDeleted />
      <p className="hg-help" style={{ margin: 0 }}>
        {copy.unlinkWhen(d.c.partnerName)}
      </p>
    </QuestionLayout>
  );
}
