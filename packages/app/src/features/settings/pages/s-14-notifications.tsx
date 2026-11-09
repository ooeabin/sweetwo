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
import { ListRow, PageHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy, hourLabel } from '../copy';
import { useSettingsData } from '../data';

// S-14 알림(docs/spec/25-settings.md). 2026-11-04 이메일은 자동 예비로만이라 이메일 설정 없음.
// 카드 ‘푸시 알림’(켜고 끄기) + 묶음 줄마다 토글 + 경조사 미리 알림 체크 목록, 방해 금지 시간(→ S-14a). 바뀌면 바로 저장.
// 센터 기록은 설정과 상관없이 남음. 끌 수 없는 종류(보안·결정 기한)는 목록에 없음.
// 마케팅 정보 받기(기본 꺼짐): 켜고 끌 때마다 동의 기록(consent, 추가만), 켜면 “{날짜} 동의”.
const CARE: NotiTopic[] = ['care_30', 'care_14', 'care_7', 'care_0'];

export function S14Notifications() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const marketing = useQuery({ queryKey: ['consent', 'marketing'], queryFn: fetchMarketing });
  if (d.loading || !d.me || !d.c) return <LoadingFrame sub="settings" current={null} />;
  const prefs = notiPrefs(d.me.noti_prefs);
  const me = d.me;
  const c = d.c;

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
  const setTopic = (t: NotiTopic, on: boolean) =>
    void save({ ...prefs, topics: { ...prefs.topics, [t]: { ...prefs.topics[t], push: on } } });
  const setPush = async (on: boolean) => {
    // 모바일: 푸시를 켜면 OS 허용부터(거절했으면 휴대폰 설정에서)
    const push = window.sweetwo?.push;
    if (on && push && (await push.status()) !== 'granted') {
      if (!(await push.request())) return toast(copy.pushDenied);
      const t = await push.token();
      const pf = window.sweetwo?.platform;
      if (t && (pf === 'ios' || pf === 'android'))
        await registerPushDevice(pf, t, window.sweetwo?.appVersion ?? '').catch(() => undefined);
    }
    await save({ ...prefs, push: on });
  };
  const topicRow = (t: NotiTopic, label: string, sub?: string) => (
    <Toggle
      key={t}
      label={label}
      help={sub}
      checked={prefs.topics[t].push}
      disabled={!prefs.push}
      onChange={(on) => setTopic(t, on)}
    />
  );

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.rows.noti}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <section className="hg-card hg-stack" aria-label={copy.push} style={{ gap: 0 }}>
        <Toggle
          label={<b>{copy.push}</b>}
          help={prefs.push ? undefined : copy.pushOffHelp}
          checked={prefs.push}
          onChange={(on) => setPush(on)}
        />
      </section>
      <section className="hg-card hg-stack" aria-label={copy.notiTopics} style={{ gap: 0 }}>
        <span className="hg-card__label">{copy.notiTopics}</span>
        {topicRow('plan', copy.groups.plan)}
        {c.joined &&
          topicRow(
            'partner_change',
            copy.groups.partner_change(c.partnerName),
            copy.partnerChangeSub,
          )}
        {topicRow('money', copy.groups.money)}
        {topicRow('goal', copy.groups.goal)}
        {topicRow('invite', copy.groups.invite)}
        <span className="hg-card__label" style={{ marginTop: 'var(--space-4)' }}>
          {copy.careAlerts}
        </span>
        {/* 경조사는 시점 체크 목록(Y-05 미리 알림과 같은 모양) */}
        <div className="hg-list hg-list--plain" role="group" aria-label={copy.careAlerts}>
          {CARE.map((t) => {
            const on = prefs.topics[t].push;
            return (
              <button
                key={t}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!prefs.push}
                className="hg-listrow"
                onClick={() => setTopic(t, !on)}
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
      <div className="hg-list">
        <ListRow
          label={copy.quiet}
          value={copy.quietValue(hourLabel(me.quiet_start ?? 22), hourLabel(me.quiet_end ?? 8))}
          onClick={() => nav('/settings/notifications/quiet')}
        />
      </div>
      {/* 5번 마케팅 정보 받기(기본 꺼짐, 켜면 “{날짜} 동의”) */}
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
      <p className="hg-help" style={{ margin: 0 }}>
        {copy.mailNote}
      </p>
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
