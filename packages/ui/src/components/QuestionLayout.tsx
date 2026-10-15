import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

// 한 화면 한 질문 틀(docs/design/components/QuestionLayout.md). Enter = 다음(폼 제출), Esc = 뒤로.
export function QuestionLayout({
  steps,
  title,
  help,
  children,
  primary,
  later,
  onBack,
  onSubmit,
}: {
  steps?: { total: number; now: number; fill?: number };
  title: ReactNode;
  help?: ReactNode;
  children?: ReactNode;
  primary?: { label: string; disabled?: boolean; loading?: boolean };
  later?: { label: string; onClick: () => void };
  onBack?: () => void;
  onSubmit?: () => void;
}) {
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
        className="hg-q"
        onSubmit={(e) => {
          e.preventDefault();
          if (!primary?.disabled) onSubmit?.();
        }}
      >
        {(steps || onBack) && (
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
                <Icon name="arrow-left" size={24} />
              </button>
            )}
          </div>
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
