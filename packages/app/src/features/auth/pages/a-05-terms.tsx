import { completeSignup } from '@sweetwo/api';
import { formatDateFull, todayKst } from '@sweetwo/core';
import { ConsentGroup, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { sharedCopy } from '../../../shared/copy';
import { toast } from '../../../shared/toast';
import { useHardwareBack } from '../back';
import { ConsentDocSheet, openPolicy, type ConsentDocKey } from '../consent-doc';
import { copy } from '../copy';
import { paths } from '../flow';
import { prefs } from '../prefs';
import { session } from '../session';
import { signOut } from '../sign-out';
import { useAuthStore } from '../store';

// 필수 4개: 만 18세 확인(보기 없음, 묶음 맨 위) + 약관 3개(15 A-05 2a, 4번)
const REQUIRED = ['adult', 'terms', 'privacy', 'spaceSharing'] as const;

// A-05 약관 동의. ‘동의하고 계속하기’ = 계정 생성(A-04 이메일 함께).
// 뒤로(꺾쇠, Esc, Android 하드웨어 뒤로) = 가입 취소: 로그아웃하고 A-02(계정은 만들지 않음, 2026-11-10)
export function A05Terms() {
  const nav = useNavigate();
  const clearSignup = useAuthStore((s) => s.clearSignup);
  // 화면에 들어올 때의 가입 값. 가입이 끝나 store를 비워도 이 화면이 A-02로 튀지 않게.
  const [signup] = useState(() => useAuthStore.getState().signup);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<ConsentDocKey | null>(null);
  const cancel = (via: 'back' | 'hardware_back' = 'back') => {
    if (saving) return;
    track('signup_cancelled', { screen_id: 'A-05', via });
    void signOut().finally(() => nav(paths.login, { replace: true }));
  };
  useHardwareBack(() => cancel('hardware_back'), !!signup && !doc);
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
      // 마케팅 받기에 동의했으면 처리 결과(날짜, 동의, 보낸 곳)를 알림(31 5-1). 알림 센터에도 남음(서버)
      if (checked.marketing) toast(sharedCopy.marketingResult(true, formatDateFull(todayKst())));
      // 앱은 이 기기 PIN 정하기(A-06), 웹은 온보딩 O-10(온보딩 단계에서 붙임)
      if (session.bridge && !(await session.bridge.lock.status()).hasPin && !prefs.pinAsked()) {
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
    <>
      <QuestionLayout
        title={copy.termsTitle}
        onBack={() => cancel()}
        primary={{ label: copy.agreeContinue, disabled: !ready, loading: saving }}
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
            {
              key: 'terms',
              label: copy.terms,
              required: true,
              onView: () => openPolicy(copy.termsUrl.terms),
            },
            {
              key: 'privacy',
              label: copy.privacy,
              required: true,
              onView: () => setDoc('privacy'),
            },
            {
              key: 'spaceSharing',
              label: copy.spaceSharing,
              required: true,
              onView: () => setDoc('spaceSharing'),
            },
            {
              key: 'marketing',
              label: copy.marketing,
              required: false,
              onView: () => setDoc('marketing'),
            },
          ]}
        />
      </QuestionLayout>
      {doc && <ConsentDocSheet doc={doc} onClose={() => setDoc(null)} />}
    </>
  );
}
