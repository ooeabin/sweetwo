import { Button, Icon, ImageCrop } from '@sweetwo/ui';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { checkPhoto } from './photo';

// 사진 하나 고르기 → 정사각 자르기(디자인 ImageCrop). 프로필 사진(S-11e)과 목표 사진(22 G-02)이 같이 씀.
// 올리기 칸(고르기·끌어 놓기 + 고지 한 줄) → 자르기(정사각 틀, 확대, 미리보기) → 저장: 정사각 512px JPEG(EXIF 위치 정보 없음)
export interface PhotoPickLabels {
  drop: string;
  pick: string;
  help: string;
  notice: string;
  tooBig: string;
  badType: string;
  stage: string;
  zoom: string;
  preview: string;
  again: string;
  save: string;
}

export function PhotoPick({
  labels,
  initial,
  onSave,
}: {
  labels: PhotoPickLabels;
  /** 다른 화면에서 끌어 놓은 파일 */
  initial?: unknown;
  onSave: (jpeg: Blob) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);
  const take = (f: File | undefined) => {
    if (!f) return;
    const e = checkPhoto(f);
    setError(e === 'type' ? labels.badType : e === 'size' ? labels.tooBig : null);
    if (!e) setSrc(URL.createObjectURL(f));
  };
  useEffect(() => {
    if (initial instanceof File) take(initial);
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files[0]);
  };
  if (src)
    return (
      <ImageCrop
        src={src}
        labels={{
          stage: labels.stage,
          zoom: labels.zoom,
          preview: labels.preview,
          cancel: labels.again,
          save: labels.save,
        }}
        onCancel={() => setSrc(null)}
        onSave={onSave}
      />
    );
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
      <div
        className={['hg-drop', over && 'is-over', error && 'is-error'].filter(Boolean).join(' ')}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Icon name="image" />
        <p className="hg-drop__title">{labels.drop}</p>
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
          {labels.pick}
        </Button>
        <p className="hg-drop__help">{labels.help}</p>
        <input
          ref={input}
          type="file"
          accept=".jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp"
          hidden
          aria-label={labels.pick}
          onChange={(e) => take(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p className="hg-help is-error" role="alert">
          {error}
        </p>
      )}
      <p className="hg-help">{labels.notice}</p>
    </div>
  );
}
