import { qk, uploadAvatar } from '@sweetwo/api';
import { Button, Icon, ImageCrop, PageHeader } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

const TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
const MAX = 10 * 1024 * 1024;

/** 고른 파일 검사(S-11e 예외): 10MB 초과, 지원하지 않는 형식 */
export function photoError(f: Pick<File, 'type' | 'size' | 'name'>): string | null {
  const heic = /\.(heic|heif)$/i.test(f.name);
  if (!TYPES.includes(f.type) && !heic) return copy.photoBadType;
  if (f.size > MAX) return copy.photoTooBig;
  return null;
}

// S-11e 프로필 사진(25 S-11e, 디자인 ImageCrop): 올리기(고르기·끌어 놓기 + “올린 사진은 예빈님과 나만 볼 수 있어요”) → 자르기(정사각 틀, 확대,
// 원형 미리보기) → “저장할게요”: 정사각 512px JPEG로 다시 그려(EXIF 위치 정보 없음) 저장 → S-11, “사진을 바꿨어요”.
export function S11ePhoto() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);
  if (d.loading || !d.me || !d.c) return <MainFrame current={null} columns={[null]} />;
  const me = d.me;
  const back = () => nav('/settings/me');
  const take = (f: File | undefined) => {
    if (!f) return;
    const e = photoError(f);
    setError(e);
    if (!e) setSrc(URL.createObjectURL(f));
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files[0]);
  };
  const save = async (jpeg: Blob) => {
    if (saving || !me.space_id) return;
    setSaving(true);
    try {
      await uploadAvatar(me.space_id, me.id, jpeg);
      await qc.invalidateQueries({ queryKey: qk.avatars });
      toast(copy.photoSaved);
      back();
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.photo} backLabel={copy.back} backTo={copy.me} onBack={back} />
      {src ? (
        <ImageCrop
          src={src}
          labels={{
            stage: copy.photoStage,
            zoom: copy.photoZoom,
            preview: copy.photoPreview,
            cancel: copy.photoAgain,
            save: copy.photoSave,
          }}
          onCancel={() => setSrc(null)}
          onSave={(b) => void save(b)}
        />
      ) : (
        <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
          <div
            className={['hg-drop', over && 'is-over', error && 'is-error']
              .filter(Boolean)
              .join(' ')}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <Icon name="image" />
            <p className="hg-drop__title">{copy.photoDrop}</p>
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
              {copy.photoPick}
            </Button>
            <p className="hg-drop__help">{copy.photoHelp}</p>
            <input
              ref={input}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp"
              hidden
              aria-label={copy.photoPick}
              onChange={(e) => take(e.target.files?.[0])}
            />
          </div>
          {error && (
            <p className="hg-help is-error" role="alert">
              {error}
            </p>
          )}
          <p className="hg-help">
            {d.c.joined || d.space?.couple_state === 'not_joined'
              ? copy.photoNotice(d.c.partnerName)
              : copy.photoNoticeSolo}
          </p>
        </div>
      )}
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.photo }} columns={[body]} />;
}
