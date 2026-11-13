import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

// 홈 허브(docs/design/components/HomeHub.md, 2026-11-09 GCOO 홈처럼): 회색 바탕 위 크기가 다른 흰 상자.
// Hub(격자) > HubHero(다음 월급날까지 + 이번 달 체크 막대 + 체크한 금액 | 모은 금액), HubBand(할 일·초대 띠, 코코아 채움, 2026-11-11),
// HubTile(반 칸 타일, 큰 것은 72px 그림 자리, point = 오렌지 채운 포인트 상자 하나), HubSaving(목표 금액에 가장 가까운 저금 하나, 파트너 것이면 이름 배지). 모두 누르면 그 화면.

export function Hub({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="hg-hub" aria-label={label}>
      {children}
    </section>
  );
}

export function HubHero({
  caption,
  title,
  people,
  percent,
  meterLabel,
  done,
  total,
  split,
  label,
  onClick,
}: {
  caption: ReactNode;
  title: ReactNode;
  /** 오른쪽 겹친 Avatar(hg-avatars) */
  people?: ReactNode;
  /** 막대 채움 0~100 */
  percent: number;
  meterLabel: string;
  done: number;
  total: number;
  /** 아래 두 칸: [이름, 값] */
  split: [ReactNode, ReactNode][];
  /** 화면 읽기 이름(문장 하나, 보이는 글자 대신) */
  label: string;
  onClick: () => void;
}) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <button type="button" className="hg-hubhero hg-hub__wide" aria-label={label} onClick={onClick}>
      <span className="hg-hubhero__top">
        <span className="hg-hubhero__text">
          <span className="hg-hubhero__cap">{caption}</span>
          <span className="hg-hubhero__title">{title}</span>
        </span>
        {people}
      </span>
      <span className="hg-hubhero__progress">
        <span className="hg-hubhero__meter">
          <span className="hg-hubhero__track" style={{ '--p': p } as React.CSSProperties}>
            <i />
          </span>
          <span className="hg-hubhero__label">{meterLabel}</span>
        </span>
        <span className="hg-hubhero__count">
          {done}
          <small> / {total}</small>
        </span>
      </span>
      {split.length > 0 && (
        <span className="hg-hubhero__split">
          {split.map(([k, v], i) => (
            <span key={i}>
              {k}
              <b>{v}</b>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

/** 홈 할 일·초대 띠(코코아). 띠 전체가 이동 버튼, 닫기(✕) 없음(2026-11-11: 끝내거나 기간이 지나면 사라짐) */
export function HubBand({
  text,
  go,
  onClick,
}: {
  text: string;
  /** 오른쪽 이동 글자(“체크하기”). 없으면 꺾쇠만 */
  go?: string;
  onClick: () => void;
}) {
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

export function HubTile({
  title,
  sub,
  value,
  art,
  small,
  point,
  badge,
  label,
  onClick,
}: {
  title: string;
  sub?: ReactNode;
  value?: ReactNode;
  /** 72px 그림 자리(큰 타일만, 2D 그림이 들어올 때까지 hg-artslot) */
  art?: boolean;
  small?: boolean;
  /** 홈 포인트 상자(오렌지 채움, 홈 ‘월급 계획’ 하나만, 2026-11-11) */
  point?: boolean;
  /** 보조 줄 오른쪽 작은 회색 알약(자산 관리 타일 “상위 38%”, 2026-11-11) */
  badge?: string;
  /** 화면 읽기 이름(없으면 보이는 글자) */
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx('hg-hubtile', small && 'hg-hubtile--sm', point && 'hg-hubtile--point')}
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
      {value !== undefined && <span className="hg-hubtile__value">{value}</span>}
      {art && <span className="hg-artslot" aria-hidden="true" />}
    </button>
  );
}

export function HubSaving({
  name,
  badge,
  percent,
  sub,
  bar,
  label,
  onClick,
}: {
  name: string;
  /** 이름 옆 작은 회색 알약(파트너 저금이면 파트너 이름, 2026-11-11 QA 4구간 D4) */
  badge?: string;
  percent: number;
  sub: ReactNode;
  /** 막대 채움 0~100 */
  bar: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="hg-hubsave hg-hub__wide" aria-label={label} onClick={onClick}>
      <span className="hg-artslot" aria-hidden="true" />
      <span className="hg-hubsave__text">
        <span className="hg-hubsave__row">
          <span className="hg-hubsave__name">
            <span>{name}</span>
            {badge && <span className="hg-hubtile__badge">{badge}</span>}
          </span>
          <span>{percent}%</span>
        </span>
        <span className="hg-hubsave__sub">{sub}</span>
        <span className="hg-hubsave__bar" aria-hidden="true">
          <i style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </span>
      </span>
    </button>
  );
}
