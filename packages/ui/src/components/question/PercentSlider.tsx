import { useRef } from 'react';

// 퍼센트 슬라이더(디자인 Slider). 5% 단위, ←/→ 5%, Shift와 함께 10%.
export function PercentSlider({
  label,
  value,
  onChange,
  left,
  right,
  step = 5,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  left: string;
  right?: string;
  step?: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v / step) * step));
  const fromPointer = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    onChange(clamp(((clientX - r.left) / r.width) * 100));
  };
  return (
    <div className="hg-slider">
      <div className="hg-slider__labels">
        <span>{left}</span>
        {right && <span>{right}</span>}
      </div>
      <div
        ref={track}
        className="hg-slider__track"
        style={{ cursor: 'pointer', touchAction: 'none', margin: 'var(--space-3) 0' }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons) fromPointer(e.clientX);
        }}
      >
        <span className="hg-slider__fill" style={{ width: `${value}%` }} />
        <span
          className="hg-slider__thumb"
          style={{ left: `${value}%` }}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={`${value}%`}
          onKeyDown={(e) => {
            const d = e.shiftKey ? 10 : step;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(clamp(value + d));
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(clamp(value - d));
            else return;
            e.preventDefault();
          }}
        />
      </div>
      <div className="hg-slider__marks">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
