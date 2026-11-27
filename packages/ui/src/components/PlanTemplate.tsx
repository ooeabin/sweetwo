import type { ReactNode } from 'react';
import { cx } from './cx';
import { AddText } from './AddText';
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

/** 도넛 조각·범례 점 종류: 저축·투자 chart-save, 지출 chart-spend(그래프 전용 초록, 2026-11-26), 미계획 bar-track */
export type PlanPartKind = 'saving' | 'spend' | 'free';

/**
 * 요약 도넛(2026-11-26 사용자 결정 ‘W-01 도넛 그린 L1 + 세로 목록’): 굵은 파이형 고리(구멍 지름 약 30%), 가운데 글자 없음,
 * 12시부터 시계 방향으로 받은 순서(저축·투자 → 지출 → 미계획), 조각 사이 틈 없음, 0%는 그리지 않음.
 * 크기는 CSS(.hg-plansum__donut, 가운데 지름 140px). 그래픽이라 뜻은 화면 읽기 이름과 범례 글자로 전함
 */
export function PlanDonut({
  parts,
  label,
}: {
  parts: { kind: PlanPartKind; percent: number }[];
  label?: string;
}) {
  let at = 0;
  return (
    <svg className="hg-plansum__donut" viewBox="0 0 42 42" role="img" aria-label={label}>
      {parts
        .filter((p) => p.percent > 0)
        .map((p) => {
          const from = at;
          at += p.percent;
          return (
            <circle
              key={p.kind}
              className={`hg-plansum__slice hg-plansum__slice--${p.kind}`}
              cx="21"
              cy="21"
              r="13"
              pathLength={100}
              strokeDasharray={`${p.percent} ${100 - p.percent}`}
              strokeDashoffset={-from}
              transform="rotate(-90 21 21)"
            />
          );
        })}
    </svg>
  );
}

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
 * 요약 카드: 이름표(누를 수 있으면 “월급 ›”) + 큰 금액 + 굵은 한 문장 + 한 줄(왼쪽 도넛 + 오른쪽 ● 범례 세 줄, 2026-11-26 도넛 + 범례).
 * empty면 도넛·범례 없이 굵은 문장 + 옅은 오렌지 블록 버튼(월급 0원, “월급 입력하기”).
 * people을 주면(합쳐서) 큰 금액은 합계(누르지 않음)이고 사람마다 한 줄이 그 아래에 붙음.
 */
export function PlanSummary({
  label,
  amount,
  amountLabel,
  onAmount,
  people,
  title,
  titleError,
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
  /** 있으면 이름표 “월급 ›” + 큰 금액이 한 버튼(월급 금액 시트, 2026-11-26 연필 없앰) */
  onAmount?: () => void;
  people?: PlanSummaryPerson[];
  /** 굵은 한 문장(숫자는 <em>) */
  title?: ReactNode;
  /** 굵은 문장을 오류 빨강으로(“계획이 월급보다 25만 원 많아요”) */
  titleError?: boolean;
  /** 도넛 조각 퍼센트(0은 그리지 않음). 합 100 */
  bar?: { kind: PlanPartKind; percent: number }[];
  /** 도넛 화면 읽기 이름(“저축·투자 40%, 지출 52%, 미계획 8%”) */
  barLabel?: string;
  /**
   * 범례 줄(2026-11-26 ‘W-01 도넛 그린 L1 + 세로 목록’: 도넛 아래 전체 폭 세로 목록, 줄 높이 40). 이름 15/400 왼쪽 + 오른쪽 값 15/700:
   * percent(저축·투자·지출, 금액 가리기에도 그대로) 또는 amount(미계획: 퍼센트 대신 금액 “0원”, short면 “−300,000원” danger)
   */
  legend?: {
    kind: PlanPartKind;
    name: string;
    percent?: number;
    amount?: ReactNode;
    short?: boolean;
  }[];
  /** 월급 0원 상태 */
  empty?: { title: ReactNode; action?: { label: string; onClick: () => void } };
}) {
  return (
    <section className="hg-plancard hg-plansum" aria-label={label}>
      {/* 2026-11-26 ‘큰 금액 ③’: 연필 없앰. 이름표 “월급 ›”(13 slate) + 큰 금액이 한 버튼(월급 금액 시트), 누르는 칸 44 이상 */}
      {onAmount ? (
        <button
          type="button"
          className="hg-plansum__sal"
          aria-label={amountLabel}
          onClick={onAmount}
        >
          <span className="hg-plansum__label">
            {label}
            <Icon name="chevron-right" size={16} className="hg-plansum__go" />
          </span>
          <span className="hg-plansum__amt">{amount}</span>
        </button>
      ) : (
        <div className="hg-plansum__sal">
          <p className="hg-plansum__label">{label}</p>
          <p className="hg-plansum__amt">{amount}</p>
        </div>
      )}
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
                {x.onOpen && <Icon name="chevron-right" size={16} className="hg-plansum__go" />}
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
          {title && (
            <p className={cx('hg-plansum__title', titleError && 'hg-plansum__title--error')}>
              {title}
            </p>
          )}
          {(bar || legend) && (
            <div className="hg-plansum__chart">
              {bar && <PlanDonut parts={bar} label={barLabel} />}
              {legend && legend.length > 0 && (
                <ul className="hg-plansum__legend" role="list">
                  {legend.map((l) => (
                    <li key={l.kind} className={cx(l.short && 'is-short')}>
                      <i
                        className={`hg-plansum__dot hg-plansum__seg--${l.kind}`}
                        aria-hidden="true"
                      />
                      <span className="hg-plansum__lname">{l.name}</span>
                      <span className="hg-plansum__lpct">
                        {l.percent !== undefined ? `${l.percent}%` : l.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * 묶음 카드(저축·투자, 지출). 머리 = 한 줄 “저축·투자” 왼쪽 + 합계 오른쪽, 둘 다 13/400 slate(2026-11-26 ‘W-01 정리 A안’:
 * 큰 합계 22/700·묶음 ⋯는 없앰, 동작은 화면 머리 ⋯ 하나). 아래 줄들(ReceiptRows)과 끝 ‘+ … 추가’ 줄(PlanAdd).
 * id는 주소 `#saving`으로 스크롤할 자리
 */
export function PlanCard({
  title,
  sum,
  id,
  children,
}: {
  title: string;
  sum?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="hg-plancard" aria-label={title}>
      <div className="hg-plancard__head">
        <h3 className="hg-plancard__title">{title}</h3>
        {sum && <span className="hg-plancard__sum">{sum}</span>}
      </div>
      {children}
    </section>
  );
}

/** 묶음 끝 ‘+ … 추가’ 줄(높이 48, 회색 원 32 안 +, 2026-11-26). 글자 앞 “+”는 아이콘으로 바꿔 그리고 화면 읽기 이름은 글자 그대로 */
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
      <AddText>{children}</AddText>
    </button>
  );
}
