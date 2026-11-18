import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

// 홈 허브(docs/design/components/HomeHub.md, 2026-11-09 GCOO 홈처럼): 회색 바탕 위 크기가 다른 흰 상자.
// Hub(격자) > SaveTogether(H-10 같이 모으기, 따로 파일), HubLine(H-11 이번 달 한 줄, 날짜 없는 사람은 PeriodBar),
// HubBand(할 일·초대 띠, 코코아 채움, 8번만 글자 버튼 둘 secondary), HubBox(월급 상자 H-15, 2026-11-17, 2026-11-18부터 상자 전체가 버튼 하나),
// HubTile(반 칸 타일, point = 오렌지 채운 포인트 상자 하나, 2026-11-17부터 자산 관리 타일).
// 2026-11-13 v2.2(ADR 0009): HubHero(H-03)·HubSaving(H-02)은 없앰.

export function Hub({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="hg-hub" aria-label={label}>
      {children}
    </section>
  );
}

/**
 * 홈 할 일·초대 띠(코코아). 띠 전체가 이동 버튼, 닫기(✕) 없음(2026-11-11: 끝내거나 기간이 지나면 사라짐).
 * secondary(2026-11-13, H-06 8번만, hg-hubband--two): 띠 전체가 아니라 둘째 글자 버튼(“이미 정했어요”) + 첫째 이동 글자가 따로
 */
export function HubBand({
  text,
  go,
  onClick,
  secondary,
}: {
  text: string;
  /** 오른쪽 이동 글자(“체크하기”). 없으면 꺾쇠만 */
  go?: string;
  onClick: () => void;
  /** 둘째 글자 버튼(띠 8번 “이미 정했어요”) */
  secondary?: { text: string; onClick: () => void };
}) {
  if (secondary)
    return (
      <div className="hg-hubband hg-hubband--two hg-hub__full" role="group" aria-label={text}>
        <span className="hg-hubband__text">{text}</span>
        <span className="hg-hubband__btns">
          <button
            type="button"
            className="hg-hubband__btn hg-hubband__btn--quiet"
            onClick={secondary.onClick}
          >
            {secondary.text}
          </button>
          <button type="button" className="hg-hubband__btn" onClick={onClick}>
            {go}
            <Icon name="chevron-right" size={16} />
          </button>
        </span>
      </div>
    );
  return (
    <div className="hg-hubband hg-hub__full">
      <button type="button" className="hg-hubband__main" onClick={onClick}>
        <span className="hg-hubband__text">{text}</span>
        <span className="hg-hubband__go" aria-hidden={go ? undefined : true}>
          {go}
          <Icon name="chevron-right" size={16} />
        </span>
      </button>
    </div>
  );
}

/**
 * 이번 달 한 줄(H-11, 2026-11-13 hg-hubline): 흰 얇은 상자 두 칸. 왼쪽 문장(두 줄까지) + 회색 보조 + 오른쪽 이동 글자.
 * 날짜 없는 사람의 막대 상태(H-13)는 문장 자리에 bar(PeriodBar). 상자 전체가 버튼, 화면 읽기는 label(없으면 보이는 글자)
 */
export function HubLine({
  text,
  sub,
  go,
  bar,
  label,
  onClick,
}: {
  text?: ReactNode;
  sub?: ReactNode;
  /** 오른쪽 이동 글자(“확인하기”). 없으면 꺾쇠만 */
  go?: string;
  /** 문장 자리 대신(PeriodBar) */
  bar?: ReactNode;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="hg-hubline" aria-label={label} onClick={onClick}>
      <span className="hg-hubline__text">
        {bar ?? <span className="hg-hubline__main">{text}</span>}
        {sub && <span className="hg-hubline__sub">{sub}</span>}
      </span>
      <span className="hg-hubline__go" aria-hidden={go ? undefined : true}>
        {go}
        <Icon name="chevron-right" size={16} />
      </span>
    </button>
  );
}

export interface HubBoxRow {
  key: string;
  /** 왼쪽 이름(메뉴 서랍 하위 줄과 같음) */
  name: string;
  /** 오른쪽 값(짧게) */
  value?: ReactNode;
  /** 값 아래 회색 보조 */
  sub?: ReactNode;
  /** 확인할 게 있음: 값을 굵은 ink로 */
  alert?: boolean;
}

/**
 * 월급 상자(H-15, 2026-11-17 홈 순서를 메뉴 서랍과 같게, 2026-11-18 상자 전체가 버튼 하나):
 * 흰 넓은 상자. 머리 “월급”(글자만) + 줄 둘(이름 + 짧은 값, 정보만, 꺾쇠 없음) + 맨 아래 오른쪽 이동 글자 “자세히 보기 ›”.
 * 버튼 안에 버튼을 넣지 않으므로 줄과 이동 글자는 모두 span(눌리는 건 상자 하나). 화면 읽기는 label(상자 내용을 읽음)
 */
export function HubBox({
  title,
  more,
  rows,
  label,
  onClick,
}: {
  title: string;
  /** 맨 아래 오른쪽 이동 글자(“자세히 보기”, 꺾쇠는 따로 그림) */
  more: string;
  rows: HubBoxRow[];
  label?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="hg-hubbox hg-hub__wide" aria-label={label} onClick={onClick}>
      <span className="hg-hubbox__title">{title}</span>
      <span className="hg-hubbox__list">
        {rows.map((r) => (
          <span key={r.key} className="hg-hubbox__row">
            <span className="hg-hubbox__name">{r.name}</span>
            <span className="hg-hubbox__val">
              {r.value !== undefined && (
                <span className={cx('hg-hubbox__main', r.alert && 'hg-hubbox__main--alert')}>
                  {r.value}
                </span>
              )}
              {r.sub && <span className="hg-hubbox__sub">{r.sub}</span>}
            </span>
          </span>
        ))}
      </span>
      <span className="hg-hubbox__more">
        {more}
        <Icon name="chevron-right" size={16} />
      </span>
    </button>
  );
}

export function HubTile({
  title,
  sub,
  sub2,
  value,
  small,
  point,
  badge,
  label,
  onClick,
  className,
}: {
  title: string;
  sub?: ReactNode;
  /** 보조 둘째 줄 */
  sub2?: ReactNode;
  value?: ReactNode;
  /** 72px 그림 자리(큰 타일만). 2026-11-15부터 2D 그림이 들어올 때까지 그리지 않음(회색 빈 자리 숨김) */
  art?: boolean;
  small?: boolean;
  /** 홈 포인트 상자(오렌지 채움, 홈 ‘자산 관리’ 타일 하나만, 2026-11-17. 2026-11-11~16은 ‘월급 계획’) */
  point?: boolean;
  /** 보조 줄 오른쪽 작은 회색 알약(자산 관리 타일 “상위 38%”, 2026-11-11) */
  badge?: string;
  /** 화면 읽기 이름(없으면 보이는 글자) */
  label?: string;
  onClick: () => void;
  /** 격자 자리(H-12 두 칸 hg-hub__wide, 2026-11-13) */
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(
        'hg-hubtile',
        small && 'hg-hubtile--sm',
        point && 'hg-hubtile--point',
        className,
      )}
      aria-label={label}
      onClick={onClick}
    >
      <span className="hg-hubtile__title">{title}</span>
      {badge ? (
        <span className="hg-hubtile__subrow">
          {sub && <span className="hg-hubtile__sub">{sub}</span>}
          <span className="hg-hubtile__badge">{badge}</span>
        </span>
      ) : (
        sub && <span className="hg-hubtile__sub">{sub}</span>
      )}
      {sub2 && <span className="hg-hubtile__sub">{sub2}</span>}
      {value !== undefined && <span className="hg-hubtile__value">{value}</span>}
      {/* art: 72px 그림 자리. 2D 그림이 들어올 때까지 그리지 않음(2026-11-15 3차 검토, 회색 빈 자리 숨김) */}
    </button>
  );
}
