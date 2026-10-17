import { qk, updateMe, updateSpace } from '@sweetwo/api';
import { coupleBaseDay, NotifyEmail, spaceBaseDay } from '@sweetwo/core';
import { Button, Field, ListRow, PageHeader, Toggle } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { session } from '../../auth';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11 내 정보(docs/spec/25-settings.md): 호칭(→ S-11a), 로그인, 알림 이메일(그 자리에서 수정), 월급 플랜 날짜(보기,
// 바꾸기 S-11d는 제안과 함께 다음 단계), 주말·공휴일 앞당기기(부부 공통, 바로), 분담 방식(보기), 로그아웃.
// 프로필 사진(S-11e), 신랑·신부(S-11b), 비상금 기준, 남는 돈 넣을 목표, 배우자 대신 입력은 다음 단계.
export function S11Me() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [email, setEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me || !d.c || !d.space) return <MainFrame current={null} columns={[null]} />;
  const { me, c, space: sp } = d;
  const value = email ?? me.notify_email ?? '';
  const parsed = NotifyEmail.safeParse(value);
  const changed = parsed.success && parsed.data !== me.notify_email;
  const base = spaceBaseDay(sp, c);
  const later = base !== null && base === coupleBaseDay(c) && c.joined;
  const ratio = (() => {
    if (sp.split_mode === 'income' && c.myIncome && c.partnerIncome) {
      const mine = Math.round((c.myIncome * 100) / (c.myIncome + c.partnerIncome));
      return [mine, 100 - mine] as const;
    }
    if (sp.split_mode === 'custom') return [c.myRatio, 100 - c.myRatio] as const;
    return [50, 50] as const;
  })();

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
        />
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
