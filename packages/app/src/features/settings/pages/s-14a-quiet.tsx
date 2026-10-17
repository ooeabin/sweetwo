import { qk, updateMe } from '@sweetwo/api';
import { QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy, hourLabel } from '../copy';
import { useSettingsData } from '../data';

// S-14a 방해 금지 시간(Q4 시각): 시작·끝 시(한국 시간). 기본 밤 10시 ~ 아침 8시. 저장 → S-14
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function HourSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (h: number) => void;
}) {
  const id = useId();
  return (
    <div className="hg-field">
      <label className="hg-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="hg-input"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function S14aQuiet() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [v, setV] = useState<{ start: number; end: number } | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me) return null;
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
      <div className="hg-fields">
        <HourSelect
          label={copy.quietStart}
          value={cur.start}
          onChange={(start) => setV({ ...cur, start })}
        />
        <HourSelect
          label={copy.quietEnd}
          value={cur.end}
          onChange={(end) => setV({ ...cur, end })}
        />
      </div>
    </QuestionLayout>
  );
}
