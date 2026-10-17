import { fetchProposals, propose, qk, saveBaseDay, updateSpace } from '@sweetwo/api';
import { formatMonthDay, proposalApplyOn, spaceBaseDay, type BaseDay } from '@sweetwo/core';
import { Button, ChoiceCards, QuestionLayout, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

const key = (d: BaseDay) => (d === 'last' ? 'last' : String(d));
const label = (d: BaseDay) => (d === 'last' ? copy.lastDay : copy.dayN(d));

// S-11d 월급 플랜 날짜(Q1): “월급 플랜을 언제 세울까요?” 찬우 월급날 / 예빈 월급날(기본 = 늦은 날).
// 배분 결정이라 연결된 부부는 제안(item base_day, 미합류·혼자 쓰기면 바로). 적용되면 지금 사이클 끝이 새 기준일 전날(07 1장).
// 기준일과 함께 ‘주말·공휴일 앞당기기’ 토글(부부 공통, 바로). 열린 제안이 있으면 G-08 ‘다르게 해볼래요’로만
export function S11dPlanDay() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const d = useSettingsData();
  const proposals = useQuery({ queryKey: qk.proposals, queryFn: fetchProposals });
  const [v, setV] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || proposals.isLoading || !d.c || !d.space) return null;
  const { c, space: sp } = d;
  const base = spaceBaseDay(sp, c);
  const days = [
    c.myPayday !== null ? { day: c.myPayday, name: c.myName } : null,
    c.joined && c.partnerPayday !== null ? { day: c.partnerPayday, name: c.partnerName } : null,
  ].filter((x): x is { day: BaseDay; name: string } => !!x);
  // 같은 날이면 하나만
  const options = days.filter((x, i) => days.findIndex((y) => key(y.day) === key(x.day)) === i);
  const cur = v ?? (base === null ? null : key(base));
  const open = (proposals.data ?? []).find((p) => p.item === 'base_day' && p.status === 'open');
  const blocked = !!open && params.get('differently') !== '1';
  const proposing = c.joined;
  const applyOn = base !== null ? proposalApplyOn(base) : null;
  const chosen = options.find((x) => key(x.day) === cur);
  const changed = !!chosen && cur !== (base === null ? null : key(base));

  const save = async () => {
    if (!chosen || !changed || saving || blocked) return;
    const after = {
      base_day: chosen.day === 'last' ? null : chosen.day,
      base_day_last: chosen.day === 'last',
    };
    setSaving(true);
    try {
      if (proposing) {
        if (!applyOn) throw new Error('no base');
        await propose('base_day', after, applyOn);
        toast(copy.proposed(c.partnerName));
      } else {
        await saveBaseDay(after);
      }
      await Promise.all(
        [qk.space, qk.proposals, ['monthly_plan']].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      );
      nav('/settings/me', { replace: true });
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={copy.planDayQ}
      help={proposing && applyOn && !blocked ? copy.applyNote(formatMonthDay(applyOn)) : undefined}
      onBack={() => nav('/settings/me')}
      primary={{
        label: proposing ? copy.proposeTo(c.partnerName) : copy.save,
        disabled: !changed || blocked,
        loading: saving,
      }}
      onSubmit={() => void save()}
    >
      {blocked && open ? (
        <div className="hg-stack">
          <span className="hg-help">{copy.openProposal}</span>
          <Button variant="secondary" size="sm" onClick={() => nav(`/proposals/${open.id}`)}>
            {copy.seeProposal}
          </Button>
        </div>
      ) : (
        <ChoiceCards<string>
          label={copy.planDayQ}
          value={cur}
          onChange={setV}
          autoAdvance={false}
          options={options.map((x) => ({
            value: key(x.day),
            label: copy.paydayOf(x.name, label(x.day)),
          }))}
        />
      )}
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
    </QuestionLayout>
  );
}
