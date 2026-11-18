import {
  ReceiptCard,
  ReceiptRows,
  ReceiptSection,
  ReceiptStage,
  ReceiptTotal,
  type ReceiptLine,
} from '@sweetwo/ui';
import { speakMasked } from '../../shared/masked-text';
import { copy } from './copy';

// W-11f ‘이렇게 들어가요’ 미리 보기(2026-11-18, docs/spec/20 W-11f, ReceiptCard.md ‘미리 보기 변형’).
// 저장하면 월급 계획 템플릿(W-01) ‘저축·투자’ 묶음 맨 아래에 새 줄이 생기고 미계획 금액이 그만큼 줄어드는 것을
// 만들기 전에 작은 영수증으로 보임. 합쳐서면 공동 템플릿, 각자면 내 템플릿 기준(받는 쪽이 줄·금액을 계산해서 줌).

const NO_EDIT = {
  handle: () => '',
  up: () => '',
  down: () => '',
  moved: () => '',
  remove: '',
  removeLabel: () => '',
  locked: '',
};

/** 이 화면이 보일 줄 구성(순수 함수라 따로 두고 테스트): 기존 줄은 최대 2개 + “외 n개”, 새 줄은 맨 아래 */
export function previewSavingLines(
  existing: { id: string; name: string; amount: number }[],
  fresh: { name: string; monthly: number },
  won: (v: number) => string,
): ReceiptLine[] {
  const shown = existing.slice(0, 2).map<ReceiptLine>((l) => ({
    id: l.id,
    name: l.name,
    amount: copy.monthlyShort(won(l.amount)),
  }));
  const rest = existing.length - shown.length;
  if (rest > 0)
    shown.push({ id: 'more', name: copy.addPreviewMore(rest), amount: '', muted: true });
  shown.push({
    id: 'new',
    name: fresh.name,
    amount: fresh.monthly > 0 ? copy.monthlyShort(won(fresh.monthly)) : copy.addPreviewNoAmount,
    badge: copy.addPreviewNew,
    fresh: true,
    muted: fresh.monthly === 0,
  });
  return shown;
}

export function SavingPreview({
  existing,
  name,
  monthly,
  left,
  won,
}: {
  existing: { id: string; name: string; amount: number }[];
  name: string;
  monthly: number;
  /** 지금 미계획 금액(0원 아래도 그대로 받음) */
  left: number;
  won: (v: number) => string;
}) {
  const after = left - monthly;
  const lines = previewSavingLines(existing, { name, monthly }, won);
  const to = after >= 0 ? won(after) : copy.short(won(-after));
  const amount =
    monthly > 0 ? copy.addPreviewArrow(won(Math.max(left, 0)), to) : won(Math.max(left, 0));
  return (
    <ReceiptStage label={copy.addPreviewLabel}>
      <ReceiptCard>
        <div className="hg-receipt__head hg-receipt__head--plain">
          <h2 className="hg-receipt__headtitle">{copy.addPreviewHead}</h2>
        </div>
        <ReceiptSection title={copy.savingGroup}>
          <ReceiptRows label={copy.savingGroup} lines={lines} labels={NO_EDIT} />
        </ReceiptSection>
        <ReceiptTotal
          rows={[
            {
              label: copy.leftoverLabel,
              amount: speakMasked(amount),
              strong: true,
              short: monthly > 0 && after < 0,
            },
          ]}
        />
      </ReceiptCard>
    </ReceiptStage>
  );
}
