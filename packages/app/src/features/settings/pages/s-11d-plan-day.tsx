import { qk, setJointCycleDay } from '@sweetwo/api';
import { coupleBaseDay, type BaseDay } from '@sweetwo/core';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

const key = (d: BaseDay) => (d === 'last' ? 'last' : String(d));
const label = (d: BaseDay) => (d === 'last' ? copy.lastDay : copy.dayN(d));

// S-11d 체크리스트 만드는 날(Q1, 합쳐서 + 배우자 합류만): 찬우 월급날 / 예빈 월급날, 기본 = 늦은 날.
// 바로 적용 + 상대 알림(서버). 이번 사이클 끝 = 새 기준일 전날, 다음 체크리스트는 새 기준일에(07 3장). 해제 대기 중엔 못 바꿈.
export function S11dPlanDay() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [v, setV] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.c || !d.space) return null;
  const { c, space: sp } = d;
  const current: BaseDay | null =
    sp.joint_cycle_day === null ? coupleBaseDay(c) : sp.joint_cycle_day === 31 ? 'last' : sp.joint_cycle_day;
  const days = [
    c.myPayday !== null ? { day: c.myPayday, name: c.myName } : null,
    c.partnerPayday !== null ? { day: c.partnerPayday, name: c.partnerName } : null,
  ].filter((x): x is { day: BaseDay; name: string } => !!x);
  const options = days.filter((x, i) => days.findIndex((y) => key(y.day) === key(x.day)) === i);
  const cur = v ?? (current === null ? null : key(current));
  const chosen = options.find((x) => key(x.day) === cur);
  const locked = sp.couple_state === 'unlink_pending';
  const changed = !!chosen && cur !== (current === null ? null : key(current));

  return (
    <QuestionLayout
      title={copy.planDayQ}
      help={locked ? copy.unlinkPendingLocked : undefined}
      onBack={() => nav('/settings/me')}
      primary={{ label: copy.save, disabled: !changed || locked, loading: saving }}
      onSubmit={async () => {
        if (!chosen || !changed || saving || locked) return;
        setSaving(true);
        try {
          await setJointCycleDay(chosen.day === 'last' ? 31 : chosen.day);
          await Promise.all(
            [qk.space, ['pay_checklist']].map((k) => qc.invalidateQueries({ queryKey: k })),
          );
          toast(copy.planDaySaved);
          nav('/settings/me', { replace: true });
        } catch {
          toast(copy.failed);
        } finally {
          setSaving(false);
        }
      }}
    >
      <ChoiceCards<string>
        label={copy.planDayQ}
        value={cur}
        onChange={setV}
        autoAdvance={false}
        options={options.map((x) => ({
          value: key(x.day),
          label: copy.paydayOf(x.name, label(x.day)),
          disabled: locked,
        }))}
      />
    </QuestionLayout>
  );
}
