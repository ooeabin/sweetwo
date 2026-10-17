import { qk, setMySide } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Side = 'groom' | 'bride';

// S-11b 신랑·신부(Q1): “신랑·신부 중 누구예요?”. 양가 구분에만 씀. 바꾸면 배우자 쪽과 쪽으로 저장한 값(가족, 챙길 날,
// 월급 나누기 몫)도 서버가 같이 바꿈 → S-11
export function S11bSide() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [v, setV] = useState<Side | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me) return null;
  const cur: Side | null = v ?? (d.me.side === 'bride' || d.me.side === 'groom' ? d.me.side : null);
  const save = async (side: Side) => {
    if (saving) return;
    if (side === d.me?.side) return nav('/settings/me', { replace: true });
    setSaving(true);
    try {
      await setMySide(side);
      await Promise.all(
        [qk.me, qk.partner, qk.family, qk.careDays, ['monthly_plan']].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      );
      nav('/settings/me', { replace: true });
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <QuestionLayout title={copy.sideQ} onBack={() => nav('/settings/me')}>
      <ChoiceCards<Side>
        label={copy.sideQ}
        value={cur}
        onChange={setV}
        onPick={(s) => void save(s)}
        options={(['groom', 'bride'] as const).map((s) => ({ value: s, label: copy.sides[s] }))}
      />
    </QuestionLayout>
  );
}
