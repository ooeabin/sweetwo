import { registerPushDevice } from '@sweetwo/api';
import { Button, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';

const ASKED = 'sweetwo.pushAsked';
export const pushAsked = () => {
  try {
    return localStorage.getItem(ASKED) === '1';
  } catch {
    return true;
  }
};
const markAsked = () => {
  try {
    localStorage.setItem(ASKED, '1');
  } catch {
    /* 기억 못 하면 다음에 한 번 더 물을 수 있음 */
  }
};

/** 합류를 마친 모바일 앱이고 아직 허용을 묻지 않았으면 true(18 ‘모바일 앱이면 합류 완료 직후 푸시 알림 허용을 1회 물음’) */
export async function shouldAskPush() {
  const push = window.sweetwo?.push;
  if (!push || pushAsked()) return false;
  return (await push.status().catch(() => 'denied')) === 'prompt';
}

// P-11 합류 완료 직후 푸시 허용(18 앞부분, 1회). ‘알림 받기’ = OS 허용 창 → 허용되면 기기 등록. 어느 쪽이든 홈으로
export function P11Push() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const home = () => {
    markAsked();
    nav('/', { replace: true });
  };
  const allow = async () => {
    const b = window.sweetwo;
    if (busy || !b?.push) return home();
    setBusy(true);
    if (await b.push.request().catch(() => false)) {
      const t = await b.push.token().catch(() => null);
      const pf = b.platform;
      if (t && (pf === 'ios' || pf === 'android'))
        await registerPushDevice(pf, t, b.appVersion).catch(() => undefined);
    }
    home();
  };
  return (
    <QuestionLayout
      title={copy.pushTitle}
      help={copy.pushHelp}
      primary={{ label: copy.pushAllow, loading: busy }}
      onSubmit={() => void allow()}
      center
    >
      <Button variant="ghost" onClick={home}>
        {copy.later}
      </Button>
    </QuestionLayout>
  );
}
