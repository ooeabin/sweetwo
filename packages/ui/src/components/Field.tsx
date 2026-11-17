import {
  forwardRef,
  useId,
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

// 여러 줄 글자 칸(Input.md ‘여러 줄’, 2026-11-17): hg-input + hg-textarea, 위아래로만 늘림
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  help?: ReactNode;
}

export function Textarea({ label, help, className, id, ...rest }: TextareaProps) {
  const autoId = useId();
  const tid = id ?? autoId;
  return (
    <div className="hg-field">
      <label className="hg-field__label" htmlFor={tid}>
        {label}
      </label>
      <textarea
        id={tid}
        className={cx('hg-input hg-textarea', className)}
        aria-describedby={help ? `${tid}-help` : undefined}
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
