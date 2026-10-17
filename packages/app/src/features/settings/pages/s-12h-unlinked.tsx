import { fetchMyUnlink, qk } from '@sweetwo/api';
import { formatManWon, readUnlinkPlan, unlinkTotals } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSettingsData } from '../data';
import { copy } from '../copy';

// S-12h 혼자 쓰기 전환(docs/spec/25-settings.md ‘연결 해제, 대기와 혼자 쓰기’ 4·6번):
// “2,100만 원은 각자 목표로 옮겨요”(확정된 자산 정리 안의 내 자산 몫), “30일 안에 다시 연결하면 되돌릴 수 있어요”.
// 구독(5번)은 구독 기능과 함께, ‘다시 연결하기’(7번)는 S-12g와 함께.
export function S12hUnlinked() {
  const nav = useNavigate();
  const d = useSettingsData();
  const u = useQuery({ queryKey: qk.myUnlink, queryFn: fetchMyUnlink });
  if (d.loading || !d.me || u.isLoading) return null;
  const done = u.data;
  if (!done) return <Navigate to="/settings/couple" replace />;
  const t = unlinkTotals(readUnlinkPlan(done.final_plan ?? done.plan), 'asset');
  const mine = done.requested_by === d.me.id ? t.mine : t.theirs;
  return (
    <QuestionLayout
      title={copy.unlinkedTitle}
      primary={{ label: copy.ok }}
      onSubmit={() => nav('/', { replace: true })}
    >
      <ul className="hg-stack" style={{ gap: 'var(--space-2)', paddingLeft: 'var(--space-5)' }}>
        <li>{copy.movedMine(formatManWon(mine))}</li>
        <li>{copy.reconnectNote}</li>
      </ul>
    </QuestionLayout>
  );
}
