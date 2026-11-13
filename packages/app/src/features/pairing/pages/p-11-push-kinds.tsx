import { qk, setPushKinds } from '@sweetwo/api';
import { QuestionLayout, QuestionSkeleton, Toggle } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { askPush, markPushAsked } from '../../../shared/push-ask';
import { afterSetupPath } from '../../auth';
import { copy } from '../copy';
import { useJoinData, useJoinSend } from '../data';
import { pushKindRows } from '../push-kinds';

// P-11 알림 종류 골라 켜기(18 ‘P-10, P-11 고친 점’, 2026-11-13 v2.2, 1회, P-10 다음). 제목 “이런 알림을 보내 드려요”
// + 실제 오는 종류만 스위치(18 P-11 표, push-kinds.ts). ‘알림 받기’ = OS 허용 창(브리지) + 종류 저장,
// ‘나중에 할게요’ = 종류는 기본값으로 저장. 어느 쪽이든 A-06 앱 잠금 권장(아직 안 물었으면) → 홈. 같은 목록이 S-14
export function P11PushKinds() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useJoinData();
  const setSend = useJoinSend((x) => x.setSend);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  if (!d.ready || !d.me) return <QuestionSkeleton onBack={null} fields={0} />;
  const me = d.me;
  const rows = pushKindRows({
    joint: d.salaryMode === 'joint',
    nonManager: d.nonManager,
    hasPlan: (me.monthly_income ?? 0) > 0,
  });
  const value = (k: string, on: boolean) => picked[k] ?? on;
  const kinds = Object.fromEntries(rows.map((r) => [r.kind, value(r.kind, r.on)]));
  const leave = async (allow: boolean) => {
    if (busy) return;
    setBusy(true);
    track('push_permission_asked', { screen_id: 'P-11' });
    const result = allow ? await askPush() : 'later';
    if (!allow) markPushAsked();
    await setPushKinds(me.id, (me.push_kinds ?? {}) as Record<string, boolean>, kinds).catch(
      () => undefined,
    );
    void qc.invalidateQueries({ queryKey: qk.me });
    track('push_permission_answered', {
      screen_id: 'P-11',
      result,
      kinds_on: Object.keys(kinds).filter((k) => kinds[k]),
    });
    // P-04 ‘보내요’ 흐름은 여기까지(요청은 이미 보냄)
    setSend(null);
    nav(await afterSetupPath(), { replace: true });
  };
  return (
    <QuestionLayout
      title={copy.kindsTitle}
      primary={{ label: copy.pushAllow, loading: busy }}
      onSubmit={() => void leave(true)}
      later={{ label: copy.later, onClick: () => void leave(false) }}
    >
      <section className="hg-card hg-stack" aria-label={copy.kindsTitle}>
        {rows.map((r) => {
          const c = copy.kinds[r.kind];
          return (
            <Toggle
              key={r.kind}
              label={typeof c === 'function' ? c(d.starterName) : c}
              checked={value(r.kind, r.on)}
              onChange={(on) => setPicked((p) => ({ ...p, [r.kind]: on }))}
            />
          );
        })}
      </section>
    </QuestionLayout>
  );
}
