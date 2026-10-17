import { Button, QuestionLayout } from '@sweetwo/ui';
import { Navigate, useNavigate } from 'react-router-dom';
import { closePath, useMonthView } from '../../month';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { useJointAssets, useUnlinkDraft } from '../unlink';

// S-12a 연결 해제 안내(docs/spec/25-settings.md ‘연결 해제, 자산 정리 안’): 정리되는 방식(31 보안·개인정보 4장),
// 월말 정리 전이면 “10월 월급 플랜 정리부터 할까요?”. 다음 → S-12b(공동 자산이 없으면 S-12c).
// ‘먼저 내보내기’(S-18)는 내보내기 화면과 함께.
export function S12aUnlinkIntro() {
  const nav = useNavigate();
  const d = useSettingsData();
  const v = useMonthView();
  const joint = useJointAssets();
  const reset = useUnlinkDraft((s) => s.reset);
  if (d.loading || !d.c || !d.space || joint.loading) return null;
  if (d.space.couple_state !== 'connected') return <Navigate to="/settings/couple" replace />;
  const c = d.c;
  const lines = [
    ...copy.unlinkHow,
    ...(d.space.marriage_status === 'engaged' ? [copy.unlinkWedding] : []),
    copy.unlinkWhen(c.partnerName),
  ];
  return (
    <QuestionLayout
      steps={{ total: 3, now: 0 }}
      title={copy.unlinkQ}
      onBack={() => nav('/settings/couple')}
      primary={{ label: copy.next }}
      onSubmit={() => {
        reset();
        nav(joint.rows.length ? '/settings/couple/unlink/plan' : '/settings/couple/unlink/confirm');
      }}
    >
      <div className="hg-stack" style={{ gap: 'var(--space-4)' }}>
        {v?.closing && (
          <div className="hg-banner hg-banner--info" role="status">
            <span>{copy.closeFirst(v.month)}</span>
            <Button variant="secondary" size="sm" onClick={() => nav(closePath)}>
              {copy.closeStart}
            </Button>
          </div>
        )}
        <ul className="hg-stack" style={{ gap: 'var(--space-2)', paddingLeft: 'var(--space-5)' }}>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </QuestionLayout>
  );
}
