import { updateMonthClose } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath } from '../data';
import { useDetailData } from '../detail';

type Reason = 'hospital' | 'repair' | 'family_event' | 'living_short' | 'etc';
const REASONS: Reason[] = ['hospital', 'repair', 'family_event', 'living_short', 'etc'];

// W-04d 비상금 사용(꼼꼼 모드, W-04b에서 비상금이 줄었을 때만): 없어요 / 있어요 → 사유(병원, 수리, 경조사, 생활비 부족, 기타).
// 비상금에서 꺼낸 목표 돈도 여기서. 다음 달부터 비상금 채우기를 1순위로(06 7장)는 배분 쪽.
export function W04dEmergency() {
  const nav = useNavigate();
  const d = useDetailData();
  const [phase, setPhase] = useState<'used' | 'why'>('used');
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  if (d.skip('w-04d') || !d.closeId) return <Navigate to={closePath(d.nextOf('w-04d'))} replace />;
  const closeId = d.closeId;

  const save = async (used: boolean, reason: Reason | null) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateMonthClose(closeId, { emergency_used: used, emergency_reason: reason });
      await d.refreshClose();
      setSaving(false);
      nav(closePath(d.nextOf('w-04d')));
    } catch {
      setSaving(false);
      toast(copy.saveFailed);
    }
  };

  if (phase === 'why')
    return (
      <QuestionLayout
        steps={d.progress('w-04d')}
        title={copy.emergencyWhy}
        onBack={() => setPhase('used')}
      >
        <ChoiceCards<Reason>
          label={copy.emergencyWhy}
          options={REASONS.map((r) => ({ value: r, label: copy.emergencyReasons[r] }))}
          value={(d.close?.emergency_reason as Reason | null) ?? null}
          onChange={() => undefined}
          onPick={(r) => void save(true, r)}
          autoAdvance
          autoFocus
          shortcuts
        />
      </QuestionLayout>
    );

  return (
    <QuestionLayout
      steps={d.progress('w-04d')}
      title={copy.emergencyTitle}
      onBack={() => nav(closePath(d.prevOf('w-04d')))}
    >
      <ChoiceCards<'no' | 'yes'>
        label={copy.emergencyTitle}
        options={[
          { value: 'no', label: copy.emergencyNo },
          { value: 'yes', label: copy.emergencyYes },
        ]}
        value={d.close?.emergency_used == null ? null : d.close.emergency_used ? 'yes' : 'no'}
        onChange={() => undefined}
        onPick={(v) => (v === 'yes' ? setPhase('why') : void save(false, null))}
        autoAdvance
        autoFocus
        shortcuts
      />
    </QuestionLayout>
  );
}
