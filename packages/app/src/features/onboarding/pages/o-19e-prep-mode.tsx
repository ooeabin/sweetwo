import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type M = keyof typeof copy.prepModes;

// O-19e 결혼 전 돈 관리 방식(Q1). 기본 선택 없음. 답에 따라 파트 2·3·5·6 구성이 바뀜.
export function O19ePrepMode() {
  const s = useStep('o-19e');
  if (!s.ready) return null;
  return (
    <QuestionLayout steps={s.steps} title={copy.prepMode} onBack={s.onBack}>
      <ChoiceCards<M>
        label={copy.prepMode}
        value={(s.state.space?.prep_money_mode as M | null) ?? null}
        onChange={() => undefined}
        onPick={(v) => void s.done(() => saveSpace({ prep_money_mode: v }))}
        options={(Object.keys(copy.prepModes) as M[]).map((k) => ({
          value: k,
          label: copy.prepModes[k].label,
          sub: copy.prepModes[k].sub,
        }))}
      />
    </QuestionLayout>
  );
}
