import { qk, updateMe } from '@sweetwo/api';
import { QuestionLayout, ShortText, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11a 호칭(Q5): “내 이름이나 애칭을 알려 주세요”, O-03 규칙(10자). 바꾸면 파트너 화면 호칭도 바뀜 → S-11
export function S11aNickname() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me)
    return <QuestionSkeleton title={copy.nicknameQ} onBack={() => nav('/settings/me')} />;
  const v = value ?? d.me.nickname ?? '';
  const ok = !!v.trim() && v.trim() !== d.me.nickname;
  return (
    <QuestionLayout
      title={copy.nicknameQ}
      onBack={() => nav('/settings/me')}
      primary={{ label: copy.save, disabled: !ok, loading: saving }}
      onSubmit={async () => {
        if (!ok || saving) return;
        setSaving(true);
        try {
          await updateMe({ nickname: v.trim() });
          await qc.invalidateQueries({ queryKey: qk.me });
          nav('/settings/me', { replace: true });
        } catch {
          toast(copy.failed);
        } finally {
          setSaving(false);
        }
      }}
    >
      <ShortText label={copy.nickname} value={v} onChange={setValue} max={10} />
    </QuestionLayout>
  );
}
