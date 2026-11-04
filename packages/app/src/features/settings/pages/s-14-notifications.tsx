import {
  fetchMarketing,
  qk,
  registerPushDevice,
  setMarketing,
  updateMe,
  type Me,
} from '@sweetwo/api';
import {
  formatDateFull,
  notiPrefs,
  TERMS_VERSION,
  todayKst,
  type NotiPrefs,
  type NotiTopic,
} from '@sweetwo/core';
import { Button, ListRow, PageHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectPlatform, isApp } from '../../../platform';
import { toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy, hourLabel } from '../copy';
import { useSettingsData } from '../data';

// S-14 알림(docs/spec/25-settings.md): 메일 상한 안내, 받는 방법마다 카드(웹은 이메일만) 안에 묶음별 토글, 챙길 날은 시점 체크 목록,
// 받는 방법(둘 다 끄면 “알림을 받을 방법이 없어요” 확인), 방해 금지 시간(→ S-14a). 바뀌면 바로 저장.
// 센터 기록은 설정과 상관없이 남음. 끌 수 없는 종류(보안·결정 기한)는 목록에 없음.
// 마케팅 정보 받기(기본 꺼짐): 켜고 끌 때마다 동의 기록(consent, 추가만), 켜면 “{날짜} 동의”.
const CARE: NotiTopic[] = ['care_30', 'care_14', 'care_7', 'care_0'];

export function S14Notifications() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [confirm, setConfirm] = useState<'push' | 'email' | null>(null);
  const marketing = useQuery({ queryKey: ['consent', 'marketing'], queryFn: fetchMarketing });
  if (d.loading || !d.me || !d.c) return <LoadingFrame sub="settings" current={null} />;
  // 받는 방법 ‘OS 알림’은 앱(데스크톱 로컬 알림, 모바일 푸시)만
  const desktop = isApp(detectPlatform());
  const prefs = notiPrefs(d.me.noti_prefs);
  const me = d.me;

  const save = async (next: NotiPrefs) => {
    // 바로 보이게 캐시 먼저
    qc.setQueryData<Me | null>(qk.me, (m) => (m ? { ...m, noti_prefs: next as never } : m));
    try {
      await updateMe({ noti_prefs: next as never });
    } catch {
      toast(copy.failed);
    } finally {
      await qc.invalidateQueries({ queryKey: qk.me });
    }
  };
  const setTopic = (t: NotiTopic, ch: 'push' | 'email', on: boolean) =>
    void save({ ...prefs, topics: { ...prefs.topics, [t]: { ...prefs.topics[t], [ch]: on } } });
  // 받는 방법: 마지막 하나를 끄면 확인
  const setChannel = async (ch: 'push' | 'email', on: boolean) => {
    const other = ch === 'push' ? prefs.email : desktop && prefs.push;
    if (!on && !other) return setConfirm(ch);
    // 모바일: 푸시를 켜면 OS 허용부터(거절했으면 휴대폰 설정에서)
    const push = window.sweetwo?.push;
    if (ch === 'push' && on && push && (await push.status()) !== 'granted') {
      if (!(await push.request())) return toast(copy.pushDenied);
      const t = await push.token();
      const pf = window.sweetwo?.platform;
      if (t && (pf === 'ios' || pf === 'android'))
        await registerPushDevice(pf, t, window.sweetwo?.appVersion ?? '').catch(() => undefined);
    }
    void save({ ...prefs, [ch]: on });
  };

  // 2026-11-04 받는 방법마다 카드 하나: 묶음 줄마다 토글, 챙길 날은 시점 체크 목록(Y-05 미리 알림과 같은 모양)
  const channels = desktop ? (['push', 'email'] as const) : (['email'] as const);
  const topicRow = (ch: 'push' | 'email', t: NotiTopic, label: string, sub?: string) => (
    <Toggle
      key={t}
      label={label}
      help={sub}
      checked={prefs.topics[t][ch]}
      disabled={!prefs[ch]}
      onChange={(on) => setTopic(t, ch, on)}
    />
  );
  const channelCard = (ch: 'push' | 'email') => (
    <section
      key={ch}
      className="hg-card hg-stack"
      aria-label={copy.topicsBy[ch]}
      style={{ gap: 0 }}
    >
      <span className="hg-card__label">{copy.topicsBy[ch]}</span>
      {topicRow(ch, 'plan', copy.groups.plan)}
      {d.c?.joined &&
        topicRow(
          ch,
          'partner_change',
          copy.groups.partner_change(d.c.partnerName),
          copy.partnerChangeSub,
        )}
      {topicRow(ch, 'money', copy.groups.money)}
      {topicRow(ch, 'goal', copy.groups.goal)}
      {topicRow(ch, 'invite', copy.groups.invite)}
      <span className="hg-card__label" style={{ marginTop: 'var(--space-4)' }}>
        {copy.careAlerts}
      </span>
      <div
        className="hg-list hg-list--plain"
        role="group"
        aria-label={`${copy.careAlerts} ${ch === 'push' ? copy.push : copy.email}`}
      >
        {CARE.map((t) => {
          const on = prefs.topics[t][ch];
          return (
            <button
              key={t}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={!prefs[ch]}
              className="hg-listrow"
              onClick={() => setTopic(t, ch, !on)}
            >
              <span />
              <span className="hg-listrow__text">
                <span className="hg-listrow__label">
                  {copy.carePoints[t as keyof typeof copy.carePoints]}
                </span>
              </span>
              <span className={on ? 'hg-check is-on' : 'hg-check'} aria-hidden="true" />
              <span />
            </button>
          );
        })}
      </div>
    </section>
  );

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.rows.noti}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <p className="hg-help" style={{ margin: 0 }}>
        {copy.cap}
      </p>
      <section className="hg-card hg-stack" aria-label={copy.channels}>
        <span className="hg-card__label">{copy.channels}</span>
        {desktop && (
          <Toggle
            label={copy.push}
            checked={prefs.push}
            onChange={(on) => void setChannel('push', on)}
          />
        )}
        <Toggle
          label={copy.email}
          checked={prefs.email}
          onChange={(on) => void setChannel('email', on)}
        />
        {confirm && (
          <div className="hg-stack" role="alertdialog" aria-label={copy.noChannel}>
            <b>{copy.noChannel}</b>
            <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const ch = confirm;
                  setConfirm(null);
                  void save({ ...prefs, [ch]: false });
                }}
              >
                {copy.turnOff}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>
                {copy.cancel}
              </Button>
            </div>
          </div>
        )}
      </section>
      <div className="hg-list">
        <ListRow
          label={copy.quiet}
          value={copy.quietValue(hourLabel(me.quiet_start ?? 22), hourLabel(me.quiet_end ?? 8))}
          onClick={() => nav('/settings/notifications/quiet')}
        />
      </div>
      {channels.map(channelCard)}
      {/* 5번 마케팅 정보 받기(기본 꺼짐, 켜면 “{날짜} 동의”). 2026-11-04 다른 묶음처럼 카드 안에 */}
      <div className="hg-card">
        <Toggle
          label={copy.marketing}
          checked={!!marketing.data?.agreed}
          help={
            marketing.data?.agreed
              ? copy.marketingAt(formatDateFull(todayKst(new Date(marketing.data.at))))
              : undefined
          }
          onChange={(on) =>
            void setMarketing(me.id, on, TERMS_VERSION)
              .then(() => qc.invalidateQueries({ queryKey: ['consent', 'marketing'] }))
              .catch(() => toast(copy.failed))
          }
        />
      </div>
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
