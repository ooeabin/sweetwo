import { ChoiceCards, QuestionLayout, YearMonthInput } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type H = keyof typeof copy.newlywedHomes;

// O-19d 신혼집 시기(Q1 → Q4). O-15가 전세·월세·자가면 ‘이미 구했어요’ 미리 선택. 결혼 전·후 → 연·월.
// (결혼 전이면 첫 미션 ‘신혼집 계약·잔금일 등록’은 결과 단계에서)
export function O19dNewlywedHome() {
  const s = useStep('o-19d');
  const sp = s.state.space;
  const [pick, setPick] = useState<H | null | undefined>(undefined);
  const [month, setMonth] = useState<string | null | undefined>(undefined);
  if (!s.ready) return null;
  const preset: H | null =
    sp?.housing && ['jeonse', 'monthly_rent', 'own'].includes(sp.housing) ? 'have' : null;
  const p = pick === undefined ? ((sp?.newlywed_home as H | null) ?? preset) : pick;
  const m = month === undefined ? (sp?.newlywed_home_month?.slice(0, 7) ?? null) : month;

  if (pick === 'before' || pick === 'after') {
    return (
      <QuestionLayout
        steps={s.steps}
        title={copy.newlywedWhen}
        onBack={() => setPick(null)}
        primary={{ label: copy.next, disabled: !m, loading: s.saving }}
        onSubmit={() =>
          m && void s.done(() => saveSpace({ newlywed_home: pick, newlywed_home_month: `${m}-01` }))
        }
      >
        <YearMonthInput label={copy.newlywedWhen} value={m} onChange={setMonth} />
      </QuestionLayout>
    );
  }
  return (
    <QuestionLayout steps={s.steps} title={copy.newlywedHome} onBack={s.onBack}>
      <ChoiceCards<H>
        label={copy.newlywedHome}
        value={p}
        onChange={setPick}
        onPick={(x) => {
          if (x === 'have' || x === 'parents')
            void s.done(() => saveSpace({ newlywed_home: x, newlywed_home_month: null }));
        }}
        options={(Object.keys(copy.newlywedHomes) as H[]).map((k) => ({
          value: k,
          label: copy.newlywedHomes[k],
        }))}
      />
    </QuestionLayout>
  );
}
