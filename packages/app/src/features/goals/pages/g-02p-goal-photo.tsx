import { qk, setGoalPhoto, setGoalPreset, uploadPhoto } from '@sweetwo/api';
import { goalPhotoChoices, goalPreset } from '@sweetwo/core';
import { ArtPick, PageHeader, SectionHeader, goalIcon, goalPhotoArt } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PhotoPick } from '../../../shared/photo-pick';
import { toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useGoalsModel } from '../model';

// 목표 사진 바꾸기(22 G-02 ‘목표 사진’): 2026-11-03 모든 목표, 고칠 수 있는 사람만(우리 목표 둘 다, 내 목표 주인만).
// 위에 지정 사진 고르기(ArtPick, 그 종류 사진. 직접 만든 목표는 기본 1장 + 다른 종류 사진), 누르면 바로 저장 → G-02.
// 고르기 → 정사각형 자르기(ImageCrop) → 저장(정사각 512px JPEG). 올리기 규칙·문구는 프로필 사진(S-11e)과 같음 → G-02, “사진을 바꿨어요”.
// 우리 목표면 배우자 활동 “목표 사진을 바꿨어요”(서버, 주간 요약에만)
export function G02pGoalPhoto() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsModel();
  const [saving, setSaving] = useState(false);
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
  const pick = async (preset: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await setGoalPreset(i.goal.id, preset);
      await qc.invalidateQueries({ queryKey: qk.goals });
      toast(copy.photoSaved);
      back();
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  // 올린 사진이 있으면 고른 지정 사진 없음
  const current = i.goal.photo_path ? null : goalPreset(i.goal);
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.photoTitle}
        backLabel={copy.back}
        backTo={i.goal.name}
        onBack={back}
      />
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.presetTitle} />
        <ArtPick
          items={goalPhotoChoices(i.goal.template).map((key) => ({ key, src: goalPhotoArt(key) }))}
          value={current}
          onPick={(k) => void pick(k)}
          empty={i.custom ? 'flag-pennant' : goalIcon(i.goal.template)}
          label={copy.presetTitle}
          itemLabel={(n) => copy.presetItem(n + 1)}
          disabled={saving}
        />
      </section>
      <SectionHeader title={copy.uploadTitle} />
      <PhotoPick
        labels={{
          drop: window.matchMedia?.('(min-width: 768px)').matches
            ? copy.photoDrop
            : copy.photoDropNarrow,
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
        onSave={(b) => void save(b)}
      />
    </div>
  );
  return (
    <MainFrame sub="detail" current="goals" page={{ title: copy.photoTitle }} columns={[body]} />
  );
}
