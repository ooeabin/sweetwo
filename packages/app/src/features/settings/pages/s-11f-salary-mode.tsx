import { qk, setSalaryMode } from '@sweetwo/api';
import { addDays, formatMonthDay } from '@sweetwo/core';
import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { quietly, toast } from '../../../shared/toast';
import { myChecklist, useChecklists } from '../../salary';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Mode = 'separate' | 'joint';

// S-11f 월급 관리 방식(Q1, O-30과 같음): 바꾸면 둘 다에게 적용(월급 계획 합치기·나누기는 서버) + 상대 알림 + Toast ‘되돌리기’
// → 바로 새 월급 계획 확인(W-01). 체크리스트는 다음 월급날부터 새 방식, 저금 항목의 모은 금액은 그대로. 연결 해제 대기 중에는 못 바꿈.
export function S11fSalaryMode() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [v, setV] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);
  const lists = useChecklists();
  if (d.loading || !d.space) return <QuestionSkeleton />;
  const saved: Mode = d.space.salary_mode;
  const value = v ?? saved;
  const locked = d.space.couple_state === 'unlink_pending';
  // 미리보기 날짜 = 지금 내(합쳐서면 공동) 체크리스트 다음 시작일(기간 끝 다음 날, 2026-11-09 round 3)
  const cur = myChecklist(lists.data, saved === 'joint' ? undefined : d.me?.id);
  const when = cur ? formatMonthDay(addDays(cur.cycle_end, 1)) : copy.nextPayday;
  const preview = value !== saved && !locked ? copy.salaryModePreview[value](when) : undefined;
  const refresh = () =>
    Promise.all(
      [qk.space, qk.splits, ['pay_checklist']].map((k) => qc.invalidateQueries({ queryKey: k })),
    );
  const save = async () => {
    if (saving || value === saved || locked) return;
    setSaving(true);
    try {
      if ((await setSalaryMode(value)) === 'unlink_pending') {
        toast(copy.unlinkPendingLocked);
        return;
      }
      track('salary_mode_changed', {
        from: saved === 'joint' ? 'combined' : 'separate',
        to: value === 'joint' ? 'combined' : 'separate',
        entry: 's11f',
      });
      await refresh();
      toast(copy.salaryModeSaved, {
        label: copy.undo,
        onClick: () => quietly(setSalaryMode(saved).then(refresh)),
      });
      nav('/salary/split', { replace: true });
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.salaryModeQ}
      help={locked ? copy.unlinkPendingLocked : copy.salaryModeHelp}
      onBack={() => nav('/settings/me')}
      note={preview}
      primary={{ label: copy.save, disabled: value === saved || locked, loading: saving }}
      onSubmit={() => void save()}
    >
      <ChoiceCards<Mode>
        label={copy.salaryModeQ}
        value={value}
        onChange={setV}
        autoAdvance={false}
        options={(['separate', 'joint'] as const).map((k) => ({
          value: k,
          label: copy.salaryModes[k],
          // 2026-11-08 온보딩과 같은 선택지 아이콘 자리(지금은 빈 자리, Illustrations ‘나중 과제’ 5번)
          icon: k === 'separate' ? 'user' : 'users-three',
          disabled: locked,
        }))}
      />
    </QuestionLayout>
  );
}
