import { fetchAvatars, qk, removeAvatar, updateMe, updateSpace } from '@sweetwo/api';
import { coupleBaseDay, NotifyEmail, spaceBaseDay, splitPercent } from '@sweetwo/core';
import { Button, Field, Icon, ListRow, PageHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { session } from '../../auth';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11 내 정보(docs/spec/25-settings.md): 호칭(→ S-11a), 신랑·신부(→ S-11b), 로그인, 알림 이메일(그 자리에서 수정),
// 월급 플랜 날짜(→ S-11d, 합류한 부부만), 주말·공휴일 앞당기기(부부 공통, 바로), 분담 방식(보기), 로그아웃.
// 프로필 사진(1번 → S-11e). 비상금 기준, 남는 돈 넣을 목표, 배우자 대신 입력은 다음 단계.
export function S11Me() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [email, setEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const avatars = useQuery({ queryKey: qk.avatars, queryFn: fetchAvatars });
  if (d.loading || !d.me || !d.c || !d.space) return <MainFrame current={null} columns={[null]} />;
  const { me, c, space: sp } = d;
  const value = email ?? me.notify_email ?? '';
  const parsed = NotifyEmail.safeParse(value);
  const changed = parsed.success && parsed.data !== me.notify_email;
  const base = spaceBaseDay(sp, c);
  const later = base !== null && base === coupleBaseDay(c) && c.joined;
  const pct = splitPercent(sp.split_mode, c.myIncome, c.partnerIncome, c.myRatio);
  const ratio = [pct, 100 - pct] as const;

  const photo = avatars.data?.[me.id] ?? null;
  const clearPhoto = async () => {
    if (!me.space_id) return;
    try {
      await removeAvatar(me.space_id, me.id);
      await qc.invalidateQueries({ queryKey: qk.avatars });
      toast(copy.photoRemoved);
    } catch {
      toast(copy.failed);
    }
  };

  const saveEmail = async () => {
    if (!parsed.success || saving) return;
    setSaving(true);
    try {
      await updateMe({ notify_email: parsed.data });
      await qc.invalidateQueries({ queryKey: qk.me });
      setEmail(null);
      toast(copy.saved);
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.me} backLabel={copy.back} onBack={() => nav('/settings')} />
      {/* 1번 프로필 사진: 사진 있으면 사진, 없으면 이름 첫 글자. 바꾸기 → S-11e, 지우기는 바로 */}
      <div className="hg-row" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
        <span className="hg-avatar-edit">
          {photo ? (
            <span className="hg-avatar hg-avatar--xl hg-avatar--photo">
              <img src={photo} alt={c.myName} />
            </span>
          ) : (
            <span
              className={`hg-avatar hg-avatar--xl ${c.starter ? 'hg-avatar--p1' : 'hg-avatar--p2'}`}
              aria-hidden="true"
            >
              {c.myName.slice(0, 1)}
            </span>
          )}
          <button
            type="button"
            className="hg-avatar-edit__btn"
            aria-label={copy.photoChange}
            onClick={() => nav('/settings/me/photo')}
          >
            <Icon name="camera" />
          </button>
        </span>
        {photo && (
          <Button variant="ghost" size="sm" onClick={() => void clearPhoto()}>
            {copy.photoRemove}
          </Button>
        )}
      </div>
      <div className="hg-list">
        <ListRow
          label={copy.nickname}
          value={c.myName}
          onClick={() => nav('/settings/me/nickname')}
        />
        <ListRow
          label={copy.sideRow}
          value={me.side === 'groom' || me.side === 'bride' ? copy.sides[me.side] : ''}
          onClick={() => nav('/settings/me/side')}
        />
        <ListRow label={copy.loggedIn(copy.providers[me.provider ?? ''] ?? '')} chevron={false} />
      </div>
      <form
        className="hg-row"
        style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault();
          void saveEmail();
        }}
      >
        <div style={{ flex: 1 }}>
          <Field
            label={copy.notifyEmail}
            type="email"
            autoComplete="email"
            value={value}
            onChange={(e) => setEmail(e.target.value)}
            error={value.trim() && !parsed.success ? copy.emailError : undefined}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={!changed || saving}>
          {copy.save}
        </Button>
      </form>
      <div className="hg-list">
        {/* 배우자 미합류·혼자 쓰기면 고를 날이 내 월급날 하나라 줄 숨김(S-11d 예외) */}
        {c.joined && (
          <ListRow
            label={copy.planDay}
            value={
              <>
                {base === null ? '' : base === 'last' ? copy.lastDay : copy.dayN(base)}
                {later && (
                  <span className="hg-tag" style={{ marginLeft: 'var(--space-2)' }}>
                    {copy.laterPayday}
                  </span>
                )}
              </>
            }
            onClick={() => nav('/settings/me/plan-day')}
          />
        )}
        {!c.solo && (
          <ListRow
            label={copy.split}
            value={copy.splitValue(
              copy.splitModes[sp.split_mode ?? 'half'] ?? copy.splitModes.half,
              ratio[0],
              ratio[1],
            )}
          />
        )}
      </div>
      <Toggle
        label={copy.holidayShift}
        checked={sp.holiday_shift}
        onChange={async (on) => {
          try {
            await updateSpace({ holiday_shift: on });
            await Promise.all(
              [qk.space, ['monthly_plan']].map((k) => qc.invalidateQueries({ queryKey: k })),
            );
          } catch {
            toast(copy.failed);
          }
        }}
      />
      <Button
        variant="secondary"
        style={{ alignSelf: 'flex-start' }}
        onClick={async () => {
          await session.signOut();
          qc.clear();
          toast(copy.loggedOut);
          nav('/login', { replace: true });
        }}
      >
        {copy.logout}
      </Button>
    </div>
  );
  return <MainFrame current={null} columns={[body]} />;
}
