import {
  fetchMarketing,
  fetchSplits,
  qk,
  registerPushDevice,
  setMarketing,
  setPushKinds,
  updateMe,
  type Me,
} from '@sweetwo/api';
import {
  isNonManager,
  pushKindOn,
  type PushKind,
  formatDateFull,
  notiPrefs,
  CONSENT_VERSIONS,
  todayKst,
  type NotiPrefs,
  type NotiTopic,
} from '@sweetwo/core';
import { Button, ListRow, PageHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sharedCopy } from '../../../shared/copy';
import { toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy, hourLabel } from '../copy';
import { usePushPermission } from '../push-status';
import { useSettingsData } from '../data';

// S-14 알림(docs/spec/25-settings.md). 2026-11-04 이메일은 자동 예비로만이라 이메일 설정 없음.
// 카드 ‘푸시 알림’(켜고 끄기) + 묶음 줄마다 토글 + 경조사 미리 알림 체크 목록, 방해 금지 시간(→ S-14a). 바뀌면 바로 저장.
// 센터 기록은 설정과 상관없이 남음. 끌 수 없는 종류(보안·결정 기한)는 목록에 없음.
// 마케팅 정보 받기(기본 꺼짐): 켜고 끌 때마다 동의 기록(consent, 추가만), 켜면 “{날짜} 동의”.
// 모바일 앱에서 휴대폰 알림 권한이 꺼져 있으면(브리지 push.status) “휴대폰 설정에서 알림을 켜 주세요” + ‘설정 열기’, 푸시 토글은 꺼짐으로.
// 푸시가 꺼져 있으면 묶음 줄·경조사 체크도 꺼짐으로 보임(저장된 묶음 값은 그대로, 2026-11-12 QA 11구간 S11-04).
// v2.2(2026-11-13): ‘알림 종류’ = P-11과 같은 목록(app_user.push_kinds: care, payday(손 줄이 있을 때만), achieved,
// shared_change(같이 계열만, 관리하지 않는 쪽 기본 끔), my_allowance(관리하지 않는 쪽만), progress_news) + 잠금 화면 한 줄.
// 같은 일을 하는 옛 묶음(plan, partner_change, goal)도 같은 값으로 맞춤(서버 claim_push가 둘 다 봄).
// 금융 일정·파트너 초대와 경조사 시점은 ‘그 밖의 알림’으로 그대로.
const KIND_TOPIC: Partial<Record<PushKind, NotiTopic>> = {
  payday: 'plan',
  shared_change: 'partner_change',
  achieved: 'goal',
};
const CARE: NotiTopic[] = ['care_30', 'care_14', 'care_7', 'care_0'];

export function S14Notifications() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const marketing = useQuery({ queryKey: ['consent', 'marketing'], queryFn: fetchMarketing });
  const splits = useQuery({ queryKey: qk.splits, queryFn: fetchSplits });
  // 휴대폰 알림 권한(모바일 앱만, S-10 요약과 같은 값). 설정 앱에서 바꾸고 돌아오면 다시 읽음
  const [perm, setPerm] = usePushPermission();
  const osDenied = perm === 'denied';
  // 관리하지 않는 쪽은 ‘같이 쓰는 걸 바꿨을 때’ 기본 끔(18 P-11 표). 서버는 없는 키 = 켬이라 한 번 적어 둠
  const nonManagerMe = !!d.me && !!d.space && isNonManager(d.space, d.me.id);
  const kindsRaw = (d.me?.push_kinds ?? {}) as Record<string, boolean>;
  useEffect(() => {
    if (!d.me || !nonManagerMe || 'shared_change' in kindsRaw) return;
    void setPushKinds(d.me.id, kindsRaw, { shared_change: false })
      .then(() => qc.invalidateQueries({ queryKey: qk.me }))
      .catch(() => undefined);
  }, [d.me?.id, nonManagerMe]); // eslint-disable-line react-hooks/exhaustive-deps
  if (d.loading || !d.me || !d.c || !d.space) return <LoadingFrame sub="settings" current={null} />;
  const prefs = notiPrefs(d.me.noti_prefs);
  // 보이는 푸시 상태: 내 설정이 켜져 있고 휴대폰도 허용
  // 아직 허용하지 않았으면(‘나중에 할게요’로 건너뜀) 꺼짐으로 보임. 켜면 OS 허용을 물음(R7)
  const pushOn = prefs.push && !osDenied && perm !== 'prompt';
  const openOsSettings = window.sweetwo?.push?.openSettings;
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
  const kinds = kindsRaw;
  const joint = d.space.salary_mode === 'joint';
  // 손 줄(체크리스트에 넣고 자동이 아닌 줄)이 있는 월급 계획(내 것 또는 공동)
  const manual = (splits.data ?? []).some(
    (sp) =>
      (sp.owner_user_id === me.id || sp.owner_user_id === null) &&
      sp.split_line.some((l) => l.in_checklist && !l.auto_pay && l.amount > 0),
  );
  const setKind = async (k: PushKind, on: boolean) => {
    qc.setQueryData<Me | null>(qk.me, (m) =>
      m ? { ...m, push_kinds: { ...kinds, [k]: on } as never } : m,
    );
    try {
      await setPushKinds(me.id, kinds, { [k]: on });
      const t = KIND_TOPIC[k];
      if (t)
        await updateMe({
          noti_prefs: {
            ...prefs,
            topics: { ...prefs.topics, [t]: { ...prefs.topics[t], push: on } },
          } as never,
        });
    } catch {
      toast(copy.failed);
    } finally {
      await qc.invalidateQueries({ queryKey: qk.me });
    }
  };
  const kindRow = (k: PushKind, label: string, help?: string) => (
    <Toggle
      key={k}
      label={label}
      help={help}
      checked={pushOn && pushKindOn(kinds, k)}
      disabled={!pushOn}
      onChange={(on) => setKind(k, on)}
    />
  );
  const setTopic = (t: NotiTopic, on: boolean) =>
    void save({ ...prefs, topics: { ...prefs.topics, [t]: { ...prefs.topics[t], push: on } } });
  const setPush = async (on: boolean) => {
    // 모바일: 푸시를 켜면 OS 허용부터(거절했으면 휴대폰 설정에서)
    const push = window.sweetwo?.push;
    if (on && push && (await push.status()) !== 'granted') {
      if (!(await push.request())) return setPerm('denied');
      setPerm('granted');
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
      checked={pushOn && prefs.topics[t].push}
      disabled={!pushOn}
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
          help={pushOn ? undefined : copy.pushOffHelp}
          checked={pushOn}
          onChange={(on) => setPush(on)}
        />
        {osDenied && (
          <div
            className="hg-row"
            style={{ gap: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <p className="hg-help" style={{ margin: 0 }}>
              {copy.pushDenied}
            </p>
            {openOsSettings && (
              <Button variant="secondary" size="sm" onClick={() => void openOsSettings()}>
                {copy.openOsSettings}
              </Button>
            )}
          </div>
        )}
      </section>
      <section className="hg-card hg-stack" aria-label={copy.notiTopics} style={{ gap: 0 }}>
        <span className="hg-card__label">{copy.notiTopics}</span>
        {kindRow('care', copy.kinds.care, copy.kindsHelp.care)}
        {manual && kindRow('payday', copy.kinds.payday)}
        {kindRow('achieved', copy.kinds.achieved)}
        {joint && c.joined && kindRow('shared_change', copy.kinds.shared_change(c.partnerName))}
        {nonManagerMe && kindRow('my_allowance', copy.kinds.my_allowance)}
        {kindRow(
          'progress_news',
          copy.kinds.progress_news,
          copy.kindsHelp.progress_news(!!me?.payday_none),
        )}
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.lockScreenNote}
        </p>
        <span className="hg-card__label" style={{ marginTop: 'var(--space-4)' }}>
          {copy.otherAlerts}
        </span>
        {topicRow('money', copy.groups.money)}
        {topicRow('invite', copy.groups.invite)}
        <span className="hg-card__label" style={{ marginTop: 'var(--space-4)' }}>
          {copy.careAlerts}
        </span>
        {/* 경조사는 시점 체크 목록(Y-05 미리 알림과 같은 모양) */}
        <div className="hg-list hg-list--plain" role="group" aria-label={copy.careAlerts}>
          {CARE.map((t) => {
            const on = pushOn && prefs.topics[t].push;
            return (
              <button
                key={t}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!pushOn}
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
            void setMarketing(me.id, on, CONSENT_VERSIONS.marketing)
              .then(() => {
                // 결과 통지(31 5-1): 날짜 + 동의·거부 + 보낸 곳. 알림 센터에도 남음(서버)
                toast(sharedCopy.marketingResult(on, formatDateFull(todayKst())));
                return qc.invalidateQueries({ queryKey: ['consent', 'marketing'] });
              })
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
