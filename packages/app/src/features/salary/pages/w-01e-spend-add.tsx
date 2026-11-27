import { planInputCheck } from '@sweetwo/core';
import type { BaseDay } from '@sweetwo/core';
import { Chip, FormAmount, FormHero, FormScreen, FormSection, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { money } from '../../../shared/mask';
import { copy } from '../copy';
import { formHero } from '../form-logic';
import { NameChipGroups } from '../name-chips';
import { LineModeBody, PlanLeftHint, type LineSettings } from '../receipt-parts';

const NAME_MAX = 20;

/**
 * W-01e 지출 추가(20 W-01 5b, 2026-11-23 한 화면 입력 FormScreen): 예전 칩 목록 + 금액 시트를 한 화면으로.
 * “어떤 지출이에요?” 이름 칩(2026-11-27 ‘자주 쓰는 것’ + ‘더 보기’ 주제 묶음, + ‘직접 정하기’ → 이름 칸) / “매달 얼마씩?” 금액 / “어떻게 챙겨요?” 구간(월급날 확인, 자동으로 나가요, 확인 안 해요).
 * 화면은 W-01 안에서 열고(W-01 상태 그대로, 닫으면 같은 자리) 저장은 W-01 add가 맡음.
 */
export function W01eSpendAdd({
  taken,
  initial,
  left0,
  masked,
  baseDay,
  busy,
  more,
  onBack,
  onFixIncome,
  onConfirm,
}: {
  /** 이미 있는 지출 이름(칩에서 뺌) */
  taken: string[];
  initial: { name: string; chip: string | null; custom: boolean };
  /** 미계획 금액(이 줄을 더하기 전) */
  left0: number;
  masked: boolean;
  baseDay: BaseDay | null;
  busy: boolean;
  /** 칩 끝 하나 더(“같이 쓰는 통장”을 숨겼을 때 나중에 켤 길) */
  more?: { label: string; onClick: () => void };
  onBack: () => void;
  /** 월급을 넘을 때 ‘월급 고치기’(W-01 3b 월급 금액 시트) */
  onFixIncome?: () => void;
  onConfirm: (o: {
    name: string;
    chip: string | null;
    amount: number;
    settings: LineSettings;
  }) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [chip, setChip] = useState<string | null>(initial.chip);
  const [custom, setCustom] = useState(initial.custom);
  const [amount, setAmount] = useState<number | null>(null);
  // 확인 목록 기본 켬(서버 기본값과 같음, 2026-11-28 생활비 기본 줄 없앰)
  const [set, setSet] = useState<LineSettings>({
    inChecklist: true,
    autoPay: false,
    autoDay: null,
  });
  const shown = (v: number) => money(v, masked);
  // 2026-11-27 칩 한 벌(copy.spendChipGroups): 맨 위 ‘자주 쓰는 것’ 6개, 나머지 주제 묶음은 ‘더 보기’. 이미 있는 이름은 뺌
  type SpendChip = { name: string; code: string };
  const spendGroups: readonly { title: string; chips: readonly SpendChip[] }[] =
    copy.spendChipGroups;
  const all: SpendChip[] = spendGroups.flatMap((g) => [...g.chips]);
  const topCodes: readonly string[] = copy.spendChipTop;
  const free = (c: SpendChip) => !taken.includes(c.name);
  const top = all
    .filter((c) => topCodes.includes(c.code) && free(c))
    .sort((x, y) => topCodes.indexOf(x.code) - topCodes.indexOf(y.code))
    .map((c) => ({ key: c.code, name: c.name }));
  const groups = spendGroups.map((g) => ({
    title: g.title,
    chips: g.chips
      .filter((c) => !topCodes.includes(c.code) && free(c))
      .map((c) => ({ key: c.code, name: c.name })),
  }));
  const customOpen = custom || (name.trim() !== '' && chip === null);
  const unit = amount !== null && amount % 10_000 !== 0;
  // 새 줄이라 바꾸기 전 0원: 0원보다 커서 월급을 넘으면 ‘추가하기’를 막음(06 3-3, 2026-11-26)
  const check = planInputCheck({ left0, before: 0, after: amount });
  const ready = name.trim() !== '' && amount !== null && !unit && !check.blocked;
  const pickChip = (c: { name: string; code: string }) => {
    setCustom(false);
    setName(c.name);
    setChip(c.code);
  };
  return (
    <FormScreen
      title={copy.formSpendTitle}
      backLabel={copy.back}
      onBack={onBack}
      hero={
        <FormHero
          lines={formHero({
            name,
            amount,
            verb: copy.formVerbSpend,
            what: copy.formWhat,
            money: shown,
          })}
        />
      }
      primary={{ label: copy.addDone, disabled: !ready, loading: busy }}
      onSubmit={() =>
        amount !== null && onConfirm({ name: name.trim(), chip, amount, settings: set })
      }
    >
      <FormSection title={copy.formSpendNameQ}>
        <NameChipGroups
          label={copy.spendChipsLabel}
          topTitle={copy.spendChipTopTitle}
          top={top}
          groups={groups}
          selected={custom ? null : chip}
          onPick={(c) => pickChip({ name: c.name, code: c.key })}
          tail={
            <>
              {more && (
                <Chip small onClick={more.onClick}>
                  {more.label}
                </Chip>
              )}
              <Chip
                small
                selected={customOpen}
                onClick={() => {
                  setCustom(true);
                  if (chip !== null) setName('');
                  setChip(null);
                }}
              >
                {copy.spendEmpty.other}
              </Chip>
            </>
          }
        />
        {customOpen && (
          <ShortText
            label={copy.newLineName}
            value={name}
            onChange={(v) => {
              setName(v);
              setChip(null);
            }}
            max={NAME_MAX}
            placeholder={copy.ownName}
          />
        )}
      </FormSection>
      <FormSection
        title={copy.formMonthlyQ}
        aside={left0 > 0 ? `${copy.leftoverLabel} ${shown(left0)}` : undefined}
      >
        <FormAmount
          label={copy.formMonthlyQ}
          sheetTitle={copy.formMonthlyKeypad}
          closeLabel={copy.close}
          confirmLabel={copy.ok}
          value={amount}
          onChange={setAmount}
          invalid={unit}
          below={
            <>
              {unit && <p className="hg-help is-error">{copy.tenThousandUnit}</p>}
              {amount !== null && (
                <PlanLeftHint left={check.left} text={shown} onFixIncome={onFixIncome} />
              )}
              <p className="hg-help">{copy.addMyShareHint}</p>
            </>
          }
        />
      </FormSection>
      <FormSection title={copy.formHowQ}>
        <LineModeBody value={set} onChange={setSet} allowOff={baseDay !== null} payday={baseDay} />
      </FormSection>
    </FormScreen>
  );
}
