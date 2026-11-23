import { cx } from './cx';
import { isValidElement, type CSSProperties, type ReactNode } from 'react';
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
  soft = false,
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
  /** 오른쪽 값을 조용하게(바탕 기준 2026-11-23: 값이 설정·상태일 때 15px 400 slate. 금액은 기본 17px 700) */
  soft?: boolean;
}) {
  const inner = (
    <>
      {icon ? <Icon name={icon} /> : (shownLead(lead) ?? <span />)}
      <span className="hg-listrow__text">
        <span className="hg-listrow__label">{label}</span>
        {sub && <span className="hg-listrow__sub">{sub}</span>}
      </span>
      {value !== undefined ? (
        <span className={cx('hg-listrow__value', soft && 'is-soft')}>
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

type LeadProps = {
  tone?: LeadTone;
  icon?: IconName;
  uiIcon?: boolean;
  progress?: number;
  art?: ReactNode;
  photo?: string;
};
/** 그림이 아직 없는 종류 자리(예전 회색 빈 원 hg-lead--slot): 진행 원·사진·그림·UI 아이콘이 아님 */
const isSlot = (p: LeadProps) => p.progress === undefined && !p.photo && !p.art && !p.uiIcon;

/**
 * 줄 앞 칸을 그릴지: 그림이 없는 종류 자리 Lead면 null(2026-11-15 3차 검토, 칸도 비우지 않음).
 * ListRow·TransferRow가 칸 모양(hg-transfer--lead 등)을 정할 때 씀
 */
export function shownLead(lead: ReactNode): ReactNode {
  if (isValidElement<LeadProps>(lead) && lead.type === Lead && isSlot(lead.props)) return null;
  return lead;
}

/**
 * 행 앞 칸(hg-lead, docs/design/components/ListRow.md ‘Lead’). 종류 그림 자리는 2D 그림이 들어올 때까지
 * 그리지 않음(2026-11-15 3차 검토: 예전 회색 빈 원 hg-lead--slot 숨김, 자리도 비우지 않음). 종류는 lead-kinds.ts 표 그대로.
 * UI 아이콘(+ 등)은 uiIcon으로 그대로. 목표 금액이 있는 저금 줄은 진행 원(progress). 장식이라 aria-hidden(금액·진행은 줄 글자가 말함).
 */
export function Lead({
  tone,
  icon,
  uiIcon,
  progress,
  art,
  photo,
}: {
  tone?: LeadTone;
  icon?: IconName;
  /** icon이 종류 표시가 아니라 UI 아이콘(+ 추가 등)이면 true: 빈 자리 대신 아이콘을 그린다 */
  uiIcon?: boolean;
  /** 진행 원(0~100 정수 %, 저금 줄 모은 금액 ÷ 목표 금액). 있으면 icon 대신, 바탕은 저금 영역(goal) */
  progress?: number;
  /** 그림(Illustration 등, 지금 쓰는 곳 없음) */
  art?: ReactNode;
  /** 사진 주소(원 안을 꽉 채움, 지금 쓰는 곳 없음) */
  photo?: string;
}) {
  const ring = progress !== undefined && !photo && !art;
  const p = ring ? Math.min(Math.max(Math.trunc(progress), 0), 100) : 0;
  if (isSlot({ progress, photo, art, uiIcon })) return null;
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
      {photo ? <img src={photo} alt="" /> : (art ?? (uiIcon && icon ? <Icon name={icon} /> : null))}
    </span>
  );
}

export function List({ label, children }: { label?: string; children: ReactNode }) {
  return (
    // 이름이 있으면 묶음(group): 역할 없는 div에는 aria-label을 못 씀(axe aria-prohibited-attr, QA 3구간 S3-23)
    <div className="hg-list" role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}
