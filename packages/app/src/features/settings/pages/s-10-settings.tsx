import { fetchInquiries, fetchLatestInvite, qk } from '@sweetwo/api';
import { notiPrefs } from '@sweetwo/core';
import { Badge, ListRow, Toggle } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { detectPlatform, isApp } from '../../../platform';
import { useMask } from '../../../shared/mask';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { useChecklist } from '../guides';
import { inviteStateOf } from '../invite-state';
import { usePushPermission } from '../push-status';
import { PersonDot } from '../../../shared/person';

// S-10 설정 홈(docs/spec/25-settings.md). 메뉴가 아니라 상단 아바타(좁은 창은 설정 버튼)로 들어옴.
// 오른쪽 회색 요약 값(공개 범위, 알림 채널, 앱 잠금(모바일 앱), 가이드 진행), 앱 정보 줄에 버전 + 확인 요청 배지(관리자 열람 요청이 있을 때만 → S-19a).
// 공개 범위 줄은 파트너 미합류·혼자 쓰기면 숨김.
export function S10Settings() {
  const nav = useNavigate();
  const d = useSettingsData();
  const ck = useChecklist(d.space);
  const mask = useMask();
  const [pushPerm] = usePushPermission();
  const platform = detectPlatform();
  const app = isApp(platform);
  const lock = useQuery({
    queryKey: ['lock-status'],
    queryFn: () => window.sweetwo?.lock.status() ?? Promise.resolve(null),
    enabled: app,
  });
  const inquiries = useQuery({ queryKey: qk.inquiries, queryFn: fetchInquiries });
  const invite = useQuery({
    queryKey: qk.latestInvite,
    queryFn: fetchLatestInvite,
    enabled: d.space?.couple_state === 'not_joined',
  });
  const asking = (inquiries.data ?? []).filter((q) =>
    q.access_request.some((a) => a.status === 'requested'),
  ).length;
  if (d.loading || !d.me || !d.c) return <LoadingFrame current={null} />;
  const c = d.c;
  const state = d.space?.couple_state ?? 'not_joined';
  // 미합류는 초대 전 / 초대 중 / 합류하는 중 / 초대 만료로 나눔(2026-11-11 S3-18)
  const stateValue =
    state === 'connected'
      ? copy.state.connected(c.partnerName)
      : state === 'not_joined'
        ? copy.inviteState(inviteStateOf(invite.data ?? null))
        : copy.state[state];
  const prefs = notiPrefs(d.me.noti_prefs);
  // 휴대폰에서 알림을 허용했을 때만 ‘켜짐’(건너뛰었거나 거절했으면 꺼짐, R7)
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <div className="hg-list">
        <ListRow
          lead={
            <span className="hg-avatars" aria-hidden="true">
              <PersonDot name={c.myName} starter={c.starter} userId={d.me.id} />
              {c.partnerName && !c.solo && (
                <PersonDot name={c.partnerName} starter={!c.starter} userId={d.partner?.id} />
              )}
            </span>
          }
          label={copy.couple(c.myName, c.solo ? '' : c.partnerName)}
          sub={copy.loggedIn(copy.providers[d.me.provider ?? ''] ?? '')}
          onClick={() => nav('/settings/me')}
        />
        <ListRow
          label={copy.rows.couple}
          value={stateValue}
          onClick={() => nav('/settings/couple')}
        />
      </div>
      <div className="hg-list">
        {c.joined && (
          <ListRow
            label={copy.rows.visibility}
            value={
              // v2.2: 요약 값은 내 월급 계획 공개 단계(같이 계열은 늘 모두)
              d.space?.salary_mode === 'joint'
                ? copy.planShareJoint
                : (copy.planShares[d.me.plan_share] ?? '')
            }
            onClick={() => nav('/settings/visibility')}
          />
        )}
        <ListRow
          label={copy.rows.noti}
          value={copy.pushState(prefs.push && pushPerm === 'granted')}
          onClick={() => nav('/settings/notifications')}
        />
        <ListRow
          label={copy.rows.security}
          value={
            app && lock.data ? (lock.data.hasPin ? copy.rows.lockOn : copy.rows.lockOff) : undefined
          }
          onClick={() => nav('/settings/security')}
        />
        <ListRow
          label={copy.rows.guide}
          value={ck.stage ? copy.checklistProgress(ck.count, ck.total) : undefined}
          onClick={() => nav('/settings/guides')}
        />
        <ListRow label={copy.rows.screen} value={copy.rows.screenValue} />
        {/* 금액 가리기(2026-11-03 좁은 창 머리 눈 아이콘 대신 여기서. 기기마다 기억) */}
        <div className="hg-listrow hg-listrow--toggle">
          <Toggle
            label={copy.rows.mask}
            help={copy.rows.maskHelp}
            checked={mask.masked}
            onChange={() => mask.toggle()}
          />
        </div>
      </div>
      <div className="hg-list">
        <ListRow label={copy.rows.help} onClick={() => nav('/settings/help')} />
        <ListRow
          label={copy.rows.data}
          sub={copy.rows.dataSub}
          onClick={() => nav('/settings/data')}
        />
        <ListRow
          label={
            asking ? (
              <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                {copy.rows.about}
                <Badge kind="temp">{copy.rows.asking(asking)}</Badge>
              </span>
            ) : (
              copy.rows.about
            )
          }
          value={app ? (window.sweetwo?.appVersion ?? '') : undefined}
          onClick={() => nav(asking ? '/settings/help/inquiries' : '/settings/about')}
        />
      </div>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
