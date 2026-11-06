import { qk, updateMe } from '@sweetwo/api';
import { NumberWheel, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy, hourLabel } from '../copy';
import { useSettingsData } from '../data';

// S-14a 방해 금지 시간(Q4 시각): 시작·끝 시(한국 시간). 기본 밤 10시 ~ 아침 8시. 저장 → S-14
// 2026-11-03 기본 드롭다운 대신 시작·끝 휠 두 개를 나란히
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function S14aQuiet() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [v, setV] = useState<{ start: number; end: number } | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me)
    return <QuestionSkeleton title={copy.quietQ} onBack={() => nav('/settings/notifications')} />;
  const cur = v ?? { start: d.me.quiet_start ?? 22, end: d.me.quiet_end ?? 8 };
  return (
    <QuestionLayout
      title={copy.quietQ}
      onBack={() => nav('/settings/notifications')}
      primary={{ label: copy.save, loading: saving }}
      onSubmit={async () => {
        if (saving) return;
        setSaving(true);
        try {
          await updateMe({ quiet_start: cur.start, quiet_end: cur.end });
          await qc.invalidateQueries({ queryKey: qk.me });
          nav('/settings/notifications', { replace: true });
        } catch {
          toast(copy.failed);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="hg-row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        {(['start', 'end'] as const).map((k) => (
          <div key={k} className="hg-field" style={{ flex: 1, minWidth: 0 }}>
            <span className="hg-field__label" aria-hidden="true">
              {k === 'start' ? copy.quietStart : copy.quietEnd}
            </span>
            <NumberWheel
              label={k === 'start' ? copy.quietStart : copy.quietEnd}
              value={cur[k]}
              items={HOURS}
              format={hourLabel}
              onChange={(h) => setV({ ...cur, [k]: h })}
            />
          </div>
        ))}
      </div>
    </QuestionLayout>
  );
}
