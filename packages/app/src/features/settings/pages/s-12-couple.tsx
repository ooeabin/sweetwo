import { createInvite, fetchLatestInvite, qk, renewInvite } from '@sweetwo/api';
import { daysBetween, formatDateFull, formatMonthDay, todayKst } from '@sweetwo/core';
import { Badge, Button, ListRow, PageHeader } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../month';
import { inviteLink } from '../../onboarding';
import { copy } from '../copy';
import { useSettingsData } from '../data';

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    toast(copy.copied);
  } catch {
    /* 클립보드를 못 쓰는 환경: 아무것도 하지 않음 */
  }
}

/** “482913” → “482 913” */
const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

// S-12 부부 정보(docs/spec/25-settings.md). 상태 4가지: 미합류(초대 전, 초대 중, 만료) / 연결 / 해제 대기 / 혼자 쓰기.
// 결혼 예정일은 보기만(예식일 수정 H-P1, ‘결혼했어요’ H-T1은 아직 없음). 연결 해제(S-12a~h), 새로 초대하기,
// 다시 연결하기는 다음 단계.
export function S12Couple() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const state = d.space?.couple_state;
  const invite = useQuery({
    queryKey: qk.latestInvite,
    queryFn: fetchLatestInvite,
    enabled: state === 'not_joined',
  });
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.me || !d.c || !d.space || (state === 'not_joined' && invite.isLoading))
    return <MainFrame current={null} columns={[null]} />;
  const { c, space: sp } = d;
  const today = todayKst();

  const make = async (renew: boolean) => {
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
  };

  const stateText = !state || state === 'connected' ? copy.connected : copy.state[state];
  const names = c.solo || !c.partnerName ? [c.myName] : [c.myName, c.partnerName];
  const engaged = sp.marriage_status === 'engaged';
  const wedding = sp.wedding_date;

  const inv = invite.data ?? null;
  const live = inv && !inv.usedAt && new Date(inv.expiresAt).getTime() > Date.now() ? inv : null;

  const inviteBlock =
    state !== 'not_joined' ? null : live ? (
      <div className="hg-card hg-stack" style={{ gap: 'var(--space-4)' }}>
        <p className="hg-q__help">{copy.inviteCode}</p>
        <p className="hg-amount__value" style={{ letterSpacing: 'var(--space-1)' }}>
          {spaced(live.code)}
        </p>
        <p className="hg-q__help">
          {copy.inviteUntil(formatMonthDay(todayKst(new Date(live.expiresAt))))}
        </p>
        <div className="hg-row" style={{ flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => void copyText(live.code)}>
            {copy.copyCode}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copyText(inviteLink(live.code))}
          >
            {copy.copyLink}
          </Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void make(true)}>
            {copy.newCode}
          </Button>
        </div>
      </div>
    ) : inv ? (
      <div className="hg-banner hg-banner--info" role="status">
        <span>{copy.inviteExpired}</span>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void make(true)}>
          {copy.newCode}
        </Button>
      </div>
    ) : (
      <div className="hg-card hg-stack" style={{ gap: 'var(--space-4)' }}>
        <p>{copy.inviteFirst(c.partnerName)}</p>
        <div className="hg-row">
          <Button disabled={busy} onClick={() => void make(false)}>
            {copy.inviteMake}
          </Button>
        </div>
      </div>
    );

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.coupleTitle} backLabel={copy.back} onBack={() => nav('/settings')} />
      <div className="hg-list">
        <ListRow
          lead={
            <span className="hg-avatars" aria-hidden="true">
              {names.map((n, i) => (
                <span
                  key={n + i}
                  className={
                    (i === 0) === c.starter ? 'hg-avatar hg-avatar--p1' : 'hg-avatar hg-avatar--p2'
                  }
                >
                  {[...n][0] ?? ''}
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
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
