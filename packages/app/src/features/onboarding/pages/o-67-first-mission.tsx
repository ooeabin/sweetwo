import { parseYm } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { cycleOf } from '../result';
import { useStep } from '../step';

// O-67 첫 미션. 이 화면부터 ← 없음. ‘지금 하기’, ‘나중에 할게요’ 모두 온보딩을 마치고 이번 달로.
// ‘지금 하기’가 열 화면(챙길 날 양가 등록, G-07 결혼 비용 항목)은 아직 없어서 지금은 이번 달로 간다.
export function O67FirstMission() {
  const s = useStep('o-67');
  if (!s.ready) return null;
  const cycle = cycleOf(s.state);
  const month = cycle ? parseYm(cycle.labelMonth).m : Number(new Date().getMonth() + 1);
  const engaged = s.state.space?.marriage_status === 'engaged';
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.started(month)}
      help={engaged ? copy.missionEngaged : copy.missionMarried}
      later={{ label: copy.later, onClick: () => void s.finish() }}
      primary={{ label: copy.doNow, loading: s.saving }}
      onSubmit={() => void s.finish()}
    />
  );
}
