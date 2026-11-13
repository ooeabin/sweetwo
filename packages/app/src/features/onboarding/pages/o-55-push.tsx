import { Illustration, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { track } from '../../../shared/analytics';
import { askPush, markPushAsked, markPushLater } from '../../../shared/push-ask';
import { copy } from '../copy';
import { firstPaydayLabel } from '../first-payday';
import { useStep } from '../step';

/** 시작한 사람 기본으로 켜지는 알림 종류(18 P-11 표, 14 v2.2). 시작한 사람은 따로 고르지 않음(S-14에서) */
const STARTER_KINDS = ['care', 'payday', 'achieved', 'shared_change', 'progress_news'];

// O-55 알림 허용(17 v2.2, 2026-11-13 새). 96px 그림 자리 + 날짜 있음 “11월 25일 월급날 아침에 알려 드릴까요?”
// (+ 보조 “경조사 일주일 전에도 알려 드려요”) / 날짜 없음·월급 없음 “경조사와 큰돈 나갈 날 일주일 전에 알려 드릴까요?”.
// ‘알림 받기’ = OS 허용 창(브리지), 결과와 상관없이 → O-60. ‘나중에 할게요’ → O-60, 홈 띠 10번으로 1회 다시 물음
export function O55Push() {
  const s = useStep('o-55');
  const [busy, setBusy] = useState(false);
  if (!s.ready)
    return <QuestionSkeleton chapter={s.chapter} onBack={s.onBack ?? null} fields={0} />;
  const date = firstPaydayLabel(s.state.me);
  const title = date ? copy.pushPayday(date) : copy.pushNoDate;
  const allow = () =>
    void s.done(async () => {
      if (busy) return;
      setBusy(true);
      track('push_permission_asked', { screen_id: 'O-55' });
      const result = await askPush();
      track('push_permission_answered', {
        screen_id: 'O-55',
        result,
        kinds_on: result === 'granted' ? STARTER_KINDS : [],
      });
      setBusy(false);
    });
  const later = () =>
    void s.done(
      async () => {
        markPushAsked();
        markPushLater();
        track('push_permission_answered', { screen_id: 'O-55', result: 'later', kinds_on: [] });
      },
      undefined,
      { answer: 'none' },
    );
  return (
    <QuestionLayout
      chapter={s.chapter}
      onBack={s.onBack}
      hero={<Illustration name="status-push" className="hg-auth__art" />}
      title={title}
      help={date ? copy.pushPaydayHelp : undefined}
      center
      primary={{ label: copy.pushAllow, loading: s.saving || busy }}
      onSubmit={allow}
      later={{ label: copy.later, onClick: later }}
    />
  );
}
