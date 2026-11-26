import { planInputCheck, formatWon, type BaseDay } from '@sweetwo/core';
import {
  AmountInput,
  BottomSheet,
  Button,
  Chip,
  DayField,
  PaydayPicker,
  SegChoice,
  ShortText,
} from '@sweetwo/ui';
import { useState } from 'react';
import { MASKED } from '../../shared/mask';
import { speakMasked } from '../../shared/masked-text';
import { copy } from './copy';
import { nextDayOf } from './cycle';
import { lineMode, modeSettings, type LineMode } from './form-logic';

const NAME_MAX = 20;

/** 줄 설정(20 W-01 7a, 2026-11-13): 체크리스트에 넣기, 은행에서 자동으로 나가요, 나가는 날(null = 월급날, 31 = 말일) */
export interface LineSettings {
  inChecklist: boolean;
  autoPay: boolean;
  autoDay: number | null;
}

/**
 * 나가는 날 고르기(20 W-01 7a, W-01d): 칩 ‘월급날’·‘다음 날’ + 한 줄 “매달 25일” → 1~31 + 말일 칸 시트(DayField, 2026-11-26 휠에서 바꿈). null = 월급날(날짜 없음은 1일), 31 = 말일
 */
export function AutoDayPick({
  value,
  payday,
  onChange,
  label = copy.autoDay,
}: {
  value: number | null;
  payday: BaseDay | null;
  onChange: (v: number | null) => void;
  label?: string;
}) {
  const next = nextDayOf(payday);
  const shownDay: number | 'last' = value === null ? (payday ?? 1) : value >= 31 ? 'last' : value;
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
      {payday !== null && (
        <div
          className="hg-row"
          role="group"
          aria-label={copy.autoDayChips}
          style={{ gap: 'var(--space-2)' }}
        >
          <Chip small selected={value === null} onClick={() => onChange(null)}>
            {copy.chipPayday}
          </Chip>
          {next !== null && (
            <Chip small selected={value === next} onClick={() => onChange(next)}>
              {copy.chipNextDay}
            </Chip>
          )}
        </div>
      )}
      <DayField
        label={label}
        value={shownDay}
        lastLabel={copy.paydayLast}
        onChange={(d) => {
          const n = d === 'last' ? 31 : d;
          const same = payday !== null && (payday === 'last' ? n === 31 : n === payday);
          if (same && value === null) return;
          onChange(same ? null : n);
        }}
      />
    </div>
  );
}

/**
 * ‘어떻게 챙겨요?’ 구간 선택 + 안내 한 줄 + (자동이면) 나가는 날(2026-11-23). 예전 스위치 둘(‘월급날 확인 목록에 넣기’, ‘은행에서 자동으로 보내요’)을 하나로 합침.
 * 월급날 확인 = 목록에 넣음, 자동으로 나가요 = 나가는 날 앱이 확인, 확인 안 해요 = 목록에 안 넣음(지출 줄만, 월급날이 있을 때만).
 * 월급날이 없는 사람은 확인 목록이 없어 첫 칸이 ‘직접 보내요’. 값은 split_line in_checklist/auto_pay/auto_day 그대로.
 */
export function LineModeBody({
  value,
  onChange,
  allowOff,
  payday,
}: {
  value: LineSettings;
  onChange: (v: LineSettings) => void;
  /** ‘확인 안 해요’ 칸(지출 줄만, 월급날이 있을 때) */
  allowOff: boolean;
  /** 기준일(월급날). 없으면(날짜 없음) 1일 */
  payday: BaseDay | null;
}) {
  const mode = lineMode(value);
  const items: { value: LineMode; label: string }[] = [
    { value: 'check', label: payday === null ? copy.modeDirect : copy.modeCheck },
    { value: 'auto', label: copy.modeAuto },
    ...(allowOff ? [{ value: 'off' as const, label: copy.modeOff }] : []),
  ];
  return (
    <>
      <SegChoice
        label={copy.formHowQ}
        items={items}
        value={mode === 'off' && !allowOff ? 'check' : mode}
        onChange={(m) => onChange({ ...value, ...modeSettings(m, value.autoDay) })}
      />
      {mode === 'auto' ? (
        <AutoDayPick
          value={value.autoDay}
          payday={payday}
          onChange={(autoDay) => onChange({ ...value, autoDay })}
        />
      ) : (
        <p className="hg-form__hint">{copy.modeHint}</p>
      )}
    </>
  );
}

/** 금액 시트 안 줄 설정: 작은 제목 + LineModeBody */
export function LineSettingsFields({
  value,
  onChange,
  showInChecklist,
  payday,
}: {
  value: LineSettings;
  onChange: (v: LineSettings) => void;
  /** ‘확인 안 해요’를 보일 수 있는 줄(지출 줄, 월급날이 있을 때) */
  showInChecklist: boolean;
  payday: BaseDay | null;
}) {
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
      <p className="hg-form__qtitle">{copy.formHowQ}</p>
      <LineModeBody value={value} onChange={onChange} allowOff={showInChecklist} payday={payday} />
    </div>
  );
}

/**
 * 줄 금액 입력 아래 미계획 금액 한 줄(06 3-3, 2026-11-26 사용자 결정): 0 이상이면 “미계획 금액 80,000원”, 월급을 넘으면
 * “월급보다 300,000원 많아요”(금액만 danger, 나머지는 평소 색) + 회색 글자 버튼 ‘월급 고치기’(onFixIncome이 있을 때만).
 * text = 금액 표기(가리기면 “•••”). 막을지는 부르는 화면이 core planInputCheck로 정함
 */
export function PlanLeftHint({
  left,
  text,
  onFixIncome,
}: {
  left: number;
  text: (v: number) => string;
  onFixIncome?: () => void;
}) {
  if (left >= 0)
    return (
      <p className="hg-help" aria-live="polite">
        {speakMasked(copy.leftover(text(left)))}
      </p>
    );
  return (
    <>
      <p className="hg-help" aria-live="polite">
        {copy.overIncome[0]}
        <span className="hg-over">{speakMasked(text(-left))}</span>
        {copy.overIncome[1]}
      </p>
      {onFixIncome && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={onFixIncome}
        >
          {copy.fixIncome}
        </button>
      )}
    </>
  );
}

/**
 * W-01 금액 시트(20 W-01 7번): 이름(직접 추가 줄만) + 금액(1만 원 단위, 0원 가능, 좁은 창 키패드)
 * + 바뀐 뒤 여유 자금. 주 버튼(확인/추가하기), 저금 줄은 회색 글자 버튼 ‘저금 보기’, 지울 수 있으면 danger 글자 ‘지우기’.
 * left0 = 이 줄을 뺀 여유 자금(수입 − 다른 줄 합). masked면 바뀐 뒤 여유 자금도 “•••”(금액 칸은 그대로, 11 8장)
 * 2026-11-26: 늘려서 월급을 넘으면 주 버튼을 막고 “월급보다 n 많아요” + ‘월급 고치기’(onFixIncome, core planInputCheck)
 */
export function PlanSheet({
  title,
  amount: initial,
  name: initialName,
  renamable,
  left0,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
  onDelete,
  deleteLabel,
  onItem,
  masked,
  settings,
  notify,
  onFixIncome,
}: {
  title: string;
  amount: number;
  name?: string;
  renamable?: boolean;
  left0: number;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (amount: number, name: string, settings?: LineSettings) => void;
  onClose: () => void;
  onDelete?: () => void;
  /** ‘지우기’ 화면 읽기 이름(좁은 창 키패드 ‘지우기’와 구분: “생활비 지우기”) */
  deleteLabel?: string;
  onItem?: () => void;
  masked?: boolean;
  /** 줄 설정(W-01 7a). 없으면 설정 칸 없음(줄 추가) */
  settings?: { value: LineSettings; showInChecklist: boolean; payday: BaseDay | null };
  /** 시트 아래 회색 한 줄(5f 관리하는 사람의 상대 용돈 “{이름}님께 알려 드려요”) */
  notify?: string;
  /** 월급을 넘을 때 ‘월급 고치기’(W-01 3b 월급 금액 시트). 없으면 문구만 */
  onFixIncome?: () => void;
}) {
  const [v, setV] = useState<number | null>(initial);
  const [set, setSet] = useState<LineSettings | null>(settings?.value ?? null);
  const [name, setName] = useState(initialName ?? '');
  const check = planInputCheck({ left0, before: initial, after: v });
  const unit = v !== null && v % 10_000 !== 0;
  const valid = v !== null && !unit && !check.blocked && (!renamable || name.trim().length > 0);
  const won = (x: number) => (masked ? MASKED : formatWon(x));
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      closeLabel={copy.close}
      actions={
        <>
          <Button
            block
            variant="primary"
            disabled={!valid}
            loading={busy}
            onClick={() => v !== null && onConfirm(v, name.trim(), set ?? undefined)}
          >
            {confirmLabel}
          </Button>
          {onItem && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'center', minHeight: 'var(--space-10)' }}
              onClick={onItem}
            >
              {copy.seeItem}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="hg-btn hg-btn--link hg-btn--danger-text"
              style={{ alignSelf: 'center', minHeight: 'var(--space-10)' }}
              aria-label={deleteLabel}
              onClick={onDelete}
            >
              {copy.removeLine}
            </button>
          )}
        </>
      }
    >
      <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        {renamable && (
          <ShortText label={copy.newLineName} value={name} onChange={setName} max={NAME_MAX} />
        )}
        <AmountInput
          label={title}
          value={v}
          onChange={setV}
          monthly
          allowZero
          // 바뀐 뒤 여유 자금은 금액 바로 아래(키패드 위)
          extra={
            <>
              {unit && <p className="hg-help is-error">{copy.tenThousandUnit}</p>}
              <PlanLeftHint left={check.left} text={won} onFixIncome={onFixIncome} />
            </>
          }
        />
        {settings && set && (
          <LineSettingsFields
            value={set}
            onChange={setSet}
            showInChecklist={settings.showInChecklist}
            payday={settings.payday}
          />
        )}
        {notify && <p className="hg-help">{notify}</p>}
      </div>
    </BottomSheet>
  );
}

/**
 * W-01 월급 줄 금액 시트(20 W-01 3b, 2026-11-19 사용자 결정): 월급 금액(좁은 창 숫자 키패드, 0원 가능) + 바뀐 뒤 미계획 금액.
 * 월급날이 아직 없고 금액이 0보다 크면 월급날 휠도 같이(S-11c와 같은 규칙, 월급날 없이는 확인 목록을 못 만듦).
 * planned = 월급 계획 줄 합(보내기 줄 뺌), others = 합쳐서에서 상대 월급(각자는 0)
 */
export function IncomeSheet({
  title,
  amount: initial,
  planned,
  others,
  askDay,
  masked,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  amount: number;
  planned: number;
  others: number;
  /** 월급날이 없을 때(금액이 0보다 크면 월급날 고르기를 보임) */
  askDay: boolean;
  masked?: boolean;
  busy?: boolean;
  onConfirm: (amount: number, day: number | 'last' | null) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<number | null>(initial);
  const [day, setDay] = useState<number | 'last' | null>(25);
  const left = others + (v ?? 0) - planned;
  const needDay = askDay && (v ?? 0) > 0;
  const won = (x: number) => (masked ? MASKED : formatWon(x));
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      closeLabel={copy.close}
      actions={
        <Button
          block
          variant="primary"
          disabled={v === null || (needDay && day === null)}
          loading={busy}
          onClick={() =>
            v !== null && !(needDay && day === null) && onConfirm(v, needDay ? day : null)
          }
        >
          {copy.ok}
        </Button>
      }
    >
      <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <AmountInput
          label={title}
          value={v}
          onChange={setV}
          monthly
          allowZero
          // 월급 고치기는 막지 않음(2026-11-26): 넘으면 “계획이 월급보다 n 많아요”(금액만 빨강)만
          extra={
            <p className="hg-help" aria-live="polite">
              {left >= 0 ? (
                speakMasked(copy.leftover(won(left)))
              ) : (
                <>
                  {copy.overPlan[0]}
                  <span className="hg-over">{speakMasked(won(-left))}</span>
                  {copy.overPlan[1]}
                </>
              )}
            </p>
          }
        />
        {needDay && (
          <PaydayPicker
            label={copy.incomeDay}
            value={day}
            onChange={setDay}
            lastLabel={copy.paydayLast}
            customLabel={copy.paydayCustom}
            rangeError={copy.paydayRange}
            hint={copy.paydayShortMonth}
          />
        )}
      </div>
    </BottomSheet>
  );
}

/**
 * ‘+ 지출 추가’ 뒤 이름 칩 + 글자 칸(20 W-01 5b). 칩을 누르거나 글자를 넣고 Enter → onPick
 * taken = 이미 있는 이름(숨김)
 */
export function SpendChips({
  taken,
  onPick,
  more,
}: {
  taken: string[];
  onPick: (name: string, chip: string | null) => void;
  /** 칩 끝 하나 더(“+ 같이 쓰는 통장 추가”를 숨겼을 때 나중에 켤 길, 2026-11-16 R4-4) */
  more?: { label: string; onClick: () => void };
}) {
  const [text, setText] = useState('');
  return (
    <div className="hg-receipt__chips" role="group" aria-label={copy.spendChipsLabel}>
      {copy.spendChips
        .filter((c) => !taken.includes(c.name))
        .map((c) => (
          <Chip key={c.code} small onClick={() => onPick(c.name, c.code)}>
            {c.name}
          </Chip>
        ))}
      {more && (
        <Chip small onClick={more.onClick}>
          {more.label}
        </Chip>
      )}
      <input
        className="hg-input"
        aria-label={copy.newLineName}
        placeholder={copy.ownName}
        maxLength={NAME_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
          e.preventDefault();
          const t = text.trim();
          if (t) onPick(t, null);
        }}
      />
    </div>
  );
}
