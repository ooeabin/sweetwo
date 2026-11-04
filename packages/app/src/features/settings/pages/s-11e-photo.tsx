import { fetchAvatars, qk, setAvatarPreset, uploadAvatar } from '@sweetwo/api';
import { avatarPresets } from '@sweetwo/core';
import { avatarArt } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArtChoose } from '../../../shared/art-choose';
import { toast } from '../../../shared/toast';
import { LoadingFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11e 프로필 사진(25 S-11e, 디자인 ImageCrop): 올리기(고르기·끌어 놓기 + “올린 사진은 예빈님과 나만 볼 수 있어요”) → 자르기(정사각 틀, 확대,
// 원형 미리보기) → “저장할게요”: 정사각 512px JPEG로 다시 그려(EXIF 위치 정보 없음) 저장 → S-11, “사진을 바꿨어요”.
// 고르기·자르기는 목표 사진(22 G-02)과 같은 shared/photo-pick.
// 2026-11-03(시안 A): 큰 미리보기 → 격자(맨 앞 ‘내 사진 올리기’ 칸 + 지정 아바타 7개) → 고지 → “저장하기”(지정 아바타 저장, 올린 사진은 지움).
// 올리기 칸 → 자르기 → “저장할게요”. 그림 파일이 없으면 회색 빈 자리
export function S11ePhoto() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [saving, setSaving] = useState(false);
  const avatars = useQuery({ queryKey: qk.avatars, queryFn: fetchAvatars });
  // S-11에서 Avatar에 끌어 놓은 사진이면 바로 받음
  const dropped = (useLocation().state as { file?: unknown } | null)?.file;
  if (d.loading || !d.me || !d.c) return <LoadingFrame sub="settings" current={null} />;
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
  const pickPreset = async (preset: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await setAvatarPreset(me.space_id, me.id, preset);
      await qc.invalidateQueries({ queryKey: qk.avatars });
      toast(copy.photoSaved);
      back();
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  // 올린 사진이 있으면 고른 지정 아바타 없음
  const current = avatars.data?.photos[me.id] ? null : (avatars.data?.presets[me.id] ?? null);
  const photoUrl = avatars.data?.photos[me.id];
  return (
    <ArtChoose
      title={copy.photo}
      onBack={back}
      round
      presets={avatarPresets.map((key) => ({ key, src: avatarArt(key) }))}
      current={current}
      currentSrc={photoUrl}
      empty="user"
      initial={dropped}
      saving={saving}
      labels={{
        list: copy.presetTitle,
        item: copy.presetItem,
        upload: copy.uploadTitle,
        submit: copy.photoSubmit,
        previewLabel: copy.photoPreviewNow,
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
      onPreset={(k) => void pickPreset(k)}
      onPhoto={(b) => void save(b)}
    />
  );
}
