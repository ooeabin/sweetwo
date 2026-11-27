import {
  cancelModeChange,
  fetchOpenModeRequest,
  manageKeys,
  ModeChangeBlocked,
  qk,
  requestModeChange,
} from '@sweetwo/api';
import {
  addDays,
  formatMonthDay,
  managerEventValue,
  modeChangeNeedsAccept,
  resolveManageStyle,
  type ManagerAnswer,
} from '@sweetwo/core';
import { Button, FormScreen, FormSection, QuestionSkeleton, SegChoice } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { salaryModeCode, track } from '../../../shared/analytics';
import { useBackOr } from '../../../shared/back-or';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { myChecklist, useChecklists } from '../../salary';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Step = 'living' | 'saving' | 'manager';
type YesNo = 'yes' | 'no';

// S-11f 관리 형태(25 ‘설정 v2.2’, 08 2장). 2026-11-24 스테퍼(FormScreen step: “1/3” + 앞 답 줄, 진행 막대 없음): O-30·30b·30c와 같은 세 질문(같이 쓰는 생활비 → 같이 모으는 저금 → 누가 관리,
// 생활비 ‘아니요’면 세 번째는 묻지 않음). 처음 값은 지금 답. 저장 = request_mode_change:
// 수락이 필요 없으면 바로 적용(+ 상대 알림은 서버) → Toast ‘되돌리기’ → 새 월급 계획 확인(W-01),
// 각자 계열 → 같이 계열이나 관리하는 사람을 상대로 넘기면 상대 ‘좋아요’ 요청(S-11j, 7일) → S-11.
// 진행 중인 내 요청은 맨 위 회색 “{이름}님 답을 기다려요” + ‘요청 취소’, 상대가 보낸 요청은 S-11j로 가는 줄.
// 해제 대기 중에는 못 바꿈.
export function S11fManageStyle() {
  const nav = useNavigate();
  const goBack = useBackOr('/settings/me');
  const qc = useQueryClient();
  const d = useSettingsData();
  const open = useQuery({ queryKey: qk.modeRequests, queryFn: fetchOpenModeRequest });
  const [step, setStep] = useState<Step>('living');
  const [living, setLiving] = useState<YesNo | null>(null);
  const [saving, setSaving] = useState<YesNo | null>(null);
  const [manager, setManager] = useState<ManagerAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const lists = useChecklists();
  // 열린 요청은 기다리지 않음(못 읽어도 세 질문은 그대로)
  if (d.loading || !d.space || !d.me || !d.c) return <QuestionSkeleton />;
  const sp = d.space;
  const me = d.me;
  const c = d.c;
  const partnerId = d.partner?.id ?? null;
  const locked = sp.couple_state === 'unlink_pending';
  const connected = sp.couple_state === 'connected' && !!partnerId;
  // 지금 답(옛 공간은 엔진 값에서: 합쳐서 = 생활비 네·둘이 같이)
  const curLiving = sp.shared_living ?? sp.salary_mode === 'joint';
  const curSaving = sp.shared_saving ?? false;
  const curManager: ManagerAnswer | null =
    sp.salary_mode === 'joint'
      ? sp.manager_user_id
        ? sp.manager_user_id === me.id
          ? 'me'
          : 'partner'
        : 'together'
      : curLiving
        ? 'each'
        : null;
  const L = (living ?? (curLiving ? 'yes' : 'no')) === 'yes';
  const S = (saving ?? (curSaving ? 'yes' : 'no')) === 'yes';
  const M = manager ?? curManager;
  const req = open.data && open.data.status === 'open' ? open.data : null;
  const mine = req && req.from_user === me.id ? req : null;
  const theirs = req && req.from_user !== me.id ? req : null;
  const partnerName = c.partnerName;

  const refresh = () => Promise.all(manageKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
  const send = async (lv: boolean, sv: boolean, mg: ManagerAnswer | null, undo = false) => {
    const r = resolveManageStyle(lv, sv, lv ? mg : null);
    const toManagerId = r.manager === 'me' ? me.id : r.manager === 'partner' ? partnerId : null;
    const phrase =
      sp.salary_mode === 'separate' && r.salaryMode === 'joint' ? 's11f_combine' : 's11f_manager';
    const result = await requestModeChange({
      sharedLiving: lv,
      sharedSaving: sv,
      manager: lv ? mg : null,
      phrase,
    });
    if (!undo) {
      track('manage_answers_saved', {
        shared_living: lv,
        shared_saving: sv,
        manager: lv ? managerEventValue(mg) : null,
        salary_mode: salaryModeCode(r.salaryMode),
        screen_id: 'S-11f',
      });
      track('mode_change_requested', { phrase, to_mode: salaryModeCode(r.salaryMode), result });
    }
    return { result, toManagerId, r };
  };
  const finish = async () => {
    if (busy || locked) return;
    setBusy(true);
    try {
      const before = { lv: curLiving, sv: curSaving, mg: curManager };
      const { result } = await send(L, S, M);
      await refresh();
      if (result === 'requested') {
        carryToast(copy.styleAsked(partnerName));
        nav('/settings/me', { replace: true });
        return;
      }
      // 되돌리기: 예전 답으로 다시(그것도 수락이 필요 없을 때만 바로 됨)
      const backNeedsAccept = modeChangeNeedsAccept({
        connected,
        fromMode: resolveManageStyle(L, S, L ? M : null).salaryMode,
        fromManagerId: null,
        toMode: resolveManageStyle(before.lv, before.sv, before.lv ? before.mg : null).salaryMode,
        toManagerId: before.mg === 'partner' ? partnerId : null,
        partnerId,
      });
      carryToast(
        copy.styleSaved,
        backNeedsAccept
          ? undefined
          : {
              label: copy.undo,
              onClick: () => quietly(send(before.lv, before.sv, before.mg, true).then(refresh)),
            },
      );
      nav('/salary/plan', { replace: true });
    } catch (e) {
      toast(
        e instanceof ModeChangeBlocked && e.reason === 'unlink_pending'
          ? copy.unlinkPendingLocked
          : copy.failed,
      );
    } finally {
      setBusy(false);
    }
  };
  const cancelReq = async () => {
    if (!mine || busy) return;
    setBusy(true);
    try {
      await cancelModeChange(mine.id);
      track('mode_change_cancelled', {
        phrase: mine.phrase,
        to_mode: salaryModeCode(mine.to_mode),
      });
      await refresh();
      toast(copy.styleCancelled);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  const same = L === curLiving && S === curSaving && (!L || M === curManager);
  // 저장 전 미리보기 한 줄: 상대 ‘좋아요’가 필요하면 알림
  const resolved = !L || M ? resolveManageStyle(L, S, L ? M : null) : null;
  const needsAccept =
    !!resolved &&
    modeChangeNeedsAccept({
      connected,
      fromMode: sp.salary_mode,
      fromManagerId: sp.manager_user_id,
      toMode: resolved.salaryMode,
      toManagerId:
        resolved.manager === 'me' ? me.id : resolved.manager === 'partner' ? partnerId : null,
      partnerId,
    });
  // 바로 적용되는 엔진 변경이면 미리보기 한 줄(2026-11-09 round 3): 지금 내(합쳐서면 공동) 체크리스트 다음 시작일
  const cur = myChecklist(lists.data, sp.salary_mode === 'joint' ? undefined : me.id);
  const when = cur ? formatMonthDay(addDays(cur.cycle_end, 1)) : copy.nextPayday;
  const note = same
    ? copy.styleSame
    : needsAccept
      ? copy.styleAskNote(partnerName)
      : resolved && resolved.salaryMode !== sp.salary_mode
        ? copy.salaryModePreview[resolved.salaryMode](when)
        : undefined;
  const top = (
    <>
      {mine && (
        <div
          className="hg-row"
          style={{ gap: 'var(--space-2)', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <p className="hg-text hg-text--sub">{copy.styleWaiting(partnerName)}</p>
          <Button variant="link" loading={busy} onClick={() => void cancelReq()}>
            {copy.styleCancel}
          </Button>
        </div>
      )}
      {theirs && (
        <div
          className="hg-row"
          style={{ gap: 'var(--space-2)', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <p className="hg-text hg-text--sub">{copy.styleReceived(partnerName)}</p>
          <Button variant="link" onClick={() => nav(`/settings/couple/style/request/${theirs.id}`)}>
            {copy.seeRequest}
          </Button>
        </div>
      )}
    </>
  );
  const yesNo = (k: 'living' | 'saving'): { value: YesNo; label: string }[] => [
    { value: 'yes', label: copy.yes },
    { value: 'no', label: k === 'living' ? copy.no : copy.notYet },
  ];
  const options: { value: ManagerAnswer; label: string }[] = [
    { value: 'me', label: copy.managerMe },
    { value: 'partner', label: copy.managerPartner(c.joined ? partnerName : '') },
    { value: 'together', label: copy.managerTogether },
    { value: 'each', label: copy.managerEach },
  ];
  const total = L ? 3 : 2;
  const livingDone = {
    label: copy.doneLiving,
    value: L ? copy.yes : copy.no,
    onClick: () => setStep('living'),
  };
  const savingDone = {
    label: copy.doneSaving,
    value: S ? copy.yes : copy.notYet,
    onClick: () => setStep('saving'),
  };

  // 스테퍼(2026-11-24): 세 번째 질문은 첫 답이 ‘네’일 때만 있어서 한 화면으로 못 합침. 앞에서 답한 줄이 위에 쌓임
  if (step === 'living')
    return (
      <FormScreen
        title={copy.salaryMode}
        onBack={goBack}
        step={{ index: 1, total }}
        primary={{ label: copy.next, disabled: locked }}
        onSubmit={() => !locked && setStep('saving')}
      >
        {top}
        <FormSection title={copy.livingQ} aside={locked ? copy.unlinkPendingLocked : undefined}>
          <SegChoice<YesNo>
            label={copy.livingQ}
            value={L ? 'yes' : 'no'}
            onChange={setLiving}
            items={yesNo('living')}
          />
          {!locked && <p className="hg-form__hint">{copy.livingHelp}</p>}
        </FormSection>
      </FormScreen>
    );
  if (step === 'saving')
    return (
      <FormScreen
        title={copy.salaryMode}
        onBack={() => setStep('living')}
        step={{ index: 2, total, done: [livingDone] }}
        primary={{
          label: L ? copy.next : copy.save,
          disabled: locked || (!L && same),
          loading: busy,
        }}
        onSubmit={() => (L ? setStep('manager') : void finish())}
      >
        <FormSection title={copy.savingQ}>
          <SegChoice<YesNo>
            label={copy.savingQ}
            value={S ? 'yes' : 'no'}
            onChange={setSaving}
            items={yesNo('saving')}
          />
          {!L && note && <p className="hg-form__hint">{note}</p>}
        </FormSection>
      </FormScreen>
    );
  return (
    <FormScreen
      title={copy.salaryMode}
      onBack={() => setStep('saving')}
      step={{ index: 3, total, done: [livingDone, savingDone] }}
      primary={{ label: copy.save, disabled: locked || !M || same, loading: busy }}
      onSubmit={() => void finish()}
    >
      <FormSection title={copy.managerQ}>
        <SegChoice<ManagerAnswer>
          label={copy.managerQ}
          value={M}
          onChange={setManager}
          variant="rows"
          items={options}
        />
        {note && <p className="hg-form__hint">{note}</p>}
      </FormSection>
    </FormScreen>
  );
}
