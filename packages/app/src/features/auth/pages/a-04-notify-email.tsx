import { EMAIL_MAX, emailTypoSuggestion, NotifyEmail } from '@sweetwo/core';
import { Field, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { useHardwareBack } from '../back';
import { copy } from '../copy';
import { paths } from '../flow';
import { signOut } from '../sign-out';
import { useAuthStore } from '../store';

// A-04 알림 이메일 입력. 카카오에서 이메일 제공을 거부한 신규만, 건너뛰기 없음.
// 형식 검사(2026-11-10 강화: a@b.c, 점 두 개, 가운데 공백 거부, 254자) + 흔한 도메인 오타면 “혹시 …인가요?”
export function A04NotifyEmail() {
  const nav = useNavigate();
  const { signup, setNotifyEmail } = useAuthStore();
  const [value, setValue] = useState(signup?.notifyEmail ?? '');
  const [touched, setTouched] = useState(false);
  // 뒤로(꺾쇠, Esc, Android 하드웨어 뒤로) = 가입 취소(계정 미생성). 다음엔 A-02부터.
  const back = (via: 'back' | 'hardware_back' = 'back') => {
    track('signup_cancelled', { screen_id: 'A-04', via });
    void signOut().finally(() => nav(paths.login, { replace: true }));
  };
  useHardwareBack(() => back('hardware_back'), !!signup);
  if (!signup) return <Navigate to={paths.login} replace />;

  const parsed = NotifyEmail.safeParse(value);
  const showError = touched && value.trim() !== '' && !parsed.success;
  const typo = parsed.success ? emailTypoSuggestion(parsed.data) : null;

  return (
    <QuestionLayout
      title={copy.emailTitle}
      help={copy.emailHelp}
      onBack={() => back()}
      primary={{ label: copy.next, disabled: !parsed.success }}
      onSubmit={() => {
        if (!parsed.success) return;
        setNotifyEmail(parsed.data);
        nav(paths.terms);
      }}
    >
      <Field
        label={copy.emailLabel}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        maxLength={EMAIL_MAX}
        placeholder={copy.emailPlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTouched(true)}
        error={showError ? copy.emailInvalid : undefined}
      />
      {typo && (
        <p className="hg-help" style={{ margin: 0 }} role="status">
          {copy.emailTypo(typo)}{' '}
          <button type="button" className="hg-btn hg-btn--link" onClick={() => setValue(typo)}>
            {copy.emailTypoFix}
          </button>
        </p>
      )}
    </QuestionLayout>
  );
}
