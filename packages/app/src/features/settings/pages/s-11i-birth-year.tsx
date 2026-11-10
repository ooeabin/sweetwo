import { qk, updateMe } from '@sweetwo/api';
import { birthYearRange } from '@sweetwo/core';
import { DateWheel, QuestionLayout, type YMD, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11i 출생연도(Q4 연도 휠). 본인만, 상대 알림 없음. 2026-11-10 온보딩 O-13을 빼고 자산 순위 F-08에서도 엶(?from=rank → 저장·뒤로 F-08)
// 아직 적은 적이 없으면 처음 위치가 답이 되지 않게 휠을 움직여야 저장(commitInitial false)
export function S11iBirthYear() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const backTo = params.get('from') === 'rank' ? '/assets/rank' : '/settings/me';
  const qc = useQueryClient();
  const d = useSettingsData();
  const [b, setB] = useState<YMD | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me) return <QuestionSkeleton />;
  const range = birthYearRange();
  const title = copy.birthYearQ(d.me.nickname ?? '');
  const y = b?.y ?? d.me.birth_year;
  return (
    <QuestionLayout
      title={title}
      onBack={() => nav(backTo)}
      primary={{ label: copy.save, disabled: !b || b.y === d.me.birth_year, loading: saving }}
      onSubmit={async () => {
        if (!y || saving) return;
        setSaving(true);
        try {
          await updateMe({ birth_year: y });
          await qc.invalidateQueries({ queryKey: qk.me });
          toast(copy.saved);
          nav(backTo, { replace: true });
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
        commitInitial={!!d.me.birth_year}
      />
    </QuestionLayout>
  );
}
