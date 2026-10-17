import { insertCareDays, qk } from '@sweetwo/api';
import { QuestionLayout, Toggle } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useCalendarData } from '../data';
import { badMonthDay, MonthDayFields, type MonthDay } from '../date-fields';

const DISMISS_KEY = 'sweetwo.partner-birthday-later';
/** ‘나중에 할게요’를 눌렀는지(Y-01 묻기 카드, 기기에만) */
export const partnerBirthdayDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

// 서프라이즈 1번(docs/spec/24-calendar.md ‘서프라이즈 일정’): “{배우자}님 생일은 언제예요?” 단독 질문(진행 막대 없음),
// 월·일 + 양력/음력. 2번 “{배우자}님에게 숨기기” 기본 켜짐 → 만든 사람만 보는 ‘우리 둘’ 매년 날(서버가 배우자에게 안 보냄).
// 챙길 사람 = 나, 쓸 돈 0원(Y-05에서). 혼자 쓰기면 묻지 않음.
export function YSurprisePartnerBirthday() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const c = useCalendarData();
  const [v, setV] = useState<MonthDay>({ month: null, day: null, lunar: false, leap: false });
  const [hide, setHide] = useState(true);
  const [saving, setSaving] = useState(false);
  if (c.loading) return null;
  const partner = c.couple?.partnerName ?? '';
  if (!c.couple || c.couple.solo || !c.me) return <Navigate to="/calendar/list" replace />;
  const ok = v.month !== null && v.day !== null && !badMonthDay(v);
  const title = copy.partnerBirthdayQ(partner);

  const save = async () => {
    if (!ok || saving || !c.me) return;
    setSaving(true);
    try {
      await insertCareDays([
        {
          category: 'couple',
          kind: 'partner_birthday',
          name: copy.partnerBirthday(partner),
          date_rule: v.lunar ? 'lunar_yearly' : 'solar_yearly',
          month: v.month,
          day: v.day,
          leap: v.leap,
          carer: c.me.side === 'bride' ? 'bride' : 'groom',
          secret: hide,
        },
      ]);
      await qc.invalidateQueries({ queryKey: qk.careDays });
      toast(copy.saved);
      nav('/calendar/list', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={title}
      onBack={() => nav(-1)}
      later={{
        label: copy.later,
        onClick: () => {
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch {
            /* 기억 못 해도 됨 */
          }
          nav('/calendar/list', { replace: true });
        },
      }}
      primary={{ label: copy.save, disabled: !ok, loading: saving }}
      onSubmit={() => void save()}
    >
      <MonthDayFields label={title} value={v} onChange={(p) => setV((x) => ({ ...x, ...p }))} />
      <Toggle label={copy.hideFrom(partner)} checked={hide} onChange={setHide} />
    </QuestionLayout>
  );
}
