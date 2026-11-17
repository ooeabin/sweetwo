import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';

// 글자 입력 칸 + 라벨 + 도움말(docs/design/components/Input.md)
export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, help, error, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;
  return (
    <div className="hg-field">
      <label className="hg-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cx('hg-input', Boolean(error) && 'is-error', className)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={help || error ? helpId : undefined}
        {...rest}
      />
      {(error || help) && (
        <span id={helpId} className={cx('hg-help', Boolean(error) && 'is-error')}>
          {error ?? help}
        </span>
      )}
    </div>
  );
});

// 여러 줄 글자 칸(Input.md ‘여러 줄’, 2026-11-17): hg-input + hg-textarea.
// 크기 조절 손잡이는 없고(resize: none), 글이 늘면 높이가 따라 커진다. 최소·최대 높이는 CSS(.hg-textarea), 넘으면 안에서 스크롤.
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  help?: ReactNode;
}

export function Textarea({ label, help, className, id, onInput, value, ...rest }: TextareaProps) {
  const autoId = useId();
  const tid = id ?? autoId;
  const el = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const t = el.current;
    if (!t) return;
    t.style.height = 'auto';
    // border-box: 테두리 두께를 더함
    t.style.height = `${t.scrollHeight + (t.offsetHeight - t.clientHeight)}px`;
  }, []);
  useLayoutEffect(fit, [fit, value]);
  // 너비가 바뀌어 줄바꿈이 달라질 때
  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);
  return (
    <div className="hg-field">
      <label className="hg-field__label" htmlFor={tid}>
        {label}
      </label>
      <textarea
        ref={el}
        id={tid}
        className={cx('hg-input hg-textarea', className)}
        aria-describedby={help ? `${tid}-help` : undefined}
        value={value}
        onInput={(e) => {
          fit();
          onInput?.(e);
        }}
        {...rest}
      />
      {help && (
        <span id={`${tid}-help`} className="hg-help">
          {help}
        </span>
      )}
    </div>
  );
}
