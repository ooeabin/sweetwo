import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { QuestionLayout, type ChapterProgress } from './QuestionLayout';

// 로딩 상태(docs/design/components/Skeleton.md, 2026-11-04 우리나라 앱 참고: 당근 뼈대, 카카오페이·토스 처리 중).
// 0.3초 안에 오면 뼈대를 보여 주지 않음(13 공통 상태 5번).

/** ms가 지나면 true(그 전엔 뼈대를 그리지 않아 깜빡임이 없음) */
export function useDelayed(ms = 300) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return on;
}

/** 회색 뼈대 한 조각 */
export function Skel({
  w,
  h = 16,
  round,
  style,
}: {
  w?: number | string;
  h?: number | string;
  round?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className="hg-skel"
      aria-hidden="true"
      style={{
        width: w,
        height: h,
        borderRadius: round ? 'var(--radius-full)' : undefined,
        ...style,
      }}
    />
  );
}

/** 목록 줄 뼈대(이름 + 오른쪽 값). 설정·상세 화면 카드 안 */
export function SkelRows({ rows }: { rows: [number, number?][] }) {
  return (
    <div className="hg-skelcard" aria-hidden="true">
      {rows.map(([l, v], i) => (
        <div key={i} className="hg-skelcard__row">
          <Skel w={l} />
          {v ? <Skel w={v} /> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * 질문 화면 불러오는 중(D): 제목·도움말은 바로(정해진 문구), 입력 칸과 아래 버튼만 뼈대.
 * 제목이 데이터에 따라 바뀌면 title을 비우면 제목도 뼈대.
 */
export function QuestionSkeleton({
  title,
  help,
  onBack,
  chapter,
  fields = 1,
}: {
  title?: ReactNode;
  help?: ReactNode;
  /** 없으면 이전 화면으로, null이면 뒤로 버튼 없음(흐름의 첫 화면) */
  onBack?: (() => void) | null;
  /** 온보딩·합류 진행 막대(2026-11-06): 불러오는 동안에도 같은 자리에 */
  chapter?: ChapterProgress;
  /** 입력 칸 뼈대 수 */
  fields?: number;
}) {
  const show = useDelayed();
  return (
    <QuestionLayout
      title={title ?? (show ? <Skel w="70%" h={28} /> : <span aria-hidden="true">&nbsp;</span>)}
      help={help}
      chapter={chapter}
      // 뒤로 갈 곳을 모르면 이전 화면으로
      onBack={onBack === null ? undefined : (onBack ?? (() => window.history.back()))}
    >
      <div className="hg-stack hg-skelq" aria-busy="true" style={{ gap: 'var(--space-3)' }}>
        {show &&
          Array.from({ length: fields }, (_, i) => (
            <Skel key={i} h={56} w={i === fields - 1 && fields > 1 ? '60%' : '100%'} />
          ))}
      </div>
      {show && <Skel h={56} style={{ marginTop: 'auto' }} />}
    </QuestionLayout>
  );
}

/**
 * 처리 중(E): 가운데 그림 자리 + 한 문장 + 보조(카카오페이·토스). 오래 걸리는 일(파일 만들기, 연결 처리)에만.
 * 그림이 생기기 전에는 회색 원 안 아이콘.
 */
export function ProcessingState({
  icon,
  art,
  title,
  sub,
}: {
  icon?: IconName;
  /** 3D 그림(있으면 아이콘 대신) */
  art?: ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <div className="hg-busy" role="status" aria-live="polite">
      <span className="hg-busy__art" aria-hidden="true">
        {art ?? (icon ? <Icon name={icon} size={24} /> : null)}
      </span>
      <p className="hg-busy__title">{title}</p>
      {sub && <p className="hg-busy__sub">{sub}</p>}
    </div>
  );
}
