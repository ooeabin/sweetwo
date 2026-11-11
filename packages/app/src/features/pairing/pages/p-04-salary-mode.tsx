import { setJoinSalaryMode } from '@sweetwo/api';
import { ChoiceCards, Modal, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';

type Mode = 'separate' | 'joint';
/** 분석 이벤트 값(32 4-4: separate / combined) */
const asEvent = (m: Mode) => (m === 'joint' ? 'combined' : 'separate');

// P-04 관리 방식 확인(Q1, O-30 틀): 시작한 사람 답이 선택된 채 열림. 바꾸면 바로 둘 다에게 적용 + 시작한 사람 알림(서버).
// 다른 방식을 고르면 주 버튼 위 결과 한 줄, ‘다음’은 확인 Modal 뒤에 적용(2026-11-09 round 3).
export function P04SalaryMode() {
  const s = useJoinStep('p-04');
  const d = s.d;
  const [v, setV] = useState<Mode | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (!d.ready || !d.ctx) return <QuestionSkeleton chapter={s.chapter} onBack={s.onBack ?? null} />;
  const saved: Mode = d.salaryMode;
  const value = v ?? saved;
  const starter = d.starterName;
  const changed = value !== saved;
  const apply = () =>
    void s.done(() => {
      if (!changed) return Promise.resolve();
      track('salary_mode_changed', { from: asEvent(saved), to: asEvent(value), entry: 'p04' });
      return setJoinSalaryMode(value);
    });
  return (
    <>
      <QuestionLayout
        chapter={s.chapter}
        title={copy.modeTitle(starter)}
        help={copy.modeHelp}
        onBack={s.onBack}
        note={changed ? copy.modeResult[value](starter) : undefined}
        primary={{ label: copy.next, loading: s.saving }}
        onSubmit={() => (changed ? setConfirm(true) : apply())}
      >
        <ChoiceCards<Mode>
          label={copy.modeTitle(starter)}
          value={value}
          onChange={setV}
          autoAdvance={false}
          options={(['separate', 'joint'] as const).map((k) => ({
            value: k,
            label: copy.modes[k].label,
            // 2026-11-08 온보딩과 같은 선택지 아이콘 자리(지금은 빈 자리, Illustrations ‘나중 과제’ 5번)
            icon: k === 'separate' ? 'user' : 'users-three',
            sub: copy.modes[k].sub,
          }))}
        />
      </QuestionLayout>
      {confirm && (
        <Modal
          tone="primary"
          title={copy.modeConfirmTitle}
          body={copy.modeConfirmBody(starter)}
          confirmLabel={copy.modeConfirmOk}
          cancelLabel={copy.modeConfirmCancel}
          busy={s.saving}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            apply();
          }}
        />
      )}
    </>
  );
}
