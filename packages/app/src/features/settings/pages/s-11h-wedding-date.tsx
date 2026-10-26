import { qk, updateSpace } from '@sweetwo/api';
import { todayKst } from '@sweetwo/core';
import { DateInput, QuestionLayout, YearMonthInput } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Status = 'married' | 'engaged';

// S-11h 결혼한 날·예정일(Q4, O-12와 같음): 했어요는 오늘까지, 준비 중은 내일부터, 준비 중만 ‘아직 미정이에요’ → 예정 연·월.
// S-11g에서 상태를 바꿨으면 ?status=로 와서 상태와 날짜를 함께 저장. 저장 = Toast ‘되돌리기’(상대 알림은 서버),
// 결혼한 날을 넣거나 바꾸면 캘린더 결혼기념일은 서버(sync_wedding_care)가 만들거나 옮김.
export function S11hWeddingDate() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const d = useSettingsData();
  const [date, setDate] = useState<string | null | undefined>(undefined);
  const [month, setMonth] = useState<string | null | undefined>(undefined);
  const [undecided, setUndecided] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.space) return null;
  const sp = d.space;
  const param = params.get('status');
  const status: Status =
    param === 'married' || param === 'engaged' ? param : (sp.marriage_status ?? 'married');
  const changedStatus = status !== sp.marriage_status;
  const engaged = status === 'engaged';
  const today = todayKst();
  const dv = date === undefined ? (changedStatus ? null : sp.wedding_date) : date;
  const mv =
    month === undefined
      ? !changedStatus && sp.wedding_month
        ? sp.wedding_month.slice(0, 7)
        : null
      : month;
  const isUndecided =
    engaged && (undecided ?? (!changedStatus && !!sp.wedding_month && !sp.wedding_date));
  const rangeError =
    dv && (engaged ? dv <= today : dv > today)
      ? engaged
        ? copy.futureOnly
        : copy.pastOnly
      : undefined;
  const monthError = mv && mv < today.slice(0, 7) ? copy.futureOnly : undefined;
  const title = engaged ? copy.weddingPlannedQ : copy.weddingDoneQ;

  const save = async (patch: {
    wedding_date: string | null;
    wedding_month: string | null;
    wedding_date_estimated: boolean;
  }) => {
    if (saving) return;
    const before = {
      marriage_status: sp.marriage_status,
      wedding_date: sp.wedding_date,
      wedding_month: sp.wedding_month,
      wedding_date_estimated: sp.wedding_date_estimated,
    };
    setSaving(true);
    try {
      await updateSpace({ marriage_status: status, ...patch });
      await Promise.all([qk.space, qk.careDays].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(copy.saved, {
        label: copy.undo,
        onClick: () =>
          void updateSpace(before).then(() => qc.invalidateQueries({ queryKey: qk.space })),
      });
      nav('/settings/me', { replace: true });
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };

  if (isUndecided)
    return (
      <QuestionLayout
        title={copy.whenPlanned}
        onBack={() => setUndecided(false)}
        primary={{ label: copy.save, disabled: !mv || !!monthError, loading: saving }}
        onSubmit={() =>
          mv &&
          void save({ wedding_date: null, wedding_month: `${mv}-01`, wedding_date_estimated: true })
        }
      >
        <YearMonthInput
          label={copy.whenPlanned}
          value={mv}
          onChange={setMonth}
          error={monthError}
        />
      </QuestionLayout>
    );
  return (
    <QuestionLayout
      title={title}
      onBack={() => nav(changedStatus ? '/settings/me/marriage' : '/settings/me')}
      primary={{ label: copy.save, disabled: !dv || !!rangeError, loading: saving }}
      onSubmit={() =>
        dv && void save({ wedding_date: dv, wedding_month: null, wedding_date_estimated: false })
      }
    >
      <DateInput label={title} value={dv} onChange={(v) => setDate(v)} error={rangeError} />
      {engaged && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setUndecided(true)}
        >
          {copy.undecided}
        </button>
      )}
    </QuestionLayout>
  );
}
