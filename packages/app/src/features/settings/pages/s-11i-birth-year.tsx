import { qk, updateMe } from '@sweetwo/api';
import { birthYearRange } from '@sweetwo/core';
import { DateWheel, QuestionLayout, type YMD } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11i 출생연도(Q4 연도 휠, O-13과 같음). 본인만, 상대 알림 없음.
export function S11iBirthYear() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [b, setB] = useState<YMD | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me) return null;
  const range = birthYearRange();
  const title = copy.birthYearQ(d.me.nickname ?? '');
  const y = b?.y ?? d.me.birth_year;
  return (
    <QuestionLayout
      title={title}
      onBack={() => nav('/settings/me')}
      primary={{ label: copy.save, disabled: !b || b.y === d.me.birth_year, loading: saving }}
      onSubmit={async () => {
        if (!y || saving) return;
        setSaving(true);
        try {
          await updateMe({ birth_year: y });
          await qc.invalidateQueries({ queryKey: qk.me });
          toast(copy.saved);
          nav('/settings/me', { replace: true });
        } catch {
          toast(copy.failed);
        } finally {
          setSaving(false);
        }
      }}
    >
      <DateWheel
        label={title}
        value={b}
        onChange={setB}
        minYear={range.min}
        maxYear={range.max}
        initial={{ y: d.me.birth_year ?? range.max - 12, m: 1, d: 1 }}
        yearOnly
      />
    </QuestionLayout>
  );
}
