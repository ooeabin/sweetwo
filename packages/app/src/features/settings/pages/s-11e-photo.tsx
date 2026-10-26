import { qk, uploadAvatar } from '@sweetwo/api';
import { PageHeader } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PhotoPick } from '../../../shared/photo-pick';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11e 프로필 사진(25 S-11e, 디자인 ImageCrop): 올리기(고르기·끌어 놓기 + “올린 사진은 예빈님과 나만 볼 수 있어요”) → 자르기(정사각 틀, 확대,
// 원형 미리보기) → “저장할게요”: 정사각 512px JPEG로 다시 그려(EXIF 위치 정보 없음) 저장 → S-11, “사진을 바꿨어요”.
// 고르기·자르기는 목표 사진(22 G-02)과 같은 shared/photo-pick.
export function S11ePhoto() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [saving, setSaving] = useState(false);
  // S-11에서 Avatar에 끌어 놓은 사진이면 바로 받음
  const dropped = (useLocation().state as { file?: unknown } | null)?.file;
  if (d.loading || !d.me || !d.c) return <MainFrame current={null} columns={[null]} />;
  const me = d.me;
  const back = () => nav('/settings/me');
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
      <PhotoPick
        initial={dropped}
        labels={{
          drop: copy.photoDrop,
          pick: copy.photoPick,
          help: copy.photoHelp,
          notice:
            d.c.joined || d.space?.couple_state === 'not_joined'
              ? copy.photoNotice(d.c.partnerName)
              : copy.photoNoticeSolo,
          tooBig: copy.photoTooBig,
          badType: copy.photoBadType,
          stage: copy.photoStage,
          zoom: copy.photoZoom,
          preview: copy.photoPreview,
          again: copy.photoAgain,
          save: copy.photoSave,
        }}
        onSave={(b) => void save(b)}
      />
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.photo }} columns={[body]} />;
}
