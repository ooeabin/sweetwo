import { Children, useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface ChapterProgress {
  /** 1부터 */
  index: number;
  total: number;
  name: string;
  /** 챕터 안 진행 0~100 */
  fill: number;
}

/** 온보딩 챕터 진행(docs/design/components/ChapterBar.md). 뒤로 + 가운데 “2/4 목표” + 챕터 안 막대(brand) */
export function ChapterBar({ chapter, onBack }: { chapter: ChapterProgress; onBack?: () => void }) {
  const fill = Math.min(Math.max(Math.round(chapter.fill), 0), 100);
  return (
    <div className="hg-chapterbar">
      <div className="hg-chapterbar__top">
        {onBack && (
          <button type="button" className="hg-q__back" aria-label="뒤로" onClick={onBack}>
            <Icon name="chevron-left" size={24} />
          </button>
        )}
        <p className="hg-chapterbar__label">
          <span className="hg-chapterbar__num">
            {chapter.index}/{chapter.total}
          </span>{' '}
          {chapter.name}
        </p>
      </div>
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
    </div>
  );
}

/** 온보딩 첫 화면(O-10) 챕터 목록(ChapterBar.md › ChapterList) */
export function ChapterList({
  label,
  items,
}: {
  label: string;
  items: { name: string; desc: string }[];
}) {
  return (
    <ol className="hg-chapters" aria-label={label}>
      {items.map((c, i) => (
        <li key={c.name} className="hg-chapters__item">
          <span className="hg-chapters__num" aria-hidden="true">
            {i + 1}
          </span>
          <span className="hg-chapters__text">
            <span className="hg-chapters__name">{c.name}</span>
            <span className="hg-chapters__desc">{c.desc}</span>
          </span>
        </li>
      ))}
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
  /** 온보딩 챕터 진행(ChapterBar). 주면 steps 대신 “2/4 목표” + 챕터 안 막대 */
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

  return (
    <main style={{ padding: '0 var(--space-4)' }}>
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
              {steps && (
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
              )}
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
        {(primary || later) && (
          <div className="hg-q__foot">
            {later && (
              <button type="button" className="hg-btn hg-btn--link" onClick={later.onClick}>
                {later.label}
              </button>
            )}
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
