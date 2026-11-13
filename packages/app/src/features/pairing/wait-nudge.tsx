import { nudgeStarter } from '@sweetwo/api';
import { useState } from 'react';
import { toast } from '../../shared/toast';
import { copy } from './copy';

/**
 * 대기 화면(홈 상태 변형 4) 글자 버튼 ‘알려 주기’(18 v2.2): 같이 계열에서 시작한 사람이 아직 월급 계획을 만들지 않았을 때
 * 시작한 사람에게 “{이름}님이 기다리고 있어요. 월급 계획을 마쳐 주세요” 알림, 24시간에 1번(서버 nudge_starter)
 */
export function WaitNudge({ starter }: { starter: string }) {
  const [busy, setBusy] = useState(false);
  const nudge = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await nudgeStarter();
      if (r === 'sent') toast(copy.nudgeSent(starter));
      else if (r === 'too_soon') toast(copy.nudgeTooSoon);
    } catch {
      toast(copy.saveFailed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      className={`hg-btn hg-btn--link${busy ? ' is-loading' : ''}`}
      aria-busy={busy || undefined}
      onClick={() => void nudge()}
    >
      {copy.nudge}
    </button>
  );
}
