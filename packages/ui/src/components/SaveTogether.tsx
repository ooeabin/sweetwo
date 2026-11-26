import { useRef, useState, type ReactNode } from 'react';
import { AddRow } from './AddRow';
import { cx } from './cx';

// 같이 모으기 상자(docs/design/components/SaveTogether.md, 2026-11-13 ADR 0009). 홈 주인공 H-10.
// SaveTogether(틀: 머리 “같이 모으기” + D-day 알약 → 가로 넘김 칸 최대 3 + ‘저금 모두 보기 ›’ + 점 → ‘+ 수입 적기’),
// 칸 하나 = SaveTogetherSlide(사람 + 이름 → 큰 숫자 → 막대 + 보조 줄들, 칸 전체가 버튼, 화면 읽기는 문장 하나).
// 2026-11-18: 누를 수 없는 정보 상자(칸은 div, onClick 없음, ‘모두 보기’ 칸 없음). 같이 모으기가 0개면 홈이 상자를 그리지 않음.
// 2026-11-26 사용자 결정: 홈 칸 왼쪽 자리는 그 저축·투자의 그림(`art`, 파일이 없으면 칸째 없음), 사람 원은 머리 제목 오른쪽
// 작은 겹친 Avatar(`owners`, 지금 보이는 칸 기준). W-10 묶음 카드(머리 없음)는 `people`을 칸 안에 그대로.

export interface SaveTogetherSlideProps {
  /** 이름 왼쪽 겹친 Avatar(hg-avatars). W-10 묶음 카드(머리 없음)만, 홈은 머리 `owners` */
  people?: ReactNode;
  /** 이름 왼쪽 그림(2026-11-26 홈 H-10, `Illustration`이 파일이 없으면 null을 돌려주면 자리도 없음) */
  art?: ReactNode;
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
  /** 없으면 누를 수 없는 칸(2026-11-18 H-10은 정보 상자) */
  onClick?: () => void;
}

export function SaveTogetherSlide({
  people,
  art,
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
  const cls = cx(
    'hg-together__slide',
    !onClick && 'hg-together__slide--info',
    paused && 'hg-together--paused',
    percentOnly && 'hg-together--percent',
  );
  const inner = (
    <>
      <span className="hg-together__people">
        {art}
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
    </>
  );
  return onClick ? (
    <button type="button" className={cls} aria-label={label} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={cls} role="group" aria-label={label}>
      {inner}
    </div>
  );
}

export function SaveTogether({
  title,
  head,
  slides,
  moneyIn,
  label,
  className,
}: {
  title: string;
  /** 머리 오른쪽(D-day 알약 또는 글자 버튼 “결혼식 날짜 알려 주기”) */
  head?: ReactNode;
  /** 칸마다 `owners` = 머리 제목 바로 오른쪽 작은 겹친 Avatar(지금 보이는 칸 기준, 2026-11-26) */
  slides: (SaveTogetherSlideProps & { owners?: ReactNode })[];
  /** 맨 아래 회색 글자 버튼 “+ 수입 적기” */
  moneyIn?: { label: string; onClick: () => void };
  /** 묶음 이름(화면 읽기) */
  label: string;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const count = slides.length;
  const owners = slides[Math.min(at, count - 1)]?.owners;
  return (
    <section className={cx('hg-together', className)} aria-label={label}>
      <div className="hg-together__head">
        <span className="hg-together__titlerow">
          <h2 className="hg-together__title">{title}</h2>
          {owners && <span className="hg-together__owners">{owners}</span>}
        </span>
        {head}
      </div>
      <div
        ref={track}
        className="hg-together__track"
        // 칸이 눌리지 않아도 가로로 넘기는 칸은 키보드로 닿게(2026-11-18)
        {...(count > 1 ? { tabIndex: 0, role: 'group', 'aria-label': label } : {})}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setAt(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {slides.map((s, i) => (
          <SaveTogetherSlide key={i} {...s} />
        ))}
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
