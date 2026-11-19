import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

// W-01 월급 계획 템플릿 틀(docs/design/components/PlanSummary.md, 2026-11-19 사용자 확정 시안).
// 회색 바탕(PlanStage) 위 둥근 흰 카드 셋: 요약(PlanSummary) + 묶음 카드(PlanCard, 저축·투자 / 지출).
// 숫자·문구·퍼센트·금액 가리기·공개 범위는 쓰는 쪽이 줌. 줄은 ReceiptRows(ReceiptCard.tsx).

/** 카드들을 세로로 쌓는 틀(카드 사이 12px, 최대 480px 가운데). 바탕 회색은 화면 틀 tone="alt"가 줌 */
export function PlanStage({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section className="hg-planstage" aria-label={label}>
      {children}
    </section>
  );
}

/** 막대·범례 칸 종류: 저축·투자 brand, 지출 ink-2, 미계획 bar-track */
export type PlanPartKind = 'saving' | 'spend' | 'free';

export interface PlanSummaryPerson {
  id: string;
  name: string;
  amount: ReactNode;
  /** 화면 읽기 이름(없으면 “이름 금액”) */
  label?: string;
  /** 내 줄만: 누르면 금액 시트. 없으면 보기만 */
  onOpen?: () => void;
  /** 보기만(자물쇠) */
  locked?: boolean;
  /** 이름 아래 회색 한 줄(“예빈님이 입력해요”) */
  note?: string;
}

/**
 * 요약 카드: 이름표 + 큰 금액(+ 연필) + 굵은 한 문장 + 알약 막대 + ● 범례 세 줄.
 * empty면 막대·범례 없이 굵은 문장 + 옅은 오렌지 블록 버튼(월급 0원, “월급 적기”).
 * people을 주면(합쳐서) 큰 금액은 합계(누르지 않음)이고 사람마다 한 줄이 그 아래에 붙음.
 */
export function PlanSummary({
  label,
  amount,
  amountLabel,
  onAmount,
  people,
  title,
  bar,
  barLabel,
  legend,
  empty,
}: {
  /** 이름표(“월급”) */
  label: string;
  /** 큰 금액 글자(금액 가리기면 앱이 화면 읽기 글자를 붙인 노드로) */
  amount: ReactNode;
  /** 큰 금액 버튼 화면 읽기 이름(“월급 350만 원, 금액 고치기”) */
  amountLabel?: string;
  /** 있으면 큰 금액 + 연필이 버튼(월급 금액 시트) */
  onAmount?: () => void;
  people?: PlanSummaryPerson[];
  /** 굵은 한 문장(숫자는 <em>) */
  title?: ReactNode;
  /** 막대 칸 퍼센트(0은 그리지 않음). 합 100 */
  bar?: { kind: PlanPartKind; percent: number }[];
  /** 막대 화면 읽기 이름(“저축·투자 40%, 지출 52%, 미계획 8%”) */
  barLabel?: string;
  legend?: { kind: PlanPartKind; name: string; amount: ReactNode; short?: boolean }[];
  /** 월급 0원 상태 */
  empty?: { title: ReactNode; action?: { label: string; onClick: () => void } };
}) {
  return (
    <section className="hg-plancard hg-plansum" aria-label={label}>
      <p className="hg-plansum__label">{label}</p>
      <div className="hg-plansum__sal">
        {onAmount ? (
          <button
            type="button"
            className="hg-plansum__amt"
            aria-label={amountLabel}
            onClick={onAmount}
          >
            {amount}
            <Icon name="pencil" size={20} className="hg-plansum__pen" />
          </button>
        ) : (
          <p className="hg-plansum__amt">{amount}</p>
        )}
      </div>
      {people && people.length > 0 && (
        <ul className="hg-plansum__people" aria-label={label}>
          {people.map((x) => {
            const inner = (
              <>
                <span className="hg-plansum__pname">
                  {x.name}
                  {x.note && <span className="hg-plansum__pnote">{x.note}</span>}
                </span>
                <span className="hg-plansum__pamt">{x.amount}</span>
                {x.onOpen && <Icon name="pencil" size={16} className="hg-plansum__pen" />}
                {x.locked && <Icon name="lock" size={16} className="hg-plansum__lock" />}
              </>
            );
            return (
              <li key={x.id}>
                {x.onOpen ? (
                  <button
                    type="button"
                    className="hg-plansum__person"
                    aria-label={x.label}
                    onClick={x.onOpen}
                  >
                    {inner}
                  </button>
                ) : (
                  <span className="hg-plansum__person" aria-label={x.label}>
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {empty ? (
        <>
          <p className="hg-plansum__title">{empty.title}</p>
          {empty.action && (
            <button
              type="button"
              className="hg-plan__block hg-plan__block--soft"
              onClick={empty.action.onClick}
            >
              {empty.action.label}
            </button>
          )}
        </>
      ) : (
        <>
          {title && <p className="hg-plansum__title">{title}</p>}
          {bar && (
            <div className="hg-plansum__bar" role="img" aria-label={barLabel}>
              {bar
                .filter((p) => p.percent > 0)
                .map((p) => (
                  <i
                    key={p.kind}
                    className={`hg-plansum__seg hg-plansum__seg--${p.kind}`}
                    style={{ flexGrow: p.percent, flexBasis: 0 }}
                  />
                ))}
            </div>
          )}
          {legend && legend.length > 0 && (
            <ul className="hg-plansum__legend">
              {legend.map((l) => (
                <li key={l.kind} className={cx(l.short && 'is-short')}>
                  <i className={`hg-plansum__dot hg-plansum__seg--${l.kind}`} aria-hidden="true" />
                  <span className="hg-plansum__lname">{l.name}</span>
                  <b className="hg-plansum__lamt">{l.amount}</b>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/**
 * 묶음 카드(저축·투자, 지출): 머리 = 제목(18px 700) + 제목 옆 작은 ⋯(action) + 오른쪽 합계, 아래 줄들(ReceiptRows)과 끝 블록 버튼.
 * id는 주소 `#saving`으로 스크롤할 자리
 */
export function PlanCard({
  title,
  sum,
  action,
  id,
  children,
}: {
  title: string;
  sum?: ReactNode;
  action?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="hg-plancard" aria-label={title}>
      <div className="hg-plancard__head">
        <div className="hg-plancard__headl">
          <h3 className="hg-plancard__title">{title}</h3>
          {action}
        </div>
        {sum && <span className="hg-plancard__sum">{sum}</span>}
      </div>
      {children}
    </section>
  );
}

/** 카드 끝 회색 블록 버튼(52px, “+ 저축·투자 추가”). 글자 앞 “+”는 아이콘으로 바꿔 그리고 화면 읽기 이름은 글자 그대로 */
export function PlanAdd({
  children,
  onClick,
  expanded,
}: {
  children: string;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className="hg-plan__block"
      aria-label={children}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <Icon name="plus" size={20} />
      {children.replace(/^\+\s*/, '')}
    </button>
  );
}
