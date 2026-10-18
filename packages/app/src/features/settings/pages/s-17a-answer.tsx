import { qk, updateMe, updateSpace } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Field = 'housing' | 'employment' | 'child';

// S-17 파트 1 다시 답하기(O-15 사는 집, O-16 일하는 방식, O-18 아이 계획과 같은 Q1). 사실값이라 바로 저장 → S-17.
// 일하는 방식은 비상금 기준 개월, 사는 집·아이 계획은 맞춤 가이드와 목표 추천에 씀.
export function S17aAnswer() {
  const { field = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [v, setV] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!['housing', 'employment', 'child'].includes(field))
    return <Navigate to="/settings/answers" replace />;
  if (d.loading || !d.me || !d.space || !d.c) return null;
  const f = field as Field;
  const back = () => nav('/settings/answers', { replace: true });
  const options: Record<Field, Record<string, string>> = {
    housing: copy.housingOptions,
    employment: copy.employmentOptions,
    child: copy.childOptions,
  };
  const title: Record<Field, string> = {
    housing: copy.askHousing,
    employment: copy.askEmployment(d.c.myName),
    child: copy.askChild,
  };
  const cur: Record<Field, string | null> = {
    housing: d.space.housing,
    employment: d.me.employment,
    child: d.space.child_plan,
  };
  const save = async (x: string) => {
    if (saving) return;
    if (x === cur[f]) return back();
    setSaving(true);
    try {
      if (f === 'employment')
        await updateMe({ employment: x as NonNullable<typeof d.me.employment> });
      else if (f === 'housing')
        await updateSpace({ housing: x as NonNullable<typeof d.space.housing> });
      else await updateSpace({ child_plan: x as NonNullable<typeof d.space.child_plan> });
      await Promise.all([qk.me, qk.space].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(copy.savedAnswer);
      back();
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <QuestionLayout title={title[f]} onBack={back}>
      <ChoiceCards<string>
        label={title[f]}
        value={v ?? cur[f]}
        onChange={setV}
        onPick={(x) => void save(x)}
        options={Object.entries(options[f]).map(([value, label]) => ({ value, label }))}
      />
    </QuestionLayout>
  );
}
