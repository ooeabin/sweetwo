import { qk, updateMe } from '@sweetwo/api';
import { EMAIL_MAX, NotifyEmail } from '@sweetwo/core';
import { Field, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11b 알림 이메일(Q5, 2026-11-04 S-11 줄 → 이 화면). 형식 검사만, 인증 메일 없음. 공백 제거·소문자 저장(NotifyEmail) → S-11
export function S11bNotifyEmail() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me)
    return <QuestionSkeleton title={copy.notifyEmailQ} onBack={() => nav('/settings/me')} />;
  const me = d.me;
  const v = value ?? me.notify_email ?? '';
  const parsed = NotifyEmail.safeParse(v);
  const ok = parsed.success && parsed.data !== me.notify_email;
  return (
    <QuestionLayout
      title={copy.notifyEmailQ}
      onBack={() => nav('/settings/me')}
      primary={{ label: copy.save, disabled: !ok, loading: saving }}
      onSubmit={async () => {
        if (!parsed.success || !ok || saving) return;
        setSaving(true);
        try {
          await updateMe({ notify_email: parsed.data });
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
      <Field
        label={copy.notifyEmail}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={EMAIL_MAX}
        value={v}
        onChange={(e) => setValue(e.target.value)}
        error={v.trim() && !parsed.success ? copy.emailError : undefined}
      />
    </QuestionLayout>
  );
}
