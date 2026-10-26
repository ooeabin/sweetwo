import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Status = 'married' | 'engaged';

// S-11g 결혼 상태(Q1, O-11과 같음): 바꾸면 이어서 S-11h(했어요 = 결혼한 날, 준비 중 = 예정일)에서 상태와 날짜를 함께 저장.
export function S11gMarriage() {
  const nav = useNavigate();
  const d = useSettingsData();
  if (d.loading || !d.space) return null;
  const saved = (d.space.marriage_status ?? null) as Status | null;
  return (
    <QuestionLayout title={copy.marriageQ} onBack={() => nav('/settings/me')}>
      <ChoiceCards<Status>
        label={copy.marriageQ}
        value={saved}
        onChange={() => undefined}
        onPick={(v) =>
          v === saved ? nav('/settings/me') : nav(`/settings/me/wedding?status=${v}`)
        }
        options={(['married', 'engaged'] as const).map((k) => ({
          value: k,
          label: copy.marriageValue[k],
        }))}
      />
    </QuestionLayout>
  );
}
