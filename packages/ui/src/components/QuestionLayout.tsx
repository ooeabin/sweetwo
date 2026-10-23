import { Children, useEffect, type ReactNode } from 'react';
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
        <p className="hg-qbar__label">{chapter.name}</p>
        {s && s.total > 0 && (
          <div
            className="hg-segs"
            role="progressbar"
            aria-label={`${chapter.name} 진행`}
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
    <div className="hg-chapterbar">
      <div className="hg-chapterbar__top">
        {onBack && (
          <button type="button" className="hg-q__back" aria-label="뒤로" onClick={onBack}>
            <Icon name="chevron-left" size={24} />
          </button>
        )}
        <p className="hg-chapterbar__label">{chapter.name}</p>
      </div>
      {fill !== null && (
        <div
          className="hg-chapterbar__track"
          role="progressbar"
          aria-label={`${chapter.name} 진행`}
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
  chapter,
  title,
  help,
  children,
  primary,
  later,
  onBack,
  onSubmit,
  wide,
  center,
}: {
  steps?: { total: number; now: number; fill?: number };
  /** 온보딩 챕터 진행(ChapterBar). 주면 steps 대신 “목표” + 챕터 안 막대 */
  chapter?: ChapterProgress;
  title: ReactNode;
  help?: ReactNode;
  children?: ReactNode;
  primary?: { label: string; disabled?: boolean; loading?: boolean };
  later?: { label: string; onClick: () => void };
  onBack?: () => void;
  onSubmit?: () => void;
  /** 결과 화면(O-61~67): 본문 2열(`hg-q__cols`)을 쓸 수 있게 넓은 틀 */
  wide?: boolean;
  /** 안내 화면: 제목 가운데 정렬 + 세로 가운데(O-01, A-02와 같은 배치). 입력 영역이 없으면 기본으로 켬 */
  center?: boolean;
}) {
  const centered = center ?? Children.toArray(children).length === 0;
  useEffect(() => {
    if (!onBack) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const backOnly = !primary && !later;
  return (
    <main style={{ padding: '0 var(--space-4)' }}>
      <div className="hg-qbar">
        <Wordmark height={24} />
        <BarProgress chapter={chapter} steps={steps} />
        <span />
      </div>
      <form
        className={['hg-q', wide && 'hg-q--wide', centered && 'hg-q--center']
          .filter(Boolean)
          .join(' ')}
        onSubmit={(e) => {
          e.preventDefault();
          if (!primary?.disabled) onSubmit?.();
        }}
      >
        {chapter ? (
          <div className="hg-q__nav">
            <ChapterBar chapter={chapter} onBack={onBack} />
          </div>
        ) : (
          (steps || onBack) && (
            <div className="hg-q__nav">
              {steps && <StepsBar steps={steps} />}
              {onBack && (
                <button type="button" className="hg-q__back" aria-label="뒤로" onClick={onBack}>
                  <Icon name="chevron-left" size={24} />
                </button>
              )}
            </div>
          )
        )}
        <div className="hg-q__head">
          <h1 className="hg-q__title">{title}</h1>
          {help && <p className="hg-q__help">{help}</p>}
        </div>
        {children}
        {(primary || later || onBack) && (
          <div className={`hg-q__foot${backOnly ? ' is-backonly' : ''}`}>
            {onBack && (
              <button type="button" className="hg-btn hg-btn--ghost hg-q__prev" onClick={onBack}>
                <Icon name="chevron-left" size={16} />
                이전
              </button>
            )}
            {later && (
              <button type="button" className="hg-btn hg-btn--link" onClick={later.onClick}>
                {later.label}
              </button>
            )}
            {primary && <span className="hg-q__hint">Enter 키를 눌러도 돼요</span>}
            {primary && (
              <button
                type="submit"
                className={`hg-btn hg-btn--primary${primary.loading ? ' is-loading' : ''}`}
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
