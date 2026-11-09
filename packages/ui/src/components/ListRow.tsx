import { cx } from './cx';
import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import type { LeadTone } from './lead-kinds';

// 목록 한 줄(docs/design/components/ListRow.md). 누를 수 있으면 button, 아니면 div.
export function ListRow({
  icon,
  lead,
  label,
  sub,
  value,
  unit,
  onClick,
  chevron = Boolean(onClick),
  locked = false,
}: {
  icon?: IconName;
  lead?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  unit?: string;
  onClick?: () => void;
  chevron?: boolean;
  /** 고칠 수 없는 줄(각자 모드 파트너 월급 계획, 2026-11-09): 꺾쇠 자리에 자물쇠 */
  locked?: boolean;
}) {
  const inner = (
    <>
      {icon ? <Icon name={icon} /> : (lead ?? <span />)}
      <span className="hg-listrow__text">
        <span className="hg-listrow__label">{label}</span>
        {sub && <span className="hg-listrow__sub">{sub}</span>}
      </span>
      {value !== undefined ? (
        <span className="hg-listrow__value">
          {value}
          {unit && <span className="hg-unit">{unit}</span>}
        </span>
      ) : (
        <span />
      )}
      {locked ? (
        <Icon name="lock" size={16} className="hg-listrow__lock" />
      ) : chevron ? (
        <span className="hg-chevron" aria-hidden="true" />
      ) : (
        <span />
      )}
    </>
  );
  return onClick ? (
    <button type="button" className="hg-listrow" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="hg-listrow">{inner}</div>
  );
}

/**
 * 행 앞 아이콘 칸(hg-lead, docs/design/components/ListRow.md ‘Lead’). 2026-11-09: 영역 색 원 + Phosphor 아이콘(종류는 lead-kinds.ts 표),
 * 목표 금액이 있는 저금 줄은 아이콘 대신 진행 원(progress). 장식이라 aria-hidden(금액·진행은 줄 글자가 말함).
 */
export function Lead({
  tone,
  icon,
  progress,
  art,
  photo,
}: {
  tone?: LeadTone;
  icon?: IconName;
  /** 진행 원(0~100 정수 %, 저금 줄 모은 돈 ÷ 목표 금액). 있으면 icon 대신, 바탕은 저금 영역(goal) */
  progress?: number;
  /** 그림(Illustration 등, 지금 쓰는 곳 없음) */
  art?: ReactNode;
  /** 사진 주소(원 안을 꽉 채움, 지금 쓰는 곳 없음) */
  photo?: string;
}) {
  const ring = progress !== undefined && !photo && !art;
  const p = ring ? Math.min(Math.max(Math.trunc(progress), 0), 100) : 0;
  return (
    <span
      className={cx(
        'hg-lead',
        ring ? 'hg-lead--ring' : tone && `hg-lead--${tone}`,
        photo && 'hg-lead--photo',
      )}
      style={ring ? ({ '--p': p } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {photo ? <img src={photo} alt="" /> : (art ?? (!ring && icon ? <Icon name={icon} /> : null))}
    </span>
  );
}

export function List({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="hg-list" aria-label={label}>
      {children}
    </div>
  );
}
