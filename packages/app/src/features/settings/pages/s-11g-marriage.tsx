import { qk, updateSpace } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

const RELATIONS = ['married', 'engaged', 'dating', 'living_together'] as const;
type Relation = (typeof RELATIONS)[number];

// S-11g 두 사람 사이(Q1, O-11과 같은 4지선다, 2026-11-16 문구 리뷰): 결혼했어요·결혼 준비 중이에요는
// 이어서 S-11h(했어요 = 결혼한 날, 준비 중 = 예정일)에서 상태와 날짜를 함께 저장.
// 연애 중이에요·같이 살아요는 날짜 없이 바로 저장하고 돌아감 + Toast ‘되돌리기’, 실패하면 이 화면에 남고 안내(2026-11-12 QA 11구간 S11-11).
// 예전 값 ‘아직 안 정했어요’(undecided)는 DB에 그대로 두고(옮기지 않음) 여기서는 고른 것 없이 보여 다시 고르게 함.
export function S11gMarriage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.space)
    return (
      <QuestionSkeleton title={copy.marriageQ} onBack={() => nav('/settings/me')} fields={4} />
    );
  const sp = d.space;
  const saved = (RELATIONS as readonly string[]).includes(sp.marriage_status ?? '')
    ? (sp.marriage_status as Relation)
    : null;
  const saveNoDate = async (status: 'dating' | 'living_together') => {
    if (saving) return;
    const before = {
      marriage_status: sp.marriage_status,
      wedding_date: sp.wedding_date,
      wedding_month: sp.wedding_month,
      wedding_date_estimated: sp.wedding_date_estimated,
    };
    setSaving(true);
    try {
      await updateSpace({ marriage_status: status, wedding_date: null, wedding_month: null });
      await Promise.all([qk.space, qk.careDays].map((k) => qc.invalidateQueries({ queryKey: k })));
      carryToast(copy.saved, {
        label: copy.undo,
        onClick: () =>
          quietly(
            updateSpace(before).then(() =>
              Promise.all(
                [qk.space, qk.careDays].map((k) => qc.invalidateQueries({ queryKey: k })),
              ),
            ),
          ),
      });
      nav('/settings/me', { replace: true });
    } catch {
      toast(copy.failed);
      setSaving(false);
    }
  };
  return (
    <QuestionLayout title={copy.marriageQ} onBack={() => nav('/settings/me')}>
      <ChoiceCards<Relation>
        label={copy.marriageQ}
        value={saved}
        onChange={() => undefined}
        onPick={(v) => {
          if (v === saved) nav('/settings/me');
          else if (v === 'dating' || v === 'living_together') void saveNoDate(v);
          else nav(`/settings/me/wedding?status=${v}`);
        }}
        options={RELATIONS.map((k) => ({
          value: k,
          label: copy.marriageValue[k],
          // O-11과 같은 선택지 그림(Illustrations ‘선택지 그림’)
          icon: (
            {
              married: 'choice-married',
              engaged: 'choice-engaged',
              dating: 'choice-dating',
              living_together: 'choice-living-together',
            } as const
          )[k],
        }))}
      />
    </QuestionLayout>
  );
}
