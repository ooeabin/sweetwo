import { readWon } from '@sweetwo/core';
import { AmountInput, BottomSheet, Button, Chip, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { MASKED } from '../../shared/mask';
import { speakMasked } from '../../shared/masked-text';
import { copy } from './copy';

const NAME_MAX = 20;

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
}: {
  title: string;
  amount: number;
  name?: string;
  renamable?: boolean;
  left0: number;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (amount: number, name: string) => void;
  onClose: () => void;
  onDelete?: () => void;
  /** ‘지우기’ 화면 읽기 이름(좁은 창 키패드 ‘지우기’와 구분: “생활비 지우기”) */
  deleteLabel?: string;
  onItem?: () => void;
  masked?: boolean;
}) {
  const [v, setV] = useState<number | null>(initial);
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
            onClick={() => v !== null && onConfirm(v, name.trim())}
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
              {copy.remove}
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
}: {
  taken: string[];
  onPick: (name: string, chip: string | null) => void;
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
