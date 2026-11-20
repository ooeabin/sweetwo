import { fetchMoneyIns, qk } from '@sweetwo/api';
import { formatDot2, formatMonthDay } from '@sweetwo/core';
import {
  AmountInput,
  AddRow,
  AddText,
  BottomSheet,
  Button,
  Icon,
  ListRow,
  SectionHeader,
} from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { money } from '../../shared/mask';
import { speakMasked } from '../../shared/masked-text';
import { copy } from './copy';

/**
 * W-02 ‘수입’ 묶음(20 W-20 고친 점, 2026-11-16 4차 검토 R4-7): 이번 달(from~to, KST 받은 날)에 내가 적은 수입 기록.
 * 줄 = 종류 + 받은 날, 오른쪽 금액. 누르면 W-20b 수입 기록(고치기·지우기). 기록이 없으면 아무것도 그리지 않음(onAdd가 있으면 머리 + “+ 수입 적기”만)
 */
export function MoneyInRows({
  meId,
  from,
  to,
  masked,
  onOpen,
  onAdd,
}: {
  meId: string;
  from: string;
  to: string;
  masked: boolean;
  onOpen: () => void;
  /** 있으면 묶음 맨 아래 “+ 수입 적기”(기록이 없어도 묶음을 그림, W-02 2026-11-18) */
  onAdd?: () => void;
}) {
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const rows = (ins.data ?? []).filter(
    (r) => r.owner_user_id === meId && r.received_on >= from && r.received_on <= to,
  );
  if (!rows.length && !onAdd) return null;
  return (
    <section className="hg-checkgroup" aria-label={copy.moneyInGroup}>
      <SectionHeader variant="group" title={copy.moneyInGroup} />
      <div className="hg-list hg-list--plain">
        {rows.map((r) => (
          <ListRow
            key={r.id}
            label={copy.moneyInKinds[r.kind]}
            sub={formatMonthDay(r.received_on)}
            value={speakMasked(money(r.amount, masked))}
            onClick={onOpen}
          />
        ))}
      </div>
      {onAdd && <AddRow block label={copy.moneyIn} onClick={onAdd} />}
    </section>
  );
}

/**
 * W-02 수입 카드(2026-11-19 사용자 결정 “수입카드 시안대로 진행”, 20 W-02 6번): 흰 카드 + 이름표 + 큰 금액(이번 사이클 수입 합)
 * + 최근 2건(날짜, 종류, +금액) + 넓은 “+ 수입 적기”. 기록이 있으면 “전체 ›”(W-20b). onAdd가 없으면 버튼 없음(파트너 탭·지난 달)
 * 기본값(2026-11-20 사용자 결정, 20 W-02 6번): 기록이 0건이고 자동 기록 전이면 “아직 적은 수입이 없어요” 대신 프로필 월급을 큰 금액 + 연필로,
 * 아래에 “11.25 월급 자동” 줄을 보임(저장 전). 큰 금액·연필을 누르면 금액 시트(onEdit, 없으면 보기만). 자동 월급 줄은 누르면 고치기(onEditAuto)
 */
export interface IncomeDefaults {
  /** 큰 금액(내 프로필 월급, 없으면 0) */
  amount: number;
  /** 기본값 줄(월급이 0원이면 줄 없음): 합쳐서면 사람마다 하나 */
  lines: { key: string; date: string; name: string; amount: number }[];
  /** 내 금액 시트 열기(없으면 보기만: 첫 월급날 전 미리 보기) */
  onEdit?: () => void;
}

export function IncomeCard({
  ownerId,
  from,
  to,
  masked,
  label,
  hideSum,
  hideEmpty,
  onOpen,
  onAdd,
  defaults,
  onEditAuto,
}: {
  ownerId: string;
  from: string;
  to: string;
  masked: boolean;
  /** 이름표(기본 “이번 달 수입”, 날짜 없는 사람 “이번 기간 수입”) */
  label?: string;
  /** 큰 금액 숨김(날짜 없는 사람은 화면 위 큰 금액이 이미 기간 수입) */
  hideSum?: boolean;
  /** 기록이 없으면 카드를 안 그림(파트너 탭: 안 보이는 기록과 “없음”을 구분할 수 없어서) */
  hideEmpty?: boolean;
  /** “전체 ›”(없으면 안 보임) */
  onOpen?: () => void;
  onAdd?: () => void;
  /** 기록 0건 + 자동 기록 전일 때 기본값(월급)을 보임 */
  defaults?: IncomeDefaults;
  /** 자동 월급 줄을 누르면 그 기록 고치기(W-20 `?edit=`) */
  onEditAuto?: (id: string) => void;
}) {
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const rows = (ins.data ?? []).filter(
    (r) => r.owner_user_id === ownerId && r.received_on >= from && r.received_on <= to,
  );
  if (!rows.length && hideEmpty) return null;
  // 기록을 아직 못 읽었으면 기본값을 보이지 않음(기록이 있는데 깜빡 기본값이 보이는 것 방지)
  const base = defaults && !hideSum && !ins.isLoading && rows.length === 0 ? defaults : undefined;
  const name = label ?? copy.incomeCardLabel;
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  const recent = rows.slice(0, 2);
  return (
    <section className="hg-incomecard" aria-label={name}>
      <div className="hg-incomecard__top">
        <h2 className="hg-incomecard__label">{name}</h2>
        {rows.length > 0 && onOpen && (
          <button
            type="button"
            className="hg-incomecard__more"
            aria-label={copy.incomeAllLabel}
            onClick={onOpen}
          >
            {copy.incomeAll}
          </button>
        )}
      </div>
      {base && (
        <p className="hg-incomecard__sum">
          {base.onEdit ? (
            <button
              type="button"
              className="hg-incomecard__edit"
              aria-label={`${copy.incomeEditLabel}, ${money(base.amount, masked)}`}
              onClick={base.onEdit}
            >
              <span>{speakMasked(money(base.amount, masked))}</span>
              <Icon name="pencil" size={20} />
            </button>
          ) : (
            speakMasked(money(base.amount, masked))
          )}
        </p>
      )}
      {!base &&
        !hideSum &&
        (rows.length > 0 ? (
          <p className="hg-incomecard__sum">{speakMasked(money(sum, masked))}</p>
        ) : (
          <p className="hg-incomecard__sum hg-incomecard__sum--none">{copy.incomeNone}</p>
        ))}
      {!base && hideSum && rows.length === 0 && (
        <p className="hg-incomecard__sum hg-incomecard__sum--none">{copy.incomeNone}</p>
      )}
      {base && base.lines.length > 0 && (
        <ul className="hg-incomecard__list">
          {base.lines.map((l) => (
            <li key={l.key} className="hg-incomecard__row">
              <span className="hg-incomecard__date">{formatDot2(l.date)}</span>
              <span className="hg-incomecard__name">
                {l.name}
                <span className="hg-incomecard__auto">{copy.incomeAuto}</span>
              </span>
              <span className="hg-incomecard__amt">
                {speakMasked(`+${money(l.amount, masked)}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <ul className="hg-incomecard__list">
          {recent.map((r) => {
            const body = (
              <>
                <span className="hg-incomecard__date">{formatDot2(r.received_on)}</span>
                <span className="hg-incomecard__name">
                  {copy.moneyInKinds[r.kind]}
                  {r.source === 'payday_auto' && (
                    <span className="hg-incomecard__auto">{copy.incomeAuto}</span>
                  )}
                </span>
                <span className="hg-incomecard__amt">
                  {speakMasked(`+${money(r.amount, masked)}`)}
                </span>
              </>
            );
            return (
              <li key={r.id} className="hg-incomecard__row">
                {onEditAuto && r.source === 'payday_auto' ? (
                  <button
                    type="button"
                    className="hg-incomecard__rowbtn"
                    aria-label={copy.incomeRowEditLabel(money(r.amount, masked))}
                    onClick={() => onEditAuto(r.id)}
                  >
                    {body}
                  </button>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
      {onAdd && (
        <Button variant="secondary" block className="hg-incomecard__add" onClick={onAdd}>
          <AddText>{copy.incomeAddButton}</AddText>
        </Button>
      )}
    </section>
  );
}

/**
 * W-02 수입 카드 기본값 금액 시트(2026-11-20): 공용 AmountInput(처음 누르는 숫자가 기본값을 덮어씀) + ‘확인’.
 * 0원도 저장(기록 없이 닫기). 저장은 부른 쪽(set_payday_income)
 */
export function PaydayIncomeSheet({
  initial,
  busy,
  onSave,
  onClose,
}: {
  initial: number;
  busy: boolean;
  onSave: (amount: number) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <BottomSheet
      title={copy.incomeEditTitle}
      onClose={onClose}
      closeLabel={copy.close}
      actions={
        <Button
          block
          variant="primary"
          disabled={v === null}
          loading={busy}
          onClick={() => v !== null && onSave(v)}
        >
          {copy.ok}
        </Button>
      }
    >
      <AmountInput label={copy.incomeEditTitle} value={v} onChange={setV} allowZero />
    </BottomSheet>
  );
}
