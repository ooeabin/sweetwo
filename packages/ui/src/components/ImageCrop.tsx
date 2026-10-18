import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

// ImageCrop(docs/design/components/ImageCrop.md): 정사각 무대 위 고정 틀, 사진을 끌어 옮기고 키움(1~3배, 처음은 틀을 꽉 채움).
// 틀 밖이 비지 않게 막음. 키보드: 무대에서 ←↑→↓ 8px, +/− 확대. 미리보기 원 72px·32px. 저장은 정사각 size px JPEG(다시 그려 EXIF 없음).
const STEP = 8;
const MAX = 3;

export function ImageCrop({
  src,
  labels,
  size = 512,
  onCancel,
  onSave,
}: {
  /** 사진 주소(object URL) */
  src: string;
  labels: { stage: string; zoom: string; preview: string; cancel: string; save: string };
  size?: number;
  onCancel: () => void;
  onSave: (jpeg: Blob) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState({ stage: 0, frame: 0, inset: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1); // 1 = 틀을 꽉 채우는 배율
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const s = stage.current?.getBoundingClientRect().width ?? 0;
      const f = frame.current?.getBoundingClientRect().width ?? 0;
      setBox({ stage: s, frame: f, inset: (s - f) / 2 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 틀을 꽉 채우는 이미지 폭(무대 기준 px)
  const coverW = nat.w && nat.h && box.frame ? Math.max(box.frame, (box.frame * nat.w) / nat.h) : 0;
  const w = coverW * zoom;
  const h = nat.w ? (w * nat.h) / nat.w : 0;
  const clamp = (p: { x: number; y: number }) => {
    const mx = Math.max((w - box.frame) / 2, 0);
    const my = Math.max((h - box.frame) / 2, 0);
    return { x: Math.min(Math.max(p.x, -mx), mx), y: Math.min(Math.max(p.y, -my), my) };
  };
  const p = clamp(pos);

  // 틀 안 영역을 정사각 캔버스로
  const render = (out: number) => {
    const el = img.current;
    if (!el || !w || !box.frame) return null;
    const c = document.createElement('canvas');
    c.width = out;
    c.height = out;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const left = box.stage / 2 - w / 2 + p.x;
    const top = box.stage / 2 - h / 2 + p.y;
    const k = nat.w / w;
    ctx.drawImage(
      el,
      (box.inset - left) * k,
      (box.inset - top) * k,
      box.frame * k,
      box.frame * k,
      0,
      0,
      out,
      out,
    );
    return c;
  };
  useEffect(() => {
    const c = render(144);
    if (c) setPreview(c.toDataURL('image/jpeg', 0.8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, p.x, p.y, box.frame]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) setPos({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (k === 'ArrowLeft') setPos({ ...p, x: p.x - STEP });
    else if (k === 'ArrowRight') setPos({ ...p, x: p.x + STEP });
    else if (k === 'ArrowUp') setPos({ ...p, y: p.y - STEP });
    else if (k === 'ArrowDown') setPos({ ...p, y: p.y + STEP });
    else if (k === '+' || k === '=') setZoom((z) => Math.min(z + 0.1, MAX));
    else if (k === '-') setZoom((z) => Math.max(z - 0.1, 1));
    else return;
    e.preventDefault();
  };
  const pct = ((zoom - 1) / (MAX - 1)) * 100;
  const zoomAt = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    setZoom(1 + t * (MAX - 1));
  };

  return (
    <div className="hg-crop">
      <div
        ref={stage}
        className="hg-crop__stage"
        tabIndex={0}
        role="group"
        aria-label={labels.stage}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onKeyDown={onKey}
        style={
          {
            '--zoom': box.stage ? w / box.stage : 1,
            '--x': `${p.x}px`,
            '--y': `${p.y}px`,
          } as CSSProperties
        }
      >
        <img
          ref={img}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) =>
            setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
        />
        <div ref={frame} className="hg-crop__frame" aria-hidden="true" />
      </div>
      <div className="hg-crop__zoom">
        <Icon name="minus" />
        <div
          className="hg-slider__track"
          role="slider"
          tabIndex={0}
          aria-label={labels.zoom}
          aria-valuemin={100}
          aria-valuemax={MAX * 100}
          aria-valuenow={Math.round(zoom * 100)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            zoomAt(e.clientX, e.currentTarget);
          }}
          onPointerMove={(e) => e.buttons && zoomAt(e.clientX, e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp')
              setZoom((z) => Math.min(z + 0.1, MAX));
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
              setZoom((z) => Math.max(z - 0.1, 1));
            else return;
            e.preventDefault();
          }}
        >
          <span className="hg-slider__fill" style={{ width: `${pct}%` }} />
          <span className="hg-slider__thumb" style={{ left: `${pct}%` }} />
        </div>
        <Icon name="plus" />
      </div>
      <div className="hg-crop__preview">
        {preview && (
          <>
            <span className="hg-avatar hg-avatar--xl hg-avatar--photo">
              <img src={preview} alt={labels.preview} />
            </span>
            <span className="hg-avatar hg-avatar--photo">
              <img src={preview} alt="" />
            </span>
          </>
        )}
      </div>
      <div className="hg-crop__actions">
        <Button variant="secondary" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            const c = render(size);
            c?.toBlob((b) => b && onSave(b), 'image/jpeg', 0.9);
          }}
        >
          {labels.save}
        </Button>
      </div>
    </div>
  );
}
