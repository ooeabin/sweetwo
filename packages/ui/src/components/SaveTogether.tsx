import { useRef, useState, type ReactNode } from 'react';
import { AddRow } from './AddRow';
import { cx } from './cx';
import { Icon } from './Icon';

// 같이 모으기 상자(docs/design/components/SaveTogether.md, 2026-11-13 ADR 0009). 홈 주인공 H-10.
// SaveTogether(틀: 머리 “같이 모으기” + D-day 알약 → 가로 넘김 칸 최대 3 + ‘저금 모두 보기 ›’ + 점 → ‘+ 돈 들어왔어요’),
// 칸 하나 = SaveTogetherSlide(사람 + 이름 → 큰 숫자 → 막대 + 보조 줄들, 칸 전체가 버튼, 화면 읽기는 문장 하나).
// 빈 상태(미합류·저금 0) = SaveTogetherEmpty(질문 + 이름 칩 + ‘+ 저금 만들기’).

export interface SaveTogetherSlideProps {
  /** 이름 왼쪽 겹친 Avatar(hg-avatars) */
  people?: ReactNode;
  name: string;
  /** 큰 숫자(모은 금액, 퍼센트만이면 “62%”) */
  amount: ReactNode;
  /** 막대 채움 0~100(목표 금액이 없으면 null = 막대 없음) */
  bar: number | null;
  /** 막대·숫자 아래 회색 줄들(목표 금액의 몇 %, 이번 달 +, 기한까지, 각자 금액, 멈춤). 순서대로, 줄마다 두 줄까지 */
  lines?: ReactNode[];
  /** 다 모음 배지(“다 모았어요”) */
  done?: string;
  /** 해제 대기: 막대를 slate로 */
  paused?: boolean;
  percentOnly?: boolean;
  /** 화면 읽기 문장 하나 */
  label: string;
  onClick: () => void;
}

export function SaveTogetherSlide({
  people,
  name,
  amount,
  bar,
  lines = [],
  done,
  paused,
  percentOnly,
  label,
  onClick,
}: SaveTogetherSlideProps) {
  return (
    <button
      type="button"
      className={cx(
        'hg-together__slide',
        paused && 'hg-together--paused',
        percentOnly && 'hg-together--percent',
      )}
      aria-label={label}
      onClick={onClick}
    >
      <span className="hg-together__people">
        {people}
        <span className="hg-together__name">{name}</span>
        {done && <span className="hg-badge hg-badge--achieved">{done}</span>}
      </span>
      <span className="hg-together__amount">{amount}</span>
      {bar !== null && (
        <span className="hg-together__bar" aria-hidden="true">
          <i style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </span>
      )}
      {lines.map((l, i) => (
        <span key={i} className="hg-together__line">
          {l}
        </span>
      ))}
    </button>
  );
}

export function SaveTogether({
  title,
  head,
  slides,
  more,
  moneyIn,
  label,
  className,
}: {
  title: string;
  /** 머리 오른쪽(D-day 알약 또는 글자 버튼 “결혼식 날짜 알려 주기”) */
  head?: ReactNode;
  slides: SaveTogetherSlideProps[];
  /** 마지막 칸 “저금 모두 보기 ›”(저금 2개 이상일 때) */
  more?: { label: string; onClick: () => void };
  /** 맨 아래 회색 글자 버튼 “+ 돈 들어왔어요” */
  moneyIn?: { label: string; onClick: () => void };
  /** 묶음 이름(화면 읽기) */
  label: string;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const count = slides.length + (more ? 1 : 0);
  return (
    <section className={cx('hg-together', className)} aria-label={label}>
      <div className="hg-together__head">
        <h2 className="hg-together__title">{title}</h2>
        {head}
      </div>
      <div
        ref={track}
        className="hg-together__track"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setAt(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {slides.map((s, i) => (
          <SaveTogetherSlide key={i} {...s} />
        ))}
        {more && (
          <button type="button" className="hg-together__more" onClick={more.onClick}>
            {more.label}
            <Icon name="chevron-right" size={16} />
          </button>
        )}
      </div>
      {count > 1 && (
        <div className="hg-together__dots" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <i key={i} className={i === at ? 'is-on' : undefined} />
          ))}
        </div>
      )}
      {moneyIn && <AddRow label={moneyIn.label} onClick={moneyIn.onClick} />}
    </section>
  );
}

/** 빈 상태(미합류·저금 0): “무엇을 같이 모을까요?” + 이름 칩(고르면 W-11a) + ‘+ 저금 만들기’ */
export function SaveTogetherEmpty({
  title,
  question,
  chips,
  add,
  head,
  className,
}: {
  title: string;
  /** 머리 오른쪽(D-day 알약 등, SaveTogether와 같음) */
  head?: ReactNode;
  question: string;
  chips: { label: string; onClick: () => void }[];
  add: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <section className={cx('hg-together', className)} aria-label={title}>
      <div className="hg-together__head">
        <h2 className="hg-together__title">{title}</h2>
        {head}
      </div>
      <p className="hg-together__ask">{question}</p>
      <div className="hg-together__chips" role="group" aria-label={question}>
        {chips.map((c) => (
          <button key={c.label} type="button" className="hg-chip" onClick={c.onClick}>
            {c.label}
          </button>
        ))}
      </div>
      <AddRow label={add.label} onClick={add.onClick} />
    </section>
  );
}
