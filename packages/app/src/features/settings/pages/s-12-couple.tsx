import {
  cancelInvite,
  cancelUnlink,
  createInvite,
  fetchLatestInvite,
  fetchMyUnlink,
  fetchReconnectRequests,
  fetchUnlinkPartnerName,
  ReconnectBlocked,
  requestReconnect,
  startNewInvite,
  fetchUnlink,
  qk,
  renewInvite,
} from '@sweetwo/api';
import { daysBetween, formatDateFull, formatMonthDay, todayKst } from '@sweetwo/core';
import { Badge, Button, ListRow, Modal, PageHeader } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { InviteButtons, InviteCodeBox, inviteActions } from '../../../shared/invite-share';
import { toast } from '../../../shared/toast';
import { paths } from '../../auth';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { inviteStateOf } from '../invite-state';
import { daysPending, exportedSince } from '../unlink';

// S-12 우리 둘 정보(docs/spec/25-settings.md). 상태 4가지: 미합류(초대 전, 초대 중, 합류하는 중, 만료) / 연결 / 해제 대기 / 혼자 쓰기.
// 2026-11-11 QA 3구간: ‘초대하기’ = 코드를 바로 만들고 O-07과 같은 코드 상자 + ‘링크 복사’ + ‘카톡으로 보내기’(D6, D9).
// 누가 ‘합류하기’를 눌러 코드를 잡아 두면 ‘합류하는 중’ + ‘초대 취소’(확인 Modal, D1). 받은 코드가 있으면 ‘받은 초대 코드가 있어요 ›’(D4).
// 홈 초대 띠·서랍 ‘초대하기’는 ?invite=1로 와서 코드가 없으면 바로 만듦.
// 결혼 예정일은 보기만(예식일 수정 H-P1, ‘결혼했어요’ H-T1은 아직 없음). 연결이면 ‘연결 해제’ → S-12a.
// 해제 대기: 요청한 사람은 “예빈님 답을 기다리고 있어요” + ‘요청 취소’, 받은 사람은 ‘자산 정리 안 보기’ → S-12d.
// 혼자 쓰기(해제 확정 뒤, v2.2 D10): ‘다시 연결하기’ = 복구 없는 새 연결 요청(7일에 1번, 기한 없음).
// 받은 요청이 있으면 “{이름}님이 다시 연결하자고 해요” + ‘확인하기’(→ S-12g), 보낸 요청이 열려 있으면 “{이름}님 답을 기다리고 있어요”.
export function S12Couple() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [params] = useSearchParams();
  const state = d.space?.couple_state;
  const invite = useQuery({
    queryKey: qk.latestInvite,
    queryFn: fetchLatestInvite,
    enabled: state === 'not_joined',
  });
  const unlink = useQuery({
    queryKey: qk.unlink,
    queryFn: fetchUnlink,
    enabled: state === 'unlink_pending',
  });
  const myUnlink = useQuery({
    queryKey: qk.myUnlink,
    queryFn: fetchMyUnlink,
    enabled: state === 'solo' || state === 'not_joined',
  });
  const partnerName = useQuery({
    queryKey: qk.unlinkPartner,
    queryFn: fetchUnlinkPartnerName,
    enabled: !!myUnlink.data,
  });
  // 다시 연결 요청(보낸 것·받은 것, reconnect_request)
  const reconnects = useQuery({
    queryKey: qk.reconnectRequests,
    queryFn: fetchReconnectRequests,
    enabled: !!myUnlink.data,
  });
  const [busy, setBusy] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const inv = invite.data ?? null;
  const reserved = inv && !inv.usedAt && inv.reservedUntil ? inv : null;
  const live =
    inv && !inv.usedAt && !reserved && new Date(inv.expiresAt).getTime() > Date.now() ? inv : null;
  // 홈 초대 띠·서랍에서 왔으면(?invite=1) 코드가 없을 때 바로 만듦(한 번)
  const auto = useRef(false);
  const wantInvite = params.get('invite') === '1';
  useEffect(() => {
    if (auto.current || !wantInvite || state !== 'not_joined' || invite.isLoading) return;
    if (live || reserved) return;
    auto.current = true;
    void make(!!inv);
  }, [wantInvite, state, invite.isLoading, live, reserved]); // eslint-disable-line react-hooks/exhaustive-deps
  if (
    d.loading ||
    !d.me ||
    !d.c ||
    !d.space ||
    (state === 'not_joined' && invite.isLoading) ||
    (state === 'unlink_pending' && unlink.isLoading) ||
    ((state === 'solo' || state === 'not_joined') && myUnlink.isLoading)
  )
    return <LoadingFrame sub="settings" current={null} />;
  const { c, space: sp } = d;
  const today = todayKst();

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelUnlink();
      if (unlink.data)
        track('unlink_resolved', {
          path: 'canceled',
          days_pending: daysPending(unlink.data.requested_at),
          exported_data: exportedSince(unlink.data.requested_at),
        });
      await Promise.all([qk.space, qk.unlink].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(copy.cancelled);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  async function make(renew: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await (renew ? renewInvite() : createInvite());
      await qc.invalidateQueries({ queryKey: qk.latestInvite });
      if (renew) toast(copy.newCodeDone);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  }
  const cancelInv = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelInvite();
      await qc.invalidateQueries({ queryKey: qk.latestInvite });
      setAskCancel(false);
      toast(copy.inviteCancelled);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  const stateText =
    !state || state === 'connected'
      ? copy.connected
      : state === 'not_joined'
        ? copy.inviteState(inviteStateOf(inv))
        : copy.state[state];
  // 시작한 사람 먼저(보는 사람마다 순서가 바뀌던 것, S3-30)
  const people: { name: string; starter: boolean }[] = [{ name: c.myName, starter: c.starter }];
  if (!c.solo && c.partnerName) people.push({ name: c.partnerName, starter: !c.starter });
  people.sort((a, b) => Number(b.starter) - Number(a.starter));
  const names = people.map((p) => p.name);
  const engaged = sp.marriage_status === 'engaged';
  const wedding = sp.wedding_date;

  const act = inviteActions({
    code: live?.code,
    nickname: c.myName,
    entry: wantInvite ? 'home' : 'settings',
  });
  const haveCode = (
    <div className="hg-list">
      <ListRow
        label={copy.haveCode}
        onClick={() => nav(paths.joinCode, { state: { from: '/settings/couple' } })}
      />
    </div>
  );
  const inviteBlock =
    state !== 'not_joined' ? null : reserved ? (
      // 합류하는 중(코드를 잡아 둠, 24시간): 보기만 + ‘초대 취소’
      <div className="hg-card hg-stack" style={{ gap: 'var(--space-3)' }} role="status">
        <p>
          <strong>{copy.joiningTitle}</strong>
        </p>
        <p className="hg-q__help">{copy.joiningHelp}</p>
        <div className="hg-row">
          <Button variant="secondary" size="sm" onClick={() => setAskCancel(true)}>
            {copy.inviteCancel}
          </Button>
        </div>
      </div>
    ) : live ? (
      <div className="hg-card hg-stack" style={{ gap: 'var(--space-4)' }}>
        <InviteCodeBox code={live.code} onCopy={() => void act.copyCode()} />
        <p className="hg-q__help" style={{ textAlign: 'center' }}>
          {copy.inviteUntil(formatMonthDay(todayKst(new Date(live.expiresAt))))}
        </p>
        <InviteButtons onLink={() => void act.copyLink()} onShare={() => void act.share()} />
        <div className="hg-row" style={{ justifyContent: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            className="hg-btn--link"
            loading={busy}
            onClick={() => void make(true)}
          >
            {copy.newCode}
          </Button>
        </div>
      </div>
    ) : inv ? (
      <div className="hg-banner hg-banner--info" role="status">
        <span>{copy.inviteExpired}</span>
        <Button variant="secondary" size="sm" loading={busy} onClick={() => void make(true)}>
          {copy.newCode}
        </Button>
      </div>
    ) : (
      <div className="hg-card hg-stack" style={{ gap: 'var(--space-4)' }}>
        <p>{copy.inviteFirstAny}</p>
        <div className="hg-row">
          <Button loading={busy} onClick={() => void make(false)}>
            {copy.inviteMake}
          </Button>
        </div>
      </div>
    );

  const req = state === 'unlink_pending' ? (unlink.data ?? null) : null;
  const mine = req?.requested_by === d.me.id;
  const pendingBlock = req ? (
    <div className="hg-stack" style={{ gap: 'var(--space-4)' }}>
      <div className="hg-card hg-stack" style={{ gap: 'var(--space-3)' }}>
        <p>
          <strong>
            {/* 요청한 사람은 “연결 해제 대기 중”(25 ‘연결 해제, 대기와 혼자 쓰기’ 1번, 2026-11-12 QA 11구간 D3) */}
            {mine ? copy.state.unlink_pending : copy.pendingReceived(c.partnerName)}
          </strong>
        </p>
        <p className="hg-q__help">
          {mine
            ? copy.pendingWhen(c.partnerName, formatMonthDay(req.deadline))
            : copy.unlinkOn(formatMonthDay(req.deadline))}
        </p>
        <div className="hg-row" style={{ flexWrap: 'wrap' }}>
          {mine ? (
            <Button variant="secondary" size="sm" loading={busy} onClick={() => void cancel()}>
              {copy.cancelRequest}
            </Button>
          ) : (
            <Button size="sm" onClick={() => nav('/settings/couple/unlink/review')}>
              {copy.seeRequest}
            </Button>
          )}
        </div>
      </div>
      <div className="hg-list">
        <ListRow label={copy.frozen} chevron={false} />
      </div>
    </div>
  ) : null;

  // 혼자 쓰기(또는 해제 뒤 새로 초대 중): 다시 연결 요청(7일에 1번), 새로 초대하기
  const done = state === 'solo' || state === 'not_joined' ? (myUnlink.data ?? null) : null;
  const ex = partnerName.data ?? '';
  const rows = reconnects.data ?? [];
  const received = rows.find((r) => r.to_user === d.me?.id && r.status === 'open');
  const sent = rows.find((r) => r.from_user === d.me?.id && r.status === 'open');
  const reconnectAsk = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await requestReconnect();
      if (done?.confirmed_at)
        track('rejoin_requested', {
          days_since_unlink: daysPending(done.confirmed_at),
        });
      await qc.invalidateQueries({ queryKey: qk.reconnectRequests });
      toast(copy.reconnectSent(ex));
    } catch (e) {
      if (e instanceof ReconnectBlocked && e.reason !== 'no_request') {
        track('reconnect_blocked', { reason: e.reason });
        toast(e.reason === 'too_soon' ? copy.reconnectTooSoon : copy.reconnectClosed);
      } else toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const newInvite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await startNewInvite();
      await qc.invalidateQueries({ queryKey: qk.space });
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const soloBlock = done ? (
    <div className="hg-card hg-stack" style={{ gap: 'var(--space-3)' }}>
      {received ? (
        <>
          <p>
            <strong>{copy.reconnectAsked(ex)}</strong>
          </p>
          <div className="hg-row">
            <Button size="sm" onClick={() => nav('/settings/couple/reconnect')}>
              {copy.seeRequest}
            </Button>
          </div>
        </>
      ) : sent ? (
        <p>
          <strong>{copy.pendingWait(ex)}</strong>
        </p>
      ) : (
        <div className="hg-row">
          <Button variant="secondary" size="sm" loading={busy} onClick={() => void reconnectAsk()}>
            {copy.reconnect}
          </Button>
        </div>
      )}
    </div>
  ) : null;
  const newInviteBlock =
    state === 'solo' ? (
      <div className="hg-list">
        <ListRow label={copy.newInvite} onClick={() => void newInvite()} />
      </div>
    ) : null;

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.coupleTitle}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <div className="hg-list">
        <ListRow
          lead={
            <span className="hg-avatars" aria-hidden="true">
              {people.map((p, i) => (
                <span
                  key={p.name + i}
                  className={p.starter ? 'hg-avatar hg-avatar--p1' : 'hg-avatar hg-avatar--p2'}
                >
                  {[...p.name][0] ?? ''}
                </span>
              ))}
            </span>
          }
          label={names.join(' ')}
          value={stateText}
          chevron={false}
        />
        {wedding && (engaged || sp.marriage_status === 'married') && (
          <ListRow
            label={engaged ? copy.weddingPlanned : copy.weddingDone}
            value={
              <>
                {formatDateFull(wedding)}
                {engaged && (
                  <>
                    {' '}
                    <Badge kind="together">{copy.dday(daysBetween(today, wedding))}</Badge>
                  </>
                )}
              </>
            }
            chevron={false}
          />
        )}
      </div>
      {inviteBlock}
      {pendingBlock}
      {soloBlock}
      {newInviteBlock}
      {(state === 'not_joined' && !reserved) || state === 'solo' ? haveCode : null}
      {state === 'connected' && (
        <div className="hg-list">
          <ListRow label={copy.unlink} onClick={() => nav('/settings/couple/unlink')} />
        </div>
      )}
    </div>
  );
  return (
    <>
      <MainFrame sub="settings" current={null} columns={[body]} />
      {askCancel && (
        <Modal
          title={copy.inviteCancelQ}
          body={copy.inviteCancelBody}
          confirmLabel={copy.inviteCancelOk}
          cancelLabel={copy.inviteCancelKeep}
          busy={busy}
          onCancel={() => setAskCancel(false)}
          onConfirm={() => void cancelInv()}
        />
      )}
    </>
  );
}
