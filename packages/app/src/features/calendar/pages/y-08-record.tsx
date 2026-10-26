import {
  addCarePhoto,
  agreePhotoConsent,
  fetchPhotoConsent,
  qk,
  recordCare,
  uploadPhoto,
} from '@sweetwo/api';
import { formatMonthDay, giftRepeated, quickChips, TERMS_VERSION } from '@sweetwo/core';
import {
  AmountInput,
  Button,
  Chip,
  ChoiceCards,
  ConsentCard,
  FileAttach,
  QuestionLayout,
  ShortText,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { create } from 'zustand';
import { checkPhoto, shrinkPhoto } from '../../../shared/photo';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useCalendarData } from '../data';

// Y-08 다녀온 뒤 기록(24 Y-08, 재기획): a 쓴 돈(금액 메모 채움, 건너뛰기) + 목표 돈을 썼다면 ‘목표 고르기’
// → b 무엇을 드렸어요(현금 / 선물 / 식사, 같은 챙길 날에 2년 안 같은 선물이면 “작년에도 드렸어요”) → c 기억(메모) → 저장.
// → c 기억(메모 + 사진, JPG·PNG·HEIC·WebP, 장당 10MB 이하, 10장까지, 긴 변 1600px로 줄여 저장. 처음 사진을 넣을 때 사진 동의) → 저장.
// 기록만, 목표·분배표·자산 변화 없음. 낸 곳은 묻지 않음. 목표를 골랐으면 저장 뒤 그 목표 G-02b(금액 채움)로.
// 저장 = 기록 → 사진 하나씩 올려 붙임. 사진이 실패하면 기록은 그대로 두고 그 사진만 ‘다시 시도’.

type Gift = 'cash' | 'gift' | 'meal';
interface Photo {
  key: string;
  file: File;
  url: string;
  state: 'wait' | 'up' | 'done' | 'error';
}
interface Draft {
  key: string; // 챙길 날 + 회차
  amount: number | null;
  goalId: string | null;
  gifts: Gift[];
  giftName: string;
  memo: string;
  photos: Photo[];
  /** 저장한 기록(사진만 남았을 때 다시 저장하지 않게) */
  recordId: string | null;
}
const MAX_PHOTOS = 10;
const blank = (key: string, amount: number | null): Draft => ({
  key,
  amount,
  goalId: null,
  gifts: [],
  giftName: '',
  memo: '',
  photos: [],
  recordId: null,
});
const useDraft = create<{ d: Draft; set: (p: Partial<Draft>) => void }>((set, get) => ({
  d: blank('', null),
  set: (p) => set({ d: { ...get().d, ...p } }),
}));
const STEPS = ['a', 'b', 'c'];

export function Y08Record() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '', step = 'a' } = useParams();
  const [params] = useSearchParams();
  const c = useCalendarData();
  const { d, set } = useDraft();
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pending, setPending] = useState<File[] | null>(null);
  const [agreeing, setAgreeing] = useState(false);
  const consent = useQuery({ queryKey: qk.photoConsent, queryFn: fetchPhotoConsent });
  const care = c.cares.find((x) => x.id === id);
  const on = params.get('on') ?? (care ? c.recordOn(care) : null);
  const key = `${id}:${on ?? ''}`;
  // 다른 날을 열면 새로(금액 메모 채움)
  useEffect(() => {
    if (care && d.key !== key) set(blank(key, care.budget || null));
  }, [care, d.key, key, set]);

  if (c.loading) return null;
  if (!care || !on) return <Navigate to="/calendar/list" replace />;
  if (d.key !== key) return null;

  const i = Math.max(STEPS.indexOf(step), 0);
  const progress = { total: STEPS.length, now: i };
  const base = `/calendar/day/${care.id}/record`;
  const q = params.get('on') ? `?on=${on}` : '';
  const go = (n: number) => nav(`${base}/${STEPS[n] ?? 'a'}${q}`);
  const back = () => (i > 0 ? go(i - 1) : nav(-1));
  const help = `${care.name}, ${formatMonthDay(on)}`;
  const goal = c.goals.find((g) => g.id === d.goalId);

  const setPhoto = (k: string, state: Photo['state']) =>
    set({ photos: useDraft.getState().d.photos.map((p) => (p.key === k ? { ...p, state } : p)) });
  const save = async (o: Partial<Draft> = {}) => {
    if (o.photos) set({ photos: o.photos });
    const x = { ...useDraft.getState().d, ...o };
    if (saving) return;
    setSaving(true);
    try {
      let recordId = x.recordId;
      if (!recordId) {
        recordId = (
          await recordCare({
            careId: care.id,
            on,
            amount: x.amount ?? 0,
            paidFrom: 'personal',
            gifts: x.gifts,
            giftName: x.gifts.includes('gift') ? x.giftName.trim() || null : null,
            memo: x.memo.trim() || null,
            move: 0,
          })
        ).record;
        set({ recordId });
        await Promise.all(
          [qk.careDays, qk.careRecords].map((k) => qc.invalidateQueries({ queryKey: k })),
        );
      }
      // 사진: 하나씩 줄여 올리고 붙임. 실패한 것만 남김
      let failed = false;
      for (const p of x.photos.filter((y) => y.state !== 'done')) {
        setPhoto(p.key, 'up');
        try {
          await addCarePhoto(recordId, await uploadPhoto('r', await shrinkPhoto(p.file, 1600)));
          setPhoto(p.key, 'done');
        } catch {
          setPhoto(p.key, 'error');
          failed = true;
        }
      }
      if (x.photos.length) await qc.invalidateQueries({ queryKey: qk.carePhotos });
      if (failed) return;
      x.photos.forEach((p) => URL.revokeObjectURL(p.url));
      set(blank('', null));
      toast(copy.recorded);
      if (x.goalId && x.amount)
        nav(`/goals/${x.goalId}/spend?amount=${x.amount}`, { replace: true });
      else nav(`/calendar/day/${care.id}`, { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  /** 고른 사진 넣기: 형식·크기·10장 검사 */
  const addFiles = (files: File[]) => {
    const cur = useDraft.getState().d.photos;
    const bad = files.map(checkPhoto).find(Boolean);
    const ok = files.filter((f) => !checkPhoto(f));
    const room = MAX_PHOTOS - cur.length;
    setPhotoError(
      bad === 'type'
        ? copy.photoBadType
        : bad === 'size'
          ? copy.photoTooBig
          : ok.length > room
            ? copy.photoTooMany
            : null,
    );
    const take = ok.slice(0, Math.max(room, 0));
    if (!take.length) return;
    set({
      photos: [
        ...cur,
        ...take.map((file) => ({
          key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          url: URL.createObjectURL(file),
          state: 'wait' as const,
        })),
      ],
    });
  };
  const pickFiles = (files: File[]) => {
    // 처음 사진을 넣을 때 사진(챙길 날) 동의
    if (!consent.data) setPending(files);
    else addFiles(files);
  };
  const agree = async () => {
    if (!c.me || !pending) return;
    setAgreeing(true);
    try {
      await agreePhotoConsent(c.me.id, TERMS_VERSION);
      qc.setQueryData(qk.photoConsent, true);
      addFiles(pending);
      setPending(null);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setAgreeing(false);
    }
  };
  const removePhoto = (k: string) => {
    const p = d.photos.find((y) => y.key === k);
    if (p) URL.revokeObjectURL(p.url);
    setPhotoError(null);
    set({ photos: d.photos.filter((y) => y.key !== k) });
  };

  if (step === 'a')
    return (
      <QuestionLayout
        steps={progress}
        title={copy.spentQ}
        help={help}
        onBack={back}
        later={{
          label: copy.skip,
          onClick: () => {
            set({ amount: null, goalId: null });
            go(1);
          },
        }}
        primary={{ label: copy.nextStep, disabled: d.amount === null }}
        onSubmit={() => d.amount !== null && go(1)}
      >
        <AmountInput
          label={copy.spentQ}
          value={d.amount}
          onChange={(amount) => set({ amount })}
          quick={quickChips.small}
          allowZero
        />
        {c.goals.length > 0 && (
          <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            <p className="hg-help" style={{ margin: 0 }}>
              {copy.goalHelp}
            </p>
            {picking ? (
              <ChoiceCards<string>
                label={copy.pickGoalQ}
                value={d.goalId}
                onChange={(goalId) => set({ goalId })}
                onPick={() => setPicking(false)}
                options={c.goals.map((g) => ({ value: g.id, label: g.name }))}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setPicking(true)}
              >
                {goal ? goal.name : copy.pickGoal}
              </Button>
            )}
          </div>
        )}
      </QuestionLayout>
    );

  if (step === 'b') {
    const name = d.giftName.trim();
    // 같은 챙길 날에 2년 안 같은 선물
    const again = giftRepeated(c.records, {
      care_day_id: care.id,
      gift_name: name,
      occurs_on: on,
    });
    const toggle = (g: Gift) =>
      set({ gifts: d.gifts.includes(g) ? d.gifts.filter((x) => x !== g) : [...d.gifts, g] });
    return (
      <QuestionLayout
        steps={progress}
        title={copy.giftQ}
        help={help}
        onBack={back}
        later={{
          label: copy.skip,
          onClick: () => {
            set({ gifts: [], giftName: '' });
            go(2);
          },
        }}
        primary={{ label: copy.nextStep }}
        onSubmit={() => go(2)}
      >
        <div
          className="hg-row"
          role="group"
          aria-label={copy.giftQ}
          style={{ gap: 'var(--space-2)' }}
        >
          {(['cash', 'gift', 'meal'] as const).map((g) => (
            <Chip key={g} selected={d.gifts.includes(g)} onClick={() => toggle(g)}>
              {copy.gifts[g]}
            </Chip>
          ))}
        </div>
        {d.gifts.includes('gift') && (
          <ShortText
            label={copy.giftName}
            value={d.giftName}
            onChange={(giftName) => set({ giftName })}
            max={30}
          />
        )}
        {again && (
          <p className="hg-help" role="status">
            {copy.giftAgain}
          </p>
        )}
      </QuestionLayout>
    );
  }

  const partner = c.couple?.joined || c.space?.couple_state === 'not_joined';
  const notice = partner ? copy.photoNotice(c.couple?.partnerName ?? '') : copy.photoNoticeSolo;
  return (
    <QuestionLayout
      steps={progress}
      title={copy.rememberQ}
      help={help}
      onBack={back}
      later={
        d.recordId
          ? undefined
          : { label: copy.skip, onClick: () => void save({ memo: '', photos: [] }) }
      }
      primary={{ label: copy.save, loading: saving }}
      onSubmit={() => void save()}
    >
      <ShortText label={copy.memo} value={d.memo} onChange={(memo) => set({ memo })} max={200} />
      {pending ? (
        <ConsentCard
          icon="image"
          title={copy.photoConsentTitle}
          body={copy.photoConsentBody}
          items={[notice, copy.photoGoesWith]}
          laterLabel={copy.photoConsentLater}
          okLabel={copy.photoConsentOk}
          busy={agreeing}
          onLater={() => setPending(null)}
          onOk={() => void agree()}
        />
      ) : (
        <FileAttach
          label={copy.photos}
          drop={copy.photoDrop}
          pick={copy.photoPick}
          help={copy.photoHelp}
          accept=".jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp"
          multiple
          full={d.photos.length >= MAX_PHOTOS}
          fullText={copy.photoTooMany}
          error={photoError}
          files={d.photos.map((p, n) => ({
            key: p.key,
            name: p.file.name || copy.photoAlt(n + 1),
            sub: `${(Math.max(p.file.size, 1) / 1048576).toFixed(1)}MB`,
            thumb: p.url,
            ...(p.state === 'up' ? { progress: 0.5 } : {}),
            ...(p.state === 'error' ? { error: copy.photoFailed, onRetry: () => void save() } : {}),
          }))}
          onFiles={pickFiles}
          onRemove={removePhoto}
          removeLabel={copy.photoRemove}
          retryLabel={copy.photoRetry}
          uploadingLabel={copy.photoUploading}
        />
      )}
    </QuestionLayout>
  );
}
