import { qk, setGoalPhoto, setGoalPreset, uploadPhoto } from '@sweetwo/api';
import { defaultGoalPreset, goalPreset } from '@sweetwo/core';
import { goalIcon, goalPhotoArt } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArtChoose } from '../../../shared/art-choose';
import { usePhotoUrls } from '../../../shared/photo';
import { toast } from '../../../shared/toast';
import { LoadingFrame } from '../../frame';
import { copy } from '../copy';
import { useGoalsModel } from '../model';

// 목표 사진 바꾸기(22 G-02 ‘목표 사진’): 2026-11-03 모든 목표, 고칠 수 있는 사람만(우리 목표 둘 다, 내 목표 주인만).
// 시안 A(2026-11-03): 큰 미리보기(16:10) → 칸(2026-11-05: [사진 올리기][내 사진(올린 사진이 있을 때)][기본 사진], 칸 아래 이름)
// → “저장하기” → G-02. ‘기본 사진’을 저장하면 올린 사진을 지우고 그 종류 지정 사진(직접 만든 목표는 회색 기본 자리)으로.
// G-02의 ‘사진 지우기’는 없앰. 올리기 칸 → 자르기 → “저장할게요”.
// 고르기 → 정사각형 자르기(ImageCrop) → 저장(정사각 512px JPEG). 올리기 규칙·문구는 프로필 사진(S-11e)과 같음 → G-02, “사진을 바꿨어요”.
// 우리 목표면 파트너 활동 “목표 사진을 바꿨어요”(서버, 주간 요약에만)
const MINE = 'mine';
const DEFAULT = 'default';

export function G02pGoalPhoto() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsModel();
  const [saving, setSaving] = useState(false);
  const path = d.ready ? (d.byId(id)?.goal.photo_path ?? null) : null;
  const urls = usePhotoUrls([path]);
  if (!d.ready) return <LoadingFrame current="goals" />;
  const i = d.byId(id);
  if (!i || !i.canEdit) return <Navigate to={`/goals/${id}`} replace />;
  const back = () => nav(`/goals/${id}`);
  const save = async (jpeg: Blob) => {
    if (saving) return;
    setSaving(true);
    try {
      await setGoalPhoto(i.goal.id, await uploadPhoto('g', jpeg));
      await qc.invalidateQueries({ queryKey: qk.goals });
      toast(copy.photoSaved);
      back();
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  // 기본 사진: 그 종류 지정 사진(직접 만든 목표는 지정 사진이 없어 올린 사진만 지움 → 회색 기본 자리)
  const base = defaultGoalPreset(i.goal.template);
  const pick = async (key: string) => {
    if (saving || key === MINE) return;
    setSaving(true);
    try {
      if (key === DEFAULT || !base) await setGoalPhoto(i.goal.id, null);
      else await setGoalPreset(i.goal.id, base);
      await qc.invalidateQueries({ queryKey: qk.goals });
      toast(copy.photoSaved);
      back();
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  const photoUrl = urls[i.goal.photo_path ?? ''];
  const items = [
    ...(i.goal.photo_path ? [{ key: MINE, src: photoUrl, name: copy.photoMine }] : []),
    { key: base ?? DEFAULT, src: base ? goalPhotoArt(base) : undefined, name: copy.photoDefault },
  ];
  const current = i.goal.photo_path ? MINE : (goalPreset(i.goal) ?? DEFAULT);
  return (
    <ArtChoose
      title={copy.photoTitle}
      onBack={back}
      presets={items}
      current={current}
      currentSrc={photoUrl}
      empty={i.custom ? 'flag-pennant' : goalIcon(i.goal.template)}
      saving={saving}
      labels={{
        list: copy.photoList,
        upload: copy.uploadTitle,
        submit: copy.photoSubmit,
        previewLabel: copy.photoPreviewNow,
        drop: copy.photoDrop,
        pick: copy.photoPick,
        help: copy.photoHelp,
        notice: d.solo ? copy.photoNoticeSolo : copy.photoNotice(d.partnerName),
        tooBig: copy.photoTooBig,
        badType: copy.photoBadType,
        stage: copy.photoStage,
        zoom: copy.photoZoom,
        preview: copy.photoPreview,
        again: copy.photoAgain,
        save: copy.photoSave,
      }}
      onPreset={(k) => void pick(k)}
      onPhoto={(b) => void save(b)}
    />
  );
}
