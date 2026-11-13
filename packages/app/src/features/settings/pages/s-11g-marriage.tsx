import { qk, updateSpace } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Status = 'married' | 'engaged' | 'undecided';

// S-11g 결혼 상태(Q1, O-11과 같음): 바꾸면 이어서 S-11h(했어요 = 결혼한 날, 준비 중 = 예정일)에서 상태와 날짜를 함께 저장.
// 아직 안 정했어요는 날짜 없이 바로 저장하고 돌아감 + Toast ‘되돌리기’, 실패하면 이 화면에 남고 안내(2026-11-12 QA 11구간 S11-11).
export function S11gMarriage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.space)
    return (
      <QuestionSkeleton title={copy.marriageQ} onBack={() => nav('/settings/me')} fields={3} />
    );
  const sp = d.space;
  const saved = (sp.marriage_status ?? null) as Status | null;
  const saveUndecided = async () => {
    if (saving) return;
    const before = {
      marriage_status: sp.marriage_status,
      wedding_date: sp.wedding_date,
      wedding_month: sp.wedding_month,
      wedding_date_estimated: sp.wedding_date_estimated,
    };
    setSaving(true);
    try {
      await updateSpace({ marriage_status: 'undecided', wedding_date: null, wedding_month: null });
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
      <ChoiceCards<Status>
        label={copy.marriageQ}
        value={saved}
        onChange={() => undefined}
        onPick={(v) => {
          if (v === saved) nav('/settings/me');
          else if (v === 'undecided') void saveUndecided();
          else nav(`/settings/me/wedding?status=${v}`);
        }}
        options={(['married', 'engaged', 'undecided'] as const).map((k) => ({
          value: k,
          label: copy.marriageValue[k],
          // 2026-11-08 온보딩과 같은 선택지 아이콘 자리(지금은 빈 자리, Illustrations ‘나중 과제’ 5번)
          icon: ({ married: 'heart', engaged: 'diamond', undecided: 'ellipsis' } as const)[k],
        }))}
      />
    </QuestionLayout>
  );
}
