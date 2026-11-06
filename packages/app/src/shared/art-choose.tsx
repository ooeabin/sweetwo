import { ArtPick, Icon, ImageCrop, QuestionLayout, type IconName } from '@sweetwo/ui';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { checkPhoto } from './photo';
import type { PhotoPickLabels } from './photo-pick';

const ACCEPT =
  '.jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp';

/**
 * 목표 사진 고르기 + 사진 올리기(2026-11-03 G-02p 둥근 네모. 2026-11-05 프로필 S-11e는 올리기만이라 안 씀).
 * 칸: [사진 올리기][내 사진(올린 사진이 있을 때)][기본 사진], 칸 아래 이름. 기본 사진을 고르고 저장하면 올린 사진을 지움.
 * 설정 하위 화면과 같은 QuestionLayout: 제목 → 큰 미리보기 → 격자(맨 앞 ‘내 사진 올리기’ 칸, 그다음 지정 그림)
 * → 아래 고정 영역에 고지(가운데 한 줄) + 주 버튼 “저장하기”(좁은 창 꽉 차게 하단 고정, 넓은 창 오른쪽 끝).
 * 올리기 칸에서 사진을 고르거나 끌어 놓으면 자르기(ImageCrop) → “저장할게요”.
 */
export function ArtChoose({
  title,
  onBack,
  round = false,
  presets,
  current,
  currentSrc,
  empty,
  initial,
  saving,
  labels,
  onPreset,
  onPhoto,
}: {
  title: string;
  onBack: () => void;
  round?: boolean;
  presets: { key: string; src?: string; name?: string }[];
  /** 지금 고른 지정 그림(올린 사진을 쓰는 중이면 null) */
  current: string | null;
  /** 지금 올린 사진 주소(미리보기) */
  currentSrc?: string;
  empty: IconName;
  /** 다른 화면에서 끌어 놓은 파일 */
  initial?: unknown;
  saving: boolean;
  labels: PhotoPickLabels & {
    list: string;
    item?: (n: number) => string;
    upload: string;
    submit: string;
    previewLabel: string;
  };
  onPreset: (key: string) => void;
  onPhoto: (jpeg: Blob) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState<string | null>(current);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSel(current), [current]);
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
  if (src)
    return (
      <QuestionLayout title={title} onBack={() => setSrc(null)}>
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
          onSave={onPhoto}
        />
      </QuestionLayout>
    );
  const shown = sel ? presets.find((p) => p.key === sel)?.src : currentSrc;
  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    take(e.dataTransfer.files[0]);
  };
  return (
    <QuestionLayout
      title={title}
      onBack={onBack}
      note={labels.notice}
      primary={{ label: labels.submit, disabled: !sel || sel === current, loading: saving }}
      onSubmit={() => {
        if (sel && sel !== current && !saving) onPreset(sel);
      }}
    >
      <div className="hg-stack hg-artchoose" style={{ gap: 'var(--space-6)' }}>
        <div
          className={round ? 'hg-artprev hg-artprev--round' : 'hg-artprev'}
          role="img"
          aria-label={labels.previewLabel}
        >
          {shown ? <img src={shown} alt="" /> : <Icon name={empty} />}
        </div>
        <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
          <ArtPick
            round={round}
            items={presets}
            value={sel}
            onPick={setSel}
            empty={empty}
            label={labels.list}
            itemLabel={labels.item}
            disabled={saving}
            lead={
              <>
                <button
                  type="button"
                  className="hg-artpick__item hg-artpick__upload"
                  aria-label={labels.upload}
                  disabled={saving}
                  onClick={() => input.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                >
                  <Icon name="camera" size={24} />
                </button>
                <span className="hg-artpick__name" aria-hidden="true">
                  {labels.upload}
                </span>
              </>
            }
          />
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            hidden
            aria-label={labels.pick}
            onChange={(e) => take(e.target.files?.[0])}
          />
          {error && (
            <p className="hg-help is-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </QuestionLayout>
  );
}
