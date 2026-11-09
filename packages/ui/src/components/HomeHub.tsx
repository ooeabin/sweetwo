import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

// 홈 허브(docs/design/components/HomeHub.md, 2026-11-09 GCOO 홈처럼): 회색 바탕 위 크기가 다른 흰 상자.
// Hub(격자) > HubHero(다음 월급날까지 + 보낸 줄 막대 + 보낸 금액 | 모은 금액), HubBand(할 일 띠, 오렌지 채움),
// HubTile(반 칸 타일, 큰 것은 72px 그림 자리), HubSaving(목표 금액에 가장 가까운 저금 하나). 모두 누르면 그 화면.

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

export function HubBand({
  text,
  go,
  onClick,
  close,
}: {
  text: string;
  /** 오른쪽 이동 글자(“체크하기”). 없으면 꺾쇠만 */
  go?: string;
  onClick: () => void;
  close?: { label: string; onClick: () => void };
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
      {close && <IconButton icon="x" label={close.label} ghost small onClick={close.onClick} />}
    </div>
  );
}

export function HubTile({
  title,
  sub,
  value,
  art,
  small,
  label,
  onClick,
}: {
  title: string;
  sub?: ReactNode;
  value?: ReactNode;
  /** 72px 그림 자리(큰 타일만, 2D 그림이 들어올 때까지 hg-artslot) */
  art?: boolean;
  small?: boolean;
  /** 화면 읽기 이름(없으면 보이는 글자) */
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx('hg-hubtile', small && 'hg-hubtile--sm')}
      aria-label={label}
      onClick={onClick}
    >
      <span className="hg-hubtile__title">{title}</span>
      {sub && <span className="hg-hubtile__sub">{sub}</span>}
      {value !== undefined && <span className="hg-hubtile__value">{value}</span>}
      {art && <span className="hg-artslot" aria-hidden="true" />}
    </button>
  );
}

export function HubSaving({
  name,
  percent,
  sub,
  bar,
  label,
  onClick,
}: {
  name: string;
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
          <span>{name}</span>
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
