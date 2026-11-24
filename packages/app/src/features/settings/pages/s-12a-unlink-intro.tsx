import { FormScreen, FormSection, QuestionSkeleton } from '@sweetwo/ui';
import { Navigate, useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { UnlinkDeleted, type DataBack } from '../unlink';

// S-12a 연결 해제 안내(25 ‘S-12 계열 문구’, 08 7장 v2.2): “남는 것” / “지워지는 것”, 확정 시점(상대 확인 또는 14일),
// ‘먼저 내보내기’(→ S-18, 뒤로 = 이 화면). 다음 → S-12c. 2026-11-24 스테퍼(1/2, 확인·동의 단계라 한 화면으로 합치지 않음). 30일 복구 안내는 없앰(2026-11-13 D10).
export function S12aUnlinkIntro() {
  const nav = useNavigate();
  const d = useSettingsData();
  if (d.loading || !d.c || !d.space) return <QuestionSkeleton />;
  if (d.space.couple_state !== 'connected') return <Navigate to="/settings/couple" replace />;
  return (
    <FormScreen
      title={copy.unlink}
      onBack={() => nav('/settings/couple')}
      step={{ index: 1, total: 2 }}
      primary={{ label: copy.next }}
      onSubmit={() => nav('/settings/couple/unlink/confirm')}
      later={{
        secondary: true,
        label: copy.exportFirst,
        onClick: () =>
          nav('/settings/data', {
            state: { back: '/settings/couple/unlink', backLabel: copy.unlink } satisfies DataBack,
          }),
      }}
    >
      <FormSection title={copy.unlinkQ}>
        <UnlinkDeleted />
        <p className="hg-form__hint">{copy.unlinkWhen(d.c.partnerName)}</p>
      </FormSection>
    </FormScreen>
  );
}
