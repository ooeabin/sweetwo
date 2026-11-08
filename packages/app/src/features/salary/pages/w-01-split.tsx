import { qk, saveSplit } from '@sweetwo/api';
import { type SplitLineDraft } from '@sweetwo/core';
import { Icon, ListRow, Modal, QuestionSkeleton, Tabs } from '@sweetwo/ui';
import { money, useMask } from '../../../shared/mask';
import { PersonDot } from '../../../shared/person';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useGoalSaved, useGoals, useMe, usePartner, useSpace, useSplits } from '../data';
import { savingPaths } from '../paths';
import { recommendedDraft } from '../split-draft';
import { SplitEditor, toDraft } from '../split-editor';

// W-01 월급 계획(20). O-50과 같은 틀. 저장 = 바로 적용 + Toast “월급 계획을 바꿨어요” + 되돌리기, 상대 알림은 서버.
// 이번 사이클 체크 안 한 줄도 새 금액으로(서버 sync_checklist).
// 각자 + 파트너 합류: 사람 탭(내 탭 기본, `?who=`). 파트너 탭은 보기만(2026-11-09, 서버 save_split not_owner):
// 맨 위 회색 한 줄 “{파트너}님 월급 계획이에요. 보기만 할 수 있어요”, 줄마다 자물쇠, 추천값·저장·줄 추가 없음.
// 저금 묶음 아래 ‘+ 저금 항목 추가’(W-11a, 내 탭·합쳐서만), 저금 줄 금액 입력 아래 ‘저금 항목 보기’(W-10).
// 맨 아래 접힌 줄 ‘그만 모은 저금 항목 n개’ → W-10. 수입 줄 → 설정 내 월급(S-11, 내 탭만). 연결 해제 대기 중이면 보기만.
export function W01Split() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const splits = useSplits();
  const partner = usePartner();
  const saved = useGoalSaved();
  const { masked } = useMask();
  const [fold, setFold] = useState(false);
  const [who, setWho] = useState<string | null>(() => params.get('who'));
  const [drafts, setDrafts] = useState<Record<string, SplitLineDraft[]>>({});
  const [refill, setRefill] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!me.data || !space.data || !goals.data || !splits.data)
    return <QuestionSkeleton fields={3} />;
  const m = me.data;
  const p = partner.data ?? null;
  const joint = space.data.salary_mode === 'joint';
  const connected =
    space.data.couple_state === 'connected' || space.data.couple_state === 'unlink_pending';
  const pending = space.data.couple_state === 'unlink_pending';
  const tabs = !joint && connected && p;
  const ownerId = joint ? null : tabs && who === p.id ? p.id : m.id;
  const owner = ownerId === p?.id && p ? p : m;
  const theirs = !joint && ownerId !== m.id;
  const key = ownerId ?? 'joint';
  const splitOf = (id: string | null) => splits.data.find((x) => x.owner_user_id === id);
  const mine = splitOf(ownerId);
  const stored = mine ? toDraft(mine.split_line) : null;
  const draftOrSaved = () => drafts[key] ?? stored ?? [];
  const recommend = () =>
    recommendedDraft(owner, goals.data, {
      joint,
      partner: p,
      saved: saved.data,
      current: draftOrSaved(),
    });
  const draft = drafts[key] ?? null;
  const lines = draft ?? stored ?? recommend();
  const income = joint
    ? (m.monthly_income ?? 0) + (p?.monthly_income ?? 0)
    : (owner.monthly_income ?? 0);
  const payday = owner.payday_last ? 'last' : owner.payday;
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/'));
  // 이 월급 계획에서 그만 모은 저금 항목(각자 = 이 탭 주인 것, 합쳐서 = 모두)
  const closed = goals.data.filter(
    (g) => !g.deleted_at && !!g.closed_at && (joint || g.owner_user_id === ownerId),
  );

  const write = async (next: SplitLineDraft[]) => {
    await saveSplit(next, ownerId ?? undefined);
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.splits }),
      qc.invalidateQueries({ queryKey: ['pay_checklist'] }),
      qc.invalidateQueries({ queryKey: qk.goals }),
    ]);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await write(lines);
      const before = stored;
      toast(
        copy.saved,
        before ? { label: copy.undo, onClick: () => quietly(write(before)) } : undefined,
      );
      back();
    } catch {
      toast(copy.failed, { label: copy.retry, onClick: () => quietly(save()) });
    } finally {
      setSaving(false);
    }
  };

  const name = (id: string | undefined) => (id === m.id ? (m.nickname ?? '') : (p?.nickname ?? ''));
  return (
    <>
      <SplitEditor
        key={key}
        lines={lines}
        onChange={(next) => setDrafts({ ...drafts, [key]: next })}
        income={income}
        payday={payday}
        goals={goals.data}
        personName={name}
        joint={joint}
        title={copy.splitTitle}
        help={copy.splitHelp}
        primaryLabel={copy.save}
        primaryDisabled={!draft || pending || theirs}
        saving={saving}
        onBack={back}
        onSave={() => void save()}
        locked={() => theirs}
        readOnly={pending || theirs}
        savedOf={(id) => saved.data?.[id] ?? 0}
        onItem={(id) => nav(savingPaths.item(id))}
        onAddItem={!theirs && !pending ? () => nav(`${savingPaths.add}/a?from=split`) : undefined}
        onIncome={ownerId === m.id || joint ? () => nav('/settings/me') : undefined}
        notice={
          <>
            {tabs && (
              <Tabs
                label={copy.splitTitle}
                value={ownerId ?? m.id}
                onChange={setWho}
                items={[m, p].map((x) => ({
                  value: x.id,
                  label: x.nickname ?? '',
                  lead: (
                    <PersonDot
                      name={x.nickname ?? ''}
                      starter={x.id === space.data?.created_by}
                      userId={x.id}
                    />
                  ),
                }))}
              />
            )}
            {theirs && <p className="hg-q__help">{copy.partnerSplitView(owner.nickname ?? '')}</p>}
            {pending && <p className="hg-q__help">{copy.splitPending}</p>}
          </>
        }
        extra={
          <>
            {!pending && !theirs && (
              <button
                type="button"
                className="hg-btn hg-btn--link"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setRefill(true)}
              >
                {copy.refill}
              </button>
            )}
            {/* 그만 모은 저금 항목(20 W-01 8번): 접힌 줄, 펼치면 이름 + 모은 돈 → W-10 */}
            {closed.length > 0 && (
              <button
                type="button"
                className="hg-foldrow"
                aria-expanded={fold}
                onClick={() => setFold((x) => !x)}
              >
                <span>{copy.closedFold(closed.length)}</span>
                <Icon name={fold ? 'chevron-up' : 'chevron-down'} size={16} />
              </button>
            )}
            {fold &&
              closed.map((g) => (
                <ListRow
                  key={g.id}
                  label={g.name}
                  value={money(saved.data?.[g.id] ?? 0, masked)}
                  onClick={() => nav(savingPaths.item(g.id))}
                />
              ))}
          </>
        }
      />
      {refill && (
        <Modal
          title={copy.refillTitle}
          body={copy.refillBody}
          confirmLabel={copy.refillOk}
          cancelLabel={copy.cancel}
          onCancel={() => setRefill(false)}
          onConfirm={() => {
            setDrafts({ ...drafts, [key]: recommend() });
            setRefill(false);
          }}
        />
      )}
    </>
  );
}
