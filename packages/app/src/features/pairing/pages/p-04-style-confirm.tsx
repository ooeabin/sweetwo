import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { copy } from '../copy';
import { useJoinSend } from '../data';
import { useJoinStep } from '../join-step';

type Answer = 'ok' | 'send';

// P-04 형태 확인(Q1, 18 ‘P-04 형태 확인’, 2026-11-13 v2.2): “{시작한 사람}님이 이렇게 골랐어요” + 형태 이름(08 2장).
// 각자 계열: ‘좋아요’ / ‘월급은 대부분 {시작한 사람}님에게 보내요’(= 시작한 사람이 관리하는 같이 계열로 바꾸자는 요청.
// 합류는 그대로 진행하고 이 사람은 관리하지 않는 쪽 흐름 P-05c를 탐. 요청은 합류를 마친 순간 보냄, join-split).
// 같이 계열: 확인만(주 버튼 ‘좋아요’). 미리 고른 값 없음. 예전 ‘관리 방식 바꾸기’(set_join_salary_mode)는 없앰
export function P04StyleConfirm() {
  const s = useJoinStep('p-04');
  const d = s.d;
  const { send, setSend } = useJoinSend();
  if (!d.ready || !d.ctx) return <QuestionSkeleton chapter={s.chapter} onBack={s.onBack ?? null} />;
  const starter = d.starterName;
  const title = copy.styleTitle(starter);
  // 한 사람 관리형이면 누가 관리하는지 한 줄 더(2026-11-13 UX B)
  const help =
    d.style === 'one_manager' && d.ctx.manager
      ? `${copy.styleNames.one_manager}. ${copy.managedBy(starter, d.ctx.manager === 'joiner')}`
      : copy.styleNames[d.style];
  if (d.salaryMode === 'joint')
    return (
      <QuestionLayout
        chapter={s.chapter}
        title={title}
        help={help}
        onBack={s.onBack}
        primary={{ label: copy.styleOk, loading: s.saving }}
        onSubmit={() => void s.done()}
      />
    );
  // 대기 뒤 이어서(P-WAIT)는 이미 합류한 사람이라 각자 계열에서 요청을 다시 묻지 않음
  return (
    <QuestionLayout chapter={s.chapter} title={title} help={help} onBack={s.onBack}>
      <ChoiceCards<Answer>
        label={title}
        value={send ? 'send' : null}
        onChange={() => undefined}
        onPick={(v) => {
          // 고른 답에 따라 다음 화면이 바뀜(보내요 → P-05c). 저장은 기기에(합류를 마치면 요청)
          setSend(v === 'send' ? 'chosen' : null);
          void s.done(undefined, 'p-05');
        }}
        options={[
          { value: 'ok', label: copy.styleOk, icon: 'check' },
          { value: 'send', label: copy.styleSend(starter), icon: 'hand-coins' },
        ]}
      />
    </QuestionLayout>
  );
}
