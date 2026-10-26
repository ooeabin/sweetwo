import { completeSignup } from '@sweetwo/api';
import { ConsentGroup, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { paths } from '../flow';
import { prefs } from '../prefs';
import { session } from '../session';
import { useAuthStore } from '../store';

// 필수 4개: 만 18세 확인(보기 없음, 묶음 맨 위) + 약관 3개(15 A-05 2a, 4번)
const REQUIRED = ['adult', 'terms', 'privacy', 'spaceSharing'] as const;

// 약관 보기: 웹사이트 L-05. 앱 안 보기(BottomSheet, Modal)는 웹사이트가 생기면 붙인다. 지금은 새 창.
const view = (url: string) => () => window.open(url, '_blank', 'noopener,noreferrer');

// A-05 약관 동의. ‘동의하고 계속하기’ = 계정 생성(A-04 이메일 함께).
export function A05Terms() {
  const nav = useNavigate();
  const clearSignup = useAuthStore((s) => s.clearSignup);
  // 화면에 들어올 때의 가입 값. 가입이 끝나 store를 비워도 이 화면이 A-02로 튀지 않게.
  const [signup] = useState(() => useAuthStore.getState().signup);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  if (!signup) return <Navigate to={paths.login} replace />;

  const ready = REQUIRED.every((k) => checked[k]);
  const submit = async () => {
    setSaving(true);
    try {
      await completeSignup({
        provider: signup.provider,
        notifyEmail: signup.notifyEmail,
        marketing: !!checked.marketing,
      });
      clearSignup();
      // 데스크톱은 이 기기 PIN 정하기(A-06), 웹은 온보딩 O-10(온보딩 단계에서 붙임)
      if (
        session.platform === 'desktop' &&
        session.bridge &&
        !(await session.bridge.lock.status()).hasPin &&
        !prefs.pinAsked()
      ) {
        nav(paths.pinSetup, { replace: true });
      } else {
        // 초대 링크(P-01)에서 왔으면 그리로 돌아가 합류를 이어 간다
        const back = prefs.returnTo();
        prefs.setReturnTo(null);
        nav(back ?? paths.home, { replace: true });
      }
    } catch {
      setSaving(false);
      toast(copy.signupFailed, { label: copy.retry, onClick: () => void submit() });
    }
  };

  return (
    <QuestionLayout
      title={copy.termsTitle}
      primary={{ label: copy.agreeContinue, disabled: !ready || saving, loading: saving }}
      onSubmit={() => void submit()}
    >
      <ConsentGroup
        allLabel={copy.agreeAll}
        checked={checked}
        onChange={setChecked}
        viewLabel={copy.view}
        requiredLabel={copy.requiredAll}
        foldLabel={copy.foldRequired}
        items={[
          { key: 'adult', label: copy.adult, required: true },
          { key: 'terms', label: copy.terms, required: true, onView: view(copy.termsUrl.terms) },
          {
            key: 'privacy',
            label: copy.privacy,
            required: true,
            onView: view(copy.termsUrl.privacy),
          },
          {
            key: 'spaceSharing',
            label: copy.spaceSharing,
            required: true,
            onView: view(copy.termsUrl.spaceSharing),
          },
          {
            key: 'marketing',
            label: copy.marketing,
            required: false,
            onView: view(copy.termsUrl.marketing),
          },
        ]}
      />
    </QuestionLayout>
  );
}
