import { useState } from 'react';
import { fetchAvatars, qk, removeAvatar, updateSpace } from '@sweetwo/api';
import { coupleBaseDay, formatDateFull, formatManWon, type BaseDay } from '@sweetwo/core';
import { Button, Icon, ListRow, PageHeader, SectionHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { signOut } from '../../auth';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11 내 정보와 월급(25, 재기획): 프로필 사진(→ S-11e), 이름(→ S-11a), 로그인, 알림 이메일(→ S-11b),
// 결혼 상태(→ S-11g), 결혼한 날·예정일(→ S-11h), 출생연도(→ S-11i).
// 월급: 내 월급(→ S-11c, 합류 뒤 파트너 값 보기만), 관리 방식(→ S-11f, 혼자 쓰기면 숨김), 체크리스트 만드는 날(→ S-11d, 합쳐서 + 합류),
// 주말·공휴일 앞당기기(두 사람 공통, 바로), 월급 계획 열기(→ W-01, 목록 줄), 로그아웃(맨 아래 목록 줄). 해제 대기 중엔 관리 방식·만드는 날 비활성.
export function S11Me() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const avatars = useQuery({ queryKey: qk.avatars, queryFn: fetchAvatars });
  const [clearing, setClearing] = useState(false);
  if (d.loading || !d.me || !d.c || !d.space) return <LoadingFrame sub="settings" current={null} />;
  const { me, c, space: sp } = d;
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

  // 프로필 사진(직접 올린 사진 또는 처음 가져온 소셜 계정 사진). 없으면 이름 첫 글자(2026-11-05 지정 아바타 없앰)
  const photo = avatars.data?.photos[me.id] ?? null;
  const shown = photo;
  const clearPhoto = async () => {
    if (!me.space_id || clearing) return;
    setClearing(true);
    try {
      await removeAvatar(me.space_id, me.id);
      await qc.invalidateQueries({ queryKey: qk.avatars });
      track('profile_photo_changed', { action: 'remove' });
      toast(copy.photoRemoved);
    } catch {
      toast(copy.failed);
    } finally {
      setClearing(false);
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
      {/* 1번 프로필 사진: 사진 → 이름 첫 글자. 바꾸기 → S-11e, 지우기는 바로(이름 첫 글자로, 소셜 사진을 다시 가져오지 않음) */}
      <div className="hg-row" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
        <span
          className="hg-avatar-edit"
          // 1번: Avatar 자리에 사진을 끌어 놓으면 그 사진으로 S-11e(자르기)
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) nav('/settings/me/photo', { state: { file } });
          }}
        >
          {shown ? (
            <span className="hg-avatar hg-avatar--xl hg-avatar--photo">
              <img src={shown} alt={c.myName} />
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
          <Button variant="ghost" size="sm" loading={clearing} onClick={() => void clearPhoto()}>
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
        {/* 4번 알림 이메일: 2026-11-04 그 자리 입력칸 대신 줄 → S-11b */}
        <ListRow
          label={copy.notifyEmail}
          value={me.notify_email ?? ''}
          onClick={() => nav('/settings/me/email')}
        />
      </div>
      <div className="hg-list">
        {sp.marriage_status && (
          <ListRow
            label={copy.marriage}
            value={copy.marriageValue[sp.marriage_status]}
            onClick={() => nav('/settings/me/marriage')}
          />
        )}
        {sp.marriage_status && sp.marriage_status !== 'undecided' && (
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
          {/* 합쳐서 + 파트너 합류일 때만(고를 날이 두 월급날) */}
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
        {/* 10번 월급 계획: 2026-11-04 다른 줄과 같은 목록 줄로 */}
        <div className="hg-list">
          <ListRow label={copy.openSplit} onClick={() => nav('/salary?view=plan')} />
        </div>
      </section>
      {/* 11번 로그아웃: 2026-11-04 맨 아래 목록 줄 */}
      <div className="hg-list">
        <ListRow
          label={copy.logout}
          chevron={false}
          onClick={async () => {
            // 로그아웃은 하나로(쿼리 캐시, 기기 캐시, 가입 중 값, 돌아갈 화면까지, DEV_GUIDE ‘로그아웃’)
            await signOut();
            toast(copy.loggedOut);
            nav('/login', { replace: true });
          }}
        />
      </div>
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
