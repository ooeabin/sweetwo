import { qk, updateSpace } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Status = 'married' | 'engaged' | 'undecided';

// S-11g 결혼 상태(Q1, O-11과 같음): 바꾸면 이어서 S-11h(했어요 = 결혼한 날, 준비 중 = 예정일)에서 상태와 날짜를 함께 저장.
// 아직 안 정했어요는 날짜 없이 바로 저장하고 돌아감.
export function S11gMarriage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  if (d.loading || !d.space) return null;
  const saved = (d.space.marriage_status ?? null) as Status | null;
  return (
    <QuestionLayout title={copy.marriageQ} onBack={() => nav('/settings/me')}>
      <ChoiceCards<Status>
        label={copy.marriageQ}
        value={saved}
        onChange={() => undefined}
        onPick={(v) => {
          if (v === saved) nav('/settings/me');
          else if (v === 'undecided')
            void updateSpace({ marriage_status: v, wedding_date: null, wedding_month: null })
              .then(() => qc.invalidateQueries({ queryKey: qk.space }))
              .then(() => nav('/settings/me', { replace: true }));
          else nav(`/settings/me/wedding?status=${v}`);
        }}
        options={(['married', 'engaged', 'undecided'] as const).map((k) => ({
          value: k,
          label: copy.marriageValue[k],
        }))}
      />
    </QuestionLayout>
  );
}
