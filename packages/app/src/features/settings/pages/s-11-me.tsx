import { fetchAvatars, qk, removeAvatar, updateMe, updateSpace } from '@sweetwo/api';
import {
  coupleBaseDay,
  formatDateFull,
  formatManWon,
  NotifyEmail,
  type BaseDay,
} from '@sweetwo/core';
import { Button, Field, Icon, ListRow, PageHeader, SectionHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { session } from '../../auth';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11 내 정보와 월급(25, 재기획): 프로필 사진(→ S-11e), 이름(→ S-11a), 로그인, 알림 이메일(그 자리에서 수정),
// 결혼 상태(→ S-11g), 결혼한 날·예정일(→ S-11h), 출생연도(→ S-11i).
// 월급: 내 월급(→ S-11c, 합류 뒤 배우자 값 보기만), 관리 방식(→ S-11f, 혼자 쓰기면 숨김), 체크리스트 만드는 날(→ S-11d, 합쳐서 + 합류),
// 주말·공휴일 앞당기기(부부 공통, 바로), 월급 분배표 열기(→ W-01), 로그아웃. 해제 대기 중엔 관리 방식·만드는 날 비활성.
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
  const later = coupleBaseDay(c);
  const base: BaseDay | null =
    sp.joint_cycle_day === null ? later : sp.joint_cycle_day === 31 ? 'last' : sp.joint_cycle_day;
  const dayText = (x: BaseDay | null) =>
    x === null ? '' : x === 'last' ? copy.lastDay : copy.dayN(x);
  const man = (v: number | null) => (v === null ? '' : `${formatManWon(v)} 원`);
  const locked = sp.couple_state === 'unlink_pending';
  const married = sp.marriage_status === 'married';
  const weddingText = sp.wedding_date
    ? formatDateFull(sp.wedding_date)
    : sp.wedding_month
      ? copy.weddingPlannedMonth(
          Number(sp.wedding_month.slice(0, 4)),
          Number(sp.wedding_month.slice(5, 7)),
        )
      : copy.undecidedValue;

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
      <PageHeader
        title={copy.me}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
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
        {sp.marriage_status && (
          <ListRow
            label={copy.marriage}
            value={copy.marriageValue[sp.marriage_status]}
            onClick={() => nav('/settings/me/marriage')}
          />
        )}
        {sp.marriage_status && (
          <ListRow
            label={copy.weddingDay[married ? 'married' : 'engaged']}
            value={weddingText}
            onClick={() => nav('/settings/me/wedding')}
          />
        )}
        <ListRow
          label={copy.birthYearRow}
          value={me.birth_year ? copy.birthYearValue(me.birth_year) : ''}
          onClick={() => nav('/settings/me/birth-year')}
        />
      </div>
      <section className="hg-stack" aria-label={copy.salaryGroup}>
        <SectionHeader title={copy.salaryGroup} />
        <div className="hg-list">
          <ListRow
            label={
              <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                {copy.mySalary}
                {me.income_variable && <span className="hg-tag">{copy.variable}</span>}
              </span>
            }
            sub={
              c.joined
                ? copy.partnerSalary(c.partnerName, man(c.partnerIncome), dayText(c.partnerPayday))
                : undefined
            }
            value={copy.salaryValue(man(me.monthly_income ?? 0), dayText(c.myPayday))}
            onClick={() => nav('/settings/me/salary')}
          />
          {!c.solo && (
            <ListRow
              label={copy.salaryMode}
              sub={locked ? copy.unlinkPendingLocked : undefined}
              value={copy.salaryModeValue[sp.salary_mode]}
              onClick={locked ? undefined : () => nav('/settings/me/salary-mode')}
            />
          )}
          {/* 합쳐서 + 배우자 합류일 때만(고를 날이 두 월급날) */}
          {sp.salary_mode === 'joint' && c.joined && (
            <ListRow
              label={copy.planDay}
              value={
                <>
                  {dayText(base)}
                  {base !== null && base === later && (
                    <span className="hg-tag" style={{ marginLeft: 'var(--space-2)' }}>
                      {copy.laterPayday}
                    </span>
                  )}
                </>
              }
              onClick={locked ? undefined : () => nav('/settings/me/plan-day')}
            />
          )}
        </div>
        <Toggle
          label={copy.holidayShift}
          checked={sp.holiday_shift}
          onChange={async (on) => {
            try {
              await updateSpace({ holiday_shift: on });
              await qc.invalidateQueries({ queryKey: qk.space });
            } catch {
              toast(copy.failed);
            }
          }}
        />
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => nav('/salary/split')}
        >
          {copy.openSplit}
        </button>
      </section>
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
