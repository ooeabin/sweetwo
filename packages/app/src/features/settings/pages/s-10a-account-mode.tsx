import { qk, updateSpace } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Mode = 'single' | 'roles';

// S-10a 통장 방식(Q1, docs/spec/25-settings.md, 06 2장): “통장 하나로 써요” / “역할별로 나눠 쓸래요”.
// 바꾸면 다음 사이클 플랜부터(couple_space.account_mode_next, 플랜을 만들 때 바뀜). 저장 → S-10
export function S10aAccountMode() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [v, setV] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.space) return null;
  const sp = d.space;
  const now: Mode = (sp.account_mode_next ?? sp.account_mode ?? 'single') as Mode;
  const save = async (m: Mode) => {
    if (busy) return;
    if (m === now) return nav('/settings', { replace: true });
    setBusy(true);
    try {
      // 지금 방식으로 되돌리면 예약을 지움
      await updateSpace({ account_mode_next: m === sp.account_mode ? null : m });
      await qc.invalidateQueries({ queryKey: qk.space });
      if (m !== sp.account_mode) toast(copy.accountModeNext);
      nav('/settings', { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  return (
    <QuestionLayout title={copy.accountModeQ} onBack={() => nav('/settings')}>
      <ChoiceCards<Mode>
        label={copy.accountModeQ}
        value={v ?? now}
        onChange={setV}
        onPick={(m) => void save(m)}
        options={(['single', 'roles'] as const).map((m) => ({
          value: m,
          label: copy.accountModes[m] ?? m,
        }))}
      />
    </QuestionLayout>
  );
}
