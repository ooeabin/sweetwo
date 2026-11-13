import { ChoiceCards, QuestionLayout, type Choice } from '@sweetwo/ui';
import { copy } from '../copy';

export type ShareVis = 'all' | 'sum' | 'private';

/** F-03e 선택지(23 v2.2 ‘F-03e 공개 범위’): 모두 / 총액만(+ 보조) / 숨기기(+ 보조). F-04 2번 고치기도 같은 선택지 */
export const shareOptions = (): Choice<ShareVis>[] => [
  { value: 'all', label: copy.visOptions.all },
  { value: 'sum', label: copy.visOptions.sum, sub: copy.visSubs.sum },
  { value: 'private', label: copy.visOptions.private, sub: copy.visSubs.private },
];

/**
 * F-03e 공개 범위(2026-11-13 고친 점): “파트너에게 어떻게 보여 줄까요?”. 미리 고른 값 없음(asset_share_default가 null이면
 * value = null, 고르기 전에는 주 버튼 비활성). 처음 고른 값은 저장할 때 내 새 항목 기본값(set_asset_share_default),
 * 다음부터는 그 값이 골라진 채로. 대출도 같은 질문. F-03 항목 추가와 F-03q 빠르게 적기가 같이 씀
 */
export function F03eShare({
  value,
  onChange,
  onSubmit,
  onBack,
  steps,
  primaryLabel,
  loading,
}: {
  value: ShareVis | null;
  onChange: (v: ShareVis) => void;
  onSubmit: () => void;
  onBack: () => void;
  steps?: { total: number; now: number; fill?: number };
  primaryLabel: string;
  loading?: boolean;
}) {
  return (
    <QuestionLayout
      steps={steps}
      title={copy.visTitle}
      onBack={onBack}
      primary={{ label: primaryLabel, disabled: value === null, loading }}
      onSubmit={() => value !== null && onSubmit()}
    >
      <ChoiceCards<ShareVis>
        label={copy.visTitle}
        value={value}
        onChange={onChange}
        autoAdvance={false}
        options={shareOptions()}
      />
    </QuestionLayout>
  );
}
