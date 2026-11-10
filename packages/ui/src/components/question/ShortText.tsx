import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../cx';
import { IconButton } from '../IconButton';

// Q5 짧은 텍스트(docs/spec/12-question-pattern.md Q5). 앞뒤 공백, 연속 공백, 줄바꿈은 정리. 한도에서 입력 멈춤.
export const normalizeShortText = (s: string) =>
  s.replace(/[\t\r\n]+/g, ' ').replace(/ {2,}/g, ' ');

/**
 * 보이는 글자 단위로 나눔(2026-11-10 QA 2구간 S2-19: 커플 이모지 👩‍❤️‍👨 하나 = 1자). Intl.Segmenter가 없으면 코드 포인트
 */
export function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Seg) return [...s];
  return [...new Seg('ko', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
}

/** 보이는 글자 max자 + 코드 포인트 codeMax 안으로 자름(서버 한도는 코드 포인트) */
function clip(v: string[], max: number, codeMax: number) {
  const out = v.slice(0, max);
  while (out.length && [...out.join('')].length > codeMax) out.pop();
  return out;
}

export function ShortText({
  label,
  value,
  onChange,
  max,
  codeMax = max,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** 보이는 글자 수 한도(글자 수 표시도 이 단위) */
  max: number;
  /** 서버 한도(코드 포인트, char_length). 기본은 max와 같음. O-03 이름은 40(2026-11-10) */
  codeMax?: number;
  placeholder?: string;
  error?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string>();
  useEffect(() => ref.current?.focus(), []);
  const chars = graphemes(value);
  return (
    <div className="hg-field">
      <label htmlFor={id} className="hg-sr">
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          id={id}
          className={cx('hg-input', error && 'is-error')}
          style={{ paddingRight: 'var(--space-14)' }}
          placeholder={placeholder}
          value={value}
          aria-invalid={!!error || undefined}
          aria-describedby={`${id}-count`}
          onChange={(e) => {
            const v = graphemes(normalizeShortText(e.target.value));
            const kept = clip(v, max, codeMax);
            if (kept.length < v.length) setNotice(`${max}자까지만 넣었어요`);
            else setNotice(undefined);
            onChange(kept.join(''));
          }}
        />
        {value && (
          <span
            style={{
              position: 'absolute',
              right: 'var(--space-1)',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <IconButton icon="x" label="지우기" ghost small onClick={() => onChange('')} />
          </span>
        )}
      </div>
      <span id={`${id}-count`} className={error ? 'hg-help is-error' : 'hg-help'}>
        {/* 글자 수는 한도에 가까워질 때만(80%부터, 2026-11-02 배민·당근처럼 평소엔 숨김) */}
        {error ?? notice ?? (chars.length >= Math.ceil(max * 0.8) ? `${chars.length}/${max}` : '')}
      </span>
    </div>
  );
}
