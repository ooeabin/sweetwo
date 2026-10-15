import { NotifyEmail } from '@sweetwo/core';
import { Field, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { paths } from '../flow';
import { session } from '../session';
import { useAuthStore } from '../store';

// A-04 알림 이메일 입력. 카카오에서 이메일 제공을 거부한 신규만, 건너뛰기 없음.
export function A04NotifyEmail() {
  const nav = useNavigate();
  const { signup, setNotifyEmail, clearSignup } = useAuthStore();
  const [value, setValue] = useState(signup?.notifyEmail ?? '');
  const [touched, setTouched] = useState(false);
  if (!signup) return <Navigate to={paths.login} replace />;

  const parsed = NotifyEmail.safeParse(value);
  const showError = touched && value.trim() !== '' && !parsed.success;

  // 뒤로 = 가입 취소(계정 미생성). 다음엔 A-02부터.
  const back = async () => {
    clearSignup();
    await session.signOut();
    nav(paths.login, { replace: true });
  };

  return (
    <QuestionLayout
      title={copy.emailTitle}
      help={copy.emailHelp}
      onBack={() => void back()}
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
        autoFocus
        placeholder={copy.emailPlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTouched(true)}
        error={showError ? copy.emailInvalid : undefined}
      />
    </QuestionLayout>
  );
}
