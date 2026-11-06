import { qk, uploadAvatar } from '@sweetwo/api';
import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { PhotoPick } from '../../../shared/photo-pick';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11e 프로필 사진(25 S-11e, 디자인 ImageCrop): 올리기(고르기·끌어 놓기 + “올린 사진은 예빈님과 나만 볼 수 있어요”) → 자르기(정사각 틀, 확대,
// 원형 미리보기) → “저장할게요”: 정사각 512px JPEG로 다시 그려(EXIF 위치 정보 없음) 저장 → S-11, “사진을 바꿨어요”.
// 고르기·자르기는 목표 사진(22 G-02)과 같은 shared/photo-pick. 설정 하위 화면과 같은 QuestionLayout.
// 2026-11-05 지정 아바타 고르기 격자 없앰(사진이 없으면 이름 첫 글자, 소셜 계정 사진은 처음 한 번 shared/person useSocialAvatar)
export function S11ePhoto() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [saving, setSaving] = useState(false);
  // S-11에서 Avatar에 끌어 놓은 사진이면 바로 받음
  const dropped = (useLocation().state as { file?: unknown } | null)?.file;
  const back = () => nav('/settings/me');
  if (d.loading || !d.me || !d.c) return <QuestionSkeleton title={copy.photo} onBack={back} />;
  const me = d.me;
  const save = async (jpeg: Blob) => {
    if (saving || !me.space_id) return;
    setSaving(true);
    try {
      await uploadAvatar(me.space_id, me.id, jpeg);
      await qc.invalidateQueries({ queryKey: qk.avatars });
      track('profile_photo_changed', { action: 'set' });
      toast(copy.photoSaved);
      back();
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <QuestionLayout title={copy.photo} onBack={back}>
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
    </QuestionLayout>
  );
}
