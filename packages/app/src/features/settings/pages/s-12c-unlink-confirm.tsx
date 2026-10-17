import { qk, requestUnlink } from '@sweetwo/api';
import { Field, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { useJointAssets, useUnlinkDraft } from '../unlink';

// S-12c “연결 해제” 입력 후 보내기. 입력이 “연결 해제”와 다르면 보내기 비활성. 보내면 해제 대기 → S-12
export function S12cUnlinkConfirm() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const joint = useJointAssets();
  const draft = useUnlinkDraft();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.c || joint.loading) return null;
  const c = d.c;
  const ok = text.trim() === copy.confirmWord;
  const send = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const shares: Record<string, number> = {};
      for (const [id, v] of Object.entries(draft.shares)) if (v !== null) shares[id] = v;
      await requestUnlink(shares, copy.confirmWord);
      draft.reset();
      await Promise.all([qk.space, qk.unlink].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(copy.sent(c.partnerName));
      nav('/settings/couple', { replace: true });
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      steps={{ total: 3, now: 2 }}
      title={copy.confirmQ}
      onBack={() =>
        nav(joint.rows.length ? '/settings/couple/unlink/plan' : '/settings/couple/unlink')
      }
      primary={{ label: copy.send, disabled: !ok, loading: busy }}
      onSubmit={() => void send()}
    >
      <Field
        label={copy.confirmWord}
        value={text}
        placeholder={copy.confirmWord}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
    </QuestionLayout>
  );
}
