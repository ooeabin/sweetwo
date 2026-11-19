import { readWon, type BaseDay } from '@sweetwo/core';
import { AmountInput, BottomSheet, Button, Chip, DayWheel, ShortText, Toggle } from '@sweetwo/ui';
import { useState } from 'react';
import { MASKED } from '../../shared/mask';
import { speakMasked } from '../../shared/masked-text';
import { copy } from './copy';
import { nextDayOf } from './cycle';

const NAME_MAX = 20;

/** 줄 설정(20 W-01 7a, 2026-11-13): 체크리스트에 넣기, 은행에서 자동으로 나가요, 나가는 날(null = 월급날, 31 = 말일) */
export interface LineSettings {
  inChecklist: boolean;
  autoPay: boolean;
  autoDay: number | null;
}

/**
 * 나가는 날 고르기(20 W-01 7a, W-01d): 칩 ‘월급날’·‘다음 날’ + 휠(1~31, 말일). null = 월급날(날짜 없음은 1일), 31 = 말일
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
      <DayWheel
        label={label}
        value={shownDay}
        initial={shownDay}
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
 * 줄 설정 칸(W-01 금액 시트 아래): “체크리스트에 넣기”(지출 줄만) + “은행에서 자동으로 나가요” → 켜면 “나가는 날” 칩
 * ‘월급날’·‘다음 날’ + 휠(1~31, 말일). 처음 값 = 월급날(날짜 없음은 1일)
 */
export function LineSettingsFields({
  value,
  onChange,
  showInChecklist,
  payday,
}: {
  value: LineSettings;
  onChange: (v: LineSettings) => void;
  showInChecklist: boolean;
  /** 기준일(월급날). 없으면(날짜 없음) 1일 */
  payday: BaseDay | null;
}) {
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
      {showInChecklist && (
        <Toggle
          label={copy.inChecklist}
          checked={value.inChecklist}
          onChange={(on) => onChange({ ...value, inChecklist: on })}
        />
      )}
      <Toggle
        label={copy.autoPay}
        checked={value.autoPay}
        onChange={(on) => onChange({ ...value, autoPay: on, autoDay: on ? value.autoDay : null })}
      />
      {value.autoPay && (
        <AutoDayPick
          value={value.autoDay}
          payday={payday}
          onChange={(autoDay) => onChange({ ...value, autoDay })}
        />
      )}
    </div>
  );
}

/**
 * W-01 금액 시트(20 W-01 7번): 이름(직접 추가 줄만) + 금액(1만 원 단위, 0원 가능, 좁은 창 키패드)
 * + 바뀐 뒤 여유 자금. 주 버튼(확인/추가하기), 저금 줄은 회색 글자 버튼 ‘저금 보기’, 지울 수 있으면 danger 글자 ‘지우기’.
 * left0 = 이 줄을 뺀 여유 자금(수입 − 다른 줄 합). masked면 바뀐 뒤 여유 자금도 “•••”(금액 칸은 그대로, 11 8장)
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
}) {
  const [v, setV] = useState<number | null>(initial);
  const [set, setSet] = useState<LineSettings | null>(settings?.value ?? null);
  const [name, setName] = useState(initialName ?? '');
  const left = left0 - (v ?? 0);
  const unit = v !== null && v % 10_000 !== 0;
  const valid = v !== null && !unit && (!renamable || name.trim().length > 0);
  const won = (x: number) => (masked ? MASKED : readWon(x));
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
              <p className={left < 0 ? 'hg-help is-error' : 'hg-help'} aria-live="polite">
                {speakMasked(left >= 0 ? copy.leftover(won(left)) : copy.short(won(-left)))}
              </p>
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
  /** 월급날이 없을 때(금액이 0보다 크면 휠을 보임) */
  askDay: boolean;
  masked?: boolean;
  busy?: boolean;
  onConfirm: (amount: number, day: number | 'last' | null) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<number | null>(initial);
  const [day, setDay] = useState<number | 'last'>(25);
  const left = others + (v ?? 0) - planned;
  const needDay = askDay && (v ?? 0) > 0;
  const won = (x: number) => (masked ? MASKED : readWon(x));
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      closeLabel={copy.close}
      actions={
        <Button
          block
          variant="primary"
          disabled={v === null}
          loading={busy}
          onClick={() => v !== null && onConfirm(v, needDay ? day : null)}
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
          extra={
            <p className={left < 0 ? 'hg-help is-error' : 'hg-help'} aria-live="polite">
              {speakMasked(left >= 0 ? copy.leftover(won(left)) : copy.short(won(-left)))}
            </p>
          }
        />
        {needDay && (
          <DayWheel
            label={copy.incomeDay}
            value={day}
            onChange={setDay}
            lastLabel={copy.paydayLast}
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

/**
 * W-01 첫 달 ‘매달 나가는 지출’ 묻기(20 W-01 ‘첫 달 묻기’, 2026-11-16 4차 검토 사용자 결정): 월급 계획을 처음 열 때 한 번.
 * 칩을 누르면 그 이름으로 금액 시트(onPick, 금액은 사람이 넣음, 추천 금액 없음). ‘그 밖에’는 이름 칸(onOther).
 * 넣은 칩은 숨김(taken). ‘다 넣었어요’(하나라도 넣었을 때) / ‘건너뛸게요’ = onDone(다시 묻지 않음, home_task_state)
 */
export function FirstSpendAsk({
  taken,
  added,
  busy,
  onPick,
  onOther,
  onDone,
}: {
  taken: string[];
  added: number;
  busy: boolean;
  onPick: (name: string, chip: string) => void;
  onOther: () => void;
  onDone: (skipped: boolean) => void;
}) {
  return (
    <section className="hg-card hg-stack" aria-label={copy.firstSpend.title}>
      <h2 className="hg-card__title">{copy.firstSpend.title}</h2>
      <div className="hg-receipt__chips" role="group" aria-label={copy.firstSpend.title}>
        {copy.firstSpend.chips
          .filter((c) => !taken.includes(c.name))
          .map((c) => (
            <Chip key={c.code} small onClick={() => onPick(c.name, c.code)}>
              {c.name}
            </Chip>
          ))}
        <Chip small onClick={onOther}>
          {copy.firstSpend.other}
        </Chip>
      </div>
      <div className="hg-receipt-actions">
        {added > 0 && (
          <button
            type="button"
            className="hg-btn hg-btn--link"
            aria-busy={busy || undefined}
            onClick={() => onDone(false)}
          >
            {copy.firstSpend.done}
          </button>
        )}
        <button
          type="button"
          className="hg-btn hg-btn--link hg-btn--quiet"
          aria-busy={busy || undefined}
          onClick={() => onDone(true)}
        >
          {copy.firstSpend.skip}
        </button>
      </div>
    </section>
  );
}
