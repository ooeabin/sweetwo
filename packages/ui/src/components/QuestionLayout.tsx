import { Children, useEffect, useRef, type ReactNode } from 'react';
import { useLoadingShown } from './Button';
import { Icon } from './Icon';
import { Wordmark } from './Wordmark';

export interface ChapterProgress {
  /** 1부터 */
  index: number;
  total: number;
  name: string;
  /** 챕터 안 진행 0~100. null이면 막대 없이 글자만(온보딩 결과 O-61~67) */
  fill: number | null;
  /** 넓은 창 칸 막대(Meetup식): 챕터 안 질문 수와 지금까지 연 질문 수 */
  steps?: { total: number; done: number };
  /** 이름이 없을 때 화면 읽기 이름 앞말(기본 ‘온보딩’) */
  label?: string;
  /** 채움 색. 온보딩 챕터만 brand, 다른 질문 흐름(steps로 그린 막대)은 ink(2026-11-09, DESIGN.md) */
  tone?: 'brand' | 'ink';
}

/** 넓은 창 위 바 가운데: 챕터면 “목표” + 칸 막대(brand), 아니면 ProgressSteps */
function BarProgress({
  chapter,
  steps,
}: {
  chapter?: ChapterProgress;
  steps?: { total: number; now: number; fill?: number };
}) {
  if (chapter) {
    const s = chapter.fill === null ? undefined : chapter.steps;
    return (
      <div className="hg-qbar__mid">
        {chapter.name && <p className="hg-qbar__label">{chapter.name}</p>}
        {s && s.total > 0 && (
          <div
            className={`hg-segs${chapter.tone === 'ink' ? ' hg-segs--ink' : ''}`}
            role="progressbar"
            aria-label={`${chapter.name || chapter.label || '온보딩'} 진행`}
            aria-valuemin={0}
            aria-valuemax={s.total}
            aria-valuenow={s.done}
          >
            {Array.from({ length: s.total }, (_, i) => (
              <span key={i} className={`hg-segs__seg${i < s.done ? ' is-on' : ''}`} />
            ))}
          </div>
        )}
      </div>
    );
  }
  if (!steps) return <span />;
  return (
    <div className="hg-qbar__mid">
      <StepsBar steps={steps} />
    </div>
  );
}

function StepsBar({ steps }: { steps: { total: number; now: number; fill?: number } }) {
  return (
    <div className="hg-steps" aria-hidden="true">
      {Array.from({ length: steps.total }, (_, i) => (
        <span
          key={i}
          className={`hg-steps__seg${i < steps.now ? ' is-done' : i === steps.now ? ' is-now' : ''}`}
          style={
            i === steps.now
              ? ({ '--fill': `${steps.fill ?? 50}%` } as React.CSSProperties)
              : undefined
          }
        />
      ))}
    </div>
  );
}

/** 온보딩 챕터 진행(docs/design/components/ChapterBar.md). 뒤로 + 가운데 “목표” + 챕터 안 막대(brand) */
export function ChapterBar({ chapter, onBack }: { chapter: ChapterProgress; onBack?: () => void }) {
  const fill = chapter.fill === null ? null : Math.min(Math.max(Math.round(chapter.fill), 0), 100);
  return (
    <div className={`hg-chapterbar${chapter.tone === 'ink' ? ' hg-chapterbar--ink' : ''}`}>
      <div className="hg-chapterbar__top">
        {onBack && (
          <button type="button" className="hg-q__back hg-back" aria-label="뒤로" onClick={onBack}>
            <Icon name="chevron-left" size={24} />
          </button>
        )}
        {chapter.name && <p className="hg-chapterbar__label">{chapter.name}</p>}
      </div>
      {fill !== null && (
        <div
          className="hg-chapterbar__track"
          role="progressbar"
          aria-label={`${chapter.name || chapter.label || '온보딩'} 진행`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={fill}
        >
          <span
            className="hg-chapterbar__fill"
            style={{ '--fill': `${fill}%` } as React.CSSProperties}
          />
        </div>
      )}
    </div>
  );
}

/** 챕터 목록(ChapterBar.md › ChapterList). O-10은 상태 없이, 챕터 시작 안내(O-20·O-30·O-50)는 끝남·지금·남음 */
export function ChapterList({
  label,
  items,
  now,
}: {
  label: string;
  items: { name: string; desc: string }[];
  /** 지금 챕터 순서(0부터). 주면 앞은 끝남(체크), 뒤는 흐리게, 설명은 지금 챕터만 */
  now?: number;
}) {
  return (
    <ol className="hg-chapters" aria-label={label}>
      {items.map((c, i) => {
        const state = now === undefined ? undefined : i < now ? 'done' : i === now ? 'now' : 'next';
        return (
          <li
            key={c.name}
            className={`hg-chapters__item${state ? ` is-${state}` : ''}`}
            aria-current={state === 'now' ? 'step' : undefined}
          >
            <span className="hg-chapters__num" aria-hidden="true">
              {state === 'done' ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <span className="hg-chapters__text">
              <span className="hg-chapters__name">
                {c.name}
                {state === 'done' && <span className="hg-sr"> 끝남</span>}
              </span>
              {(state === undefined || state === 'now') && (
                <span className="hg-chapters__desc">{c.desc}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// 한 화면 한 질문 틀(docs/design/components/QuestionLayout.md). Enter = 다음(폼 제출), Esc = 뒤로.
export function QuestionLayout({
  steps,
  chapter: chapterProp,
  title,
  help,
  children,
  primary,
  later,
  secondary,
  onBack,
  onSubmit,
  wide,
  center,
  summary,
  note,
  hero,
  celebrate,
}: {
  steps?: { total: number; now: number; fill?: number };
  /** 온보딩 챕터 진행(ChapterBar). 주면 steps 대신 “목표” + 챕터 안 막대 */
  chapter?: ChapterProgress;
  title: ReactNode;
  help?: ReactNode;
  children?: ReactNode;
  /** variant 기본 primary. 대답 성격(O-21 0개 ‘나중에 고를게요’)이면 secondary, 되돌릴 수 없는 삭제(S-18b)면 danger */
  primary?: {
    label: string;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
  };
  /** loading: 이 글자 버튼이 서버 일을 기다리는 중(2026-11-06, 누르기 막고 0.3초 뒤 도는 원) */
  later?: { label: string; onClick: () => void; loading?: boolean };
  /** 주 버튼 왼쪽 회색 보조 버튼(대답 성격의 ‘취소’ 등). 좁은 창에서 주 버튼과 반씩 */
  /** disabled: 오프라인 등으로 못 누름(2026-11-13 S-12d ‘해제할게요’) */
  secondary?: { label: string; onClick: () => void; loading?: boolean; disabled?: boolean };
  onBack?: () => void;
  onSubmit?: () => void;
  /** 결과 화면(O-61~67): 본문 2열(`hg-q__cols`)을 쓸 수 있게 넓은 틀 */
  wide?: boolean;
  /** 안내 화면: 제목 가운데 정렬 + 세로 가운데(O-01, A-02와 같은 배치). 입력 영역이 없으면 기본으로 켬 */
  center?: boolean;
  /** 주 버튼 바로 위 요약(`hg-q__sum`). 좁은 창에서도 버튼과 같이 아래에 붙어 있음(O-50 여유 자금) */
  summary?: ReactNode;
  /** 버튼 바로 위 가운데 정렬 안내 한 줄(2026-11-03, S-11e·G-02p ‘올린 사진은 …’) */
  note?: ReactNode;
  /** 제목 위 주인공 자리(그림 또는 완료 표시). 결과 화면(O-60)처럼 가운데 배치와 같이 씀 */
  hero?: ReactNode;
  /** 축하·보상 화면 배경(화면 위 40~50% brand-soft → surface, `hg-celebrate-bg`, DESIGN.md ‘색’ 예외). 움직이는 그림 자리가 있는 축하 화면만 */
  celebrate?: boolean;
}) {
  // 2026-11-03 칸 막대(StepsBar) 대신 모든 질문 흐름을 온보딩과 같은 얇은 막대(ChapterBar)로
  const chapter: ChapterProgress | undefined =
    chapterProp ??
    (steps && steps.total > 0
      ? {
          index: 1,
          total: 1,
          name: '',
          label: '질문',
          tone: 'ink',
          fill: ((steps.now + (steps.fill ?? 50) / 100) / steps.total) * 100,
          steps: { total: steps.total, done: steps.now + 1 },
        }
      : undefined);
  const centered = center ?? Children.toArray(children).length === 0;
  // 처리 중(2026-11-06): 누르기와 Enter는 바로 막고, 도는 원은 0.3초 넘을 때만(Button.md)
  const busy = !!(primary?.loading || later?.loading || secondary?.loading);
  const primaryShown = useLoadingShown(primary?.loading);
  const laterShown = useLoadingShown(later?.loading);
  const secondShown = useLoadingShown(secondary?.loading);
  useEffect(() => {
    if (!onBack) return;
    const onKey = (e: KeyboardEvent) => {
      // 시트·대화상자가 열려 있으면 Esc는 그것만 닫음(2026-11-10: 소비자가 onBack을 빼면 뒤로가 사라져 제목이 움직이던 것)
      if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  // Enter = 주 버튼(12 공통 ‘키보드’, 2026-11-10 QA 2구간 S2-08): 입력 칸이 없거나 휠·빈 곳에 포커스가 있어도.
  // 입력 칸은 form 제출이 처리하고, 다른 버튼·링크·선택지에 포커스가 있으면 그것을 누름. 한글 조합 중, 시트·대화상자가 열려 있으면 무시
  const submitRef = useRef<() => void>();
  submitRef.current = primary && !primary.disabled && !busy ? onSubmit : undefined;
  useEffect(() => {
    if (!primary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const a = document.activeElement;
      if (
        a &&
        a !== document.body &&
        a.closest(
          'button, a, input, textarea, select, [role="checkbox"], [role="radio"], [role="switch"]',
        )
      )
        return;
      e.preventDefault();
      submitRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [!!primary]); // eslint-disable-line react-hooks/exhaustive-deps

  const backOnly = !primary && !later && !secondary;
  return (
    <main className={celebrate ? 'hg-qmain hg-celebrate-bg' : 'hg-qmain'}>
      <div className="hg-qbar">
        <Wordmark height={24} />
        <BarProgress chapter={chapter} steps={steps} />
        <span />
      </div>
      <form
        className={[
          'hg-q',
          wide && 'hg-q--wide',
          centered && 'hg-q--center',
          !chapter && !steps && !onBack && 'hg-q--top',
        ]
          .filter(Boolean)
          .join(' ')}
        onSubmit={(e) => {
          e.preventDefault();
          if (!primary?.disabled && !busy) onSubmit?.();
        }}
      >
        {chapter ? (
          <div className="hg-q__nav">
            <ChapterBar chapter={chapter} onBack={onBack} />
          </div>
        ) : (
          // 2026-11-10 뒤로가 없는 화면은 뒤로 자리를 비워 두지 않음: 제목이 위 여백(hg-q--top, 48px)에서 바로 시작
          (steps || onBack) && (
            <div className="hg-q__nav">
              {steps && <StepsBar steps={steps} />}
              {onBack && (
                <button
                  type="button"
                  className="hg-q__back hg-back"
                  aria-label="뒤로"
                  onClick={onBack}
                >
                  <Icon name="chevron-left" size={24} />
                </button>
              )}
            </div>
          )
        )}
        {hero && <div className="hg-q__hero">{hero}</div>}
        <div className="hg-q__head">
          <h1 className="hg-q__title">{title}</h1>
          {help && <p className="hg-q__help">{help}</p>}
        </div>
        {children}
        {(primary || later || secondary || onBack) && (
          <div
            className={`hg-q__foot${backOnly ? ' is-backonly' : ''}${summary ? ' has-sum' : ''}${note ? ' has-note' : ''}`}
          >
            {note && <p className="hg-q__note">{note}</p>}
            {summary && (
              <div className="hg-q__sum" aria-live="polite">
                {summary}
              </div>
            )}
            {onBack && (
              <button type="button" className="hg-btn hg-btn--ghost hg-q__prev" onClick={onBack}>
                <Icon name="chevron-left" size={16} />
                이전
              </button>
            )}
            {later && (
              <button
                type="button"
                className={`hg-btn hg-btn--link hg-btn--quiet${laterShown ? ' is-loading' : ''}`}
                aria-busy={later.loading || undefined}
                onClick={() => !busy && later.onClick()}
              >
                {later.label}
              </button>
            )}
            {primary && <span className="hg-q__hint">Enter 키를 눌러도 돼요</span>}
            {secondary && (
              <button
                type="button"
                className={`hg-btn hg-btn--secondary hg-q__second${secondShown ? ' is-loading' : ''}`}
                aria-busy={secondary.loading || undefined}
                disabled={secondary.disabled}
                onClick={() => !busy && secondary.onClick()}
              >
                {secondary.label}
              </button>
            )}
            {primary && (
              <button
                type="submit"
                className={`hg-btn hg-btn--${primary.variant ?? 'primary'}${primaryShown ? ' is-loading' : ''}`}
                disabled={primary.disabled}
                aria-busy={primary.loading || undefined}
              >
                {primary.label}
              </button>
            )}
          </div>
        )}
      </form>
    </main>
  );
}
