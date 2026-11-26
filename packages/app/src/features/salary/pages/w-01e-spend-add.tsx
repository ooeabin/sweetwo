import { planInputCheck } from '@sweetwo/core';
import type { BaseDay } from '@sweetwo/core';
import { Chip, FormAmount, FormHero, FormScreen, FormSection, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { money } from '../../../shared/mask';
import { copy } from '../copy';
import { formHero } from '../form-logic';
import { LineModeBody, PlanLeftHint, type LineSettings } from '../receipt-parts';

const NAME_MAX = 20;

/**
 * W-01e 지출 추가(20 W-01 5b, 2026-11-23 한 화면 입력 FormScreen): 예전 칩 목록 + 금액 시트를 한 화면으로.
 * “어떤 지출이에요?” 이름 칩(+ ‘직접 정하기’ → 이름 칸) / “매달 얼마씩?” 금액 / “어떻게 챙겨요?” 구간(월급날 확인, 자동으로 나가요, 확인 안 해요).
 * 화면은 W-01 안에서 열고(W-01 상태 그대로, 닫으면 같은 자리) 저장은 W-01 add가 맡음.
 */
export function W01eSpendAdd({
  chips,
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
  chips: readonly { name: string; code: string }[];
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
  // 생활비 칩은 기본 생활비 줄이라 확인 목록 기본 끔, 그 밖은 켬(서버 기본값과 같음)
  const [set, setSet] = useState<LineSettings>({
    inChecklist: initial.chip !== 'living',
    autoPay: false,
    autoDay: null,
  });
  const shown = (v: number) => money(v, masked);
  const shownChips = chips.filter((c) => !taken.includes(c.name));
  const customOpen = custom || (name.trim() !== '' && chip === null);
  const unit = amount !== null && amount % 10_000 !== 0;
  // 새 줄이라 바꾸기 전 0원: 0원보다 커서 월급을 넘으면 ‘추가하기’를 막음(06 3-3, 2026-11-26)
  const check = planInputCheck({ left0, before: 0, after: amount });
  const ready = name.trim() !== '' && amount !== null && !unit && !check.blocked;
  const pickChip = (c: { name: string; code: string }) => {
    setCustom(false);
    setName(c.name);
    setChip(c.code);
    // 생활비 칩으로 바꾸거나 벗어날 때만 확인 목록 기본값을 따라감(구간을 이미 만졌으면 그대로)
    if (!set.autoPay) setSet({ ...set, inChecklist: c.code !== 'living' });
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
        <div className="hg-form__chips" role="group" aria-label={copy.spendChipsLabel}>
          {shownChips.map((c) => (
            <Chip
              key={c.code}
              small
              selected={!custom && chip === c.code}
              onClick={() => pickChip(c)}
            >
              {c.name}
            </Chip>
          ))}
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
        </div>
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
