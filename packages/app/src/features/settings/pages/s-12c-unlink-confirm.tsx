import { qk, requestUnlink } from '@sweetwo/api';
import { splitPercent, todayKst, unlinkShare } from '@sweetwo/core';
import { Field, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { useJointAssets, useUnlinkDraft } from '../unlink';

/** 함께 쓴 개월 수(공간 만든 달부터). 값이 없거나 깨졌으면 0 */
function monthsSince(at: string | undefined): number {
  const t = at ? Date.parse(at) : NaN;
  if (Number.isNaN(t)) return 0;
  const [y0 = 0, m0 = 0] = todayKst(new Date(t)).split('-').map(Number);
  const [y1 = 0, m1 = 0] = todayKst().split('-').map(Number);
  return Math.max(0, (y1 - y0) * 12 + (m1 - m0));
}

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
      const pct = d.space
        ? splitPercent(d.space.split_mode, c.myIncome, c.partnerIncome, c.myRatio)
        : 50;
      const custom = joint.rows.some(
        (a) => a.id in shares && shares[a.id] !== unlinkShare(a.amount, pct),
      );
      track('unlink_requested', {
        split_plan: custom ? 'custom' : 'default',
        linked_months: monthsSince(d.space?.created_at),
      });
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
