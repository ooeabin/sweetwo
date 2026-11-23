import { fetchMoneyIns, qk } from '@sweetwo/api';
import { AmountInput, BottomSheet, Button, ListRow } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { money } from '../../shared/mask';
import { speakMasked } from '../../shared/masked-text';
import { copy } from './copy';

/**
 * 수입 기본값(2026-11-20 사용자 결정, 20 W-02 6번): 기록이 0건이고 자동 기록 전이면 프로필 월급을 큰 금액 + 연필로 보이고
 * 아래에 “11.25 월급 자동” 줄(저장 전). 2026-11-23 바탕 기준: 이 카드는 W-20b 맨 위로 옮김(W-02는 한 줄 IncomeLine만)
 */
export interface IncomeDefaults {
  /** 큰 금액(내 프로필 월급, 없으면 0) */
  amount: number;
  /** 기본값 줄(월급이 0원이면 줄 없음): 합쳐서면 사람마다 하나 */
  lines: { key: string; date: string; name: string; amount: number }[];
  /** 내 금액 시트 열기(없으면 보기만: 첫 월급날 전 미리 보기) */
  onEdit?: () => void;
}

/**
 * W-02 수입 한 줄(2026-11-23 바탕 기준, 20 W-02 6번): 구분선 아래 “이번 달 수입 350만 원 ›”. 누르면 W-20b 수입 기록
 * (기본값 연필, ‘+ 수입 적기’, 기록 목록은 W-20b 맨 위로 옮김). 값 = 그 기간(from~to, KST 받은 날) 기록 합, 기록이 0건이면
 * 기본값(프로필 월급, 있으면), 그것도 없으면 값 없이 이름만. onOpen이 없으면(파트너 탭) 누를 수 없음.
 * 파트너 탭처럼 기록이 없으면 안 그릴 때는 hideEmpty
 */
export function IncomeLine({
  ownerId,
  alsoOwnerIds,
  from,
  to,
  masked,
  label,
  fallback,
  hideEmpty,
  onOpen,
}: {
  ownerId: string;
  /** 합쳐서 엔진: 같이 보는 다른 사람 기록도 합에(수입 합 = 두 사람 합) */
  alsoOwnerIds?: string[];
  from: string;
  to: string;
  masked: boolean;
  /** 이름(기본 “이번 달 수입”, 날짜 없는 사람 “이번 기간 수입”, 지난 달 “{n}월 수입”) */
  label?: string;
  /** 기록이 0건일 때 값(기본값 월급). 없으면 값 자리 비움 */
  fallback?: number;
  hideEmpty?: boolean;
  onOpen?: () => void;
}) {
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const owners = [ownerId, ...(alsoOwnerIds ?? [])];
  const rows = (ins.data ?? []).filter(
    (r) => owners.includes(r.owner_user_id) && r.received_on >= from && r.received_on <= to,
  );
  if (!rows.length && hideEmpty) return null;
  const name = label ?? copy.incomeCardLabel;
  const sum = rows.reduce((t, r) => t + r.amount, 0);
  const shown = rows.length > 0 ? sum : ins.isLoading ? undefined : fallback;
  return (
    <div className="hg-list hg-list--plain hg-incomeline" role="group" aria-label={name}>
      <ListRow
        label={name}
        value={shown === undefined ? undefined : speakMasked(money(shown, masked))}
        onClick={onOpen}
      />
    </div>
  );
}

/** 기본값 줄(프로필 월급): 합쳐서면 파트너 줄도. date = 기록될 날(사이클 시작이 지났으면 시작일, 아니면 오늘) */
export function defaultIncomeLines(
  me: { monthly_income: number | null },
  partner: { nickname: string | null; monthly_income: number | null } | null | undefined,
  joint: boolean,
  date: string,
): IncomeDefaults['lines'] {
  const mine = me.monthly_income ?? 0;
  const theirs = partner?.monthly_income ?? 0;
  return [
    ...(mine > 0 ? [{ key: 'me', date, name: copy.moneyInKinds.salary, amount: mine }] : []),
    ...(joint && partner && theirs > 0
      ? [
          {
            key: 'partner',
            date,
            name: copy.incomeDefaultOf(partner.nickname ?? ''),
            amount: theirs,
          },
        ]
      : []),
  ];
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
