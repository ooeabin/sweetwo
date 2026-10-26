import { qk, setGoalPhoto, uploadPhoto } from '@sweetwo/api';
import { PageHeader } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PhotoPick } from '../../../shared/photo-pick';
import { toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useGoalsModel } from '../model';

// 목표 사진 바꾸기(22 G-02 ‘목표 사진’): 직접 만든 목표만, 고칠 수 있는 사람만(우리 목표 둘 다, 내 목표 주인만).
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
  if (!i || !i.custom || !i.canEdit) return <Navigate to={`/goals/${id}`} replace />;
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
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.photoTitle}
        backLabel={copy.back}
        backTo={i.goal.name}
        onBack={back}
      />
      <PhotoPick
        labels={{
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
        onSave={(b) => void save(b)}
      />
    </div>
  );
  return <MainFrame current="goals" page={{ title: copy.photoTitle }} columns={[body]} />;
}
