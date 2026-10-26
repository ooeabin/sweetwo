import { qk, setSalaryMode } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Mode = 'separate' | 'joint';

// S-11f 월급 관리 방식(Q1, O-30과 같음): 바꾸면 둘 다에게 적용(분배표 합치기·나누기는 서버) + 상대 알림 + Toast ‘되돌리기’
// → 바로 새 분배표 확인(W-01). 체크리스트는 다음 월급날부터 새 방식, 목표의 모은 돈은 그대로. 연결 해제 대기 중에는 못 바꿈.
export function S11fSalaryMode() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [v, setV] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.space) return null;
  const saved: Mode = d.space.salary_mode;
  const value = v ?? saved;
  const locked = d.space.couple_state === 'unlink_pending';
  const refresh = () =>
    Promise.all(
      [qk.space, qk.splits, ['pay_checklist']].map((k) => qc.invalidateQueries({ queryKey: k })),
    );
  const save = async () => {
    if (saving || value === saved || locked) return;
    setSaving(true);
    try {
      if ((await setSalaryMode(value)) === 'unlink_pending') {
        toast(copy.unlinkPendingLocked);
        return;
      }
      await refresh();
      toast(copy.salaryModeSaved, {
        label: copy.undo,
        onClick: () => void setSalaryMode(saved).then(refresh),
      });
      nav('/salary/split', { replace: true });
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.salaryModeQ}
      help={locked ? copy.unlinkPendingLocked : copy.salaryModeHelp}
      onBack={() => nav('/settings/me')}
      primary={{ label: copy.save, disabled: value === saved || locked, loading: saving }}
      onSubmit={() => void save()}
    >
      <ChoiceCards<Mode>
        label={copy.salaryModeQ}
        value={value}
        onChange={setV}
        autoAdvance={false}
        options={(['separate', 'joint'] as const).map((k) => ({
          value: k,
          label: copy.salaryModes[k],
          disabled: locked,
        }))}
      />
    </QuestionLayout>
  );
}
