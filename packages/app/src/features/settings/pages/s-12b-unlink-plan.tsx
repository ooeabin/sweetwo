import { addDays, formatMonthDay, splitPercent, todayKst, unlinkShare } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { ShareEditor, sharesBad, sharesOf, useJointAssets, useUnlinkDraft } from '../unlink';

// S-12b 자산 정리 안 작성: 기본안 = 분담 비율로 공동 명의 자산·부채마다 내 몫(1만 원 단위 반올림). 내 몫 0 ~ 금액,
// 상대 몫 = 금액 − 내 몫(자동), 합계 바로 갱신(자산, 부채 따로). 기한 = 오늘 + 14일. 다음 → S-12c
export function S12bUnlinkPlan() {
  const nav = useNavigate();
  const d = useSettingsData();
  const joint = useJointAssets();
  const draft = useUnlinkDraft();
  if (d.loading || !d.c || !d.space || joint.loading) return null;
  const c = d.c;
  const pct = splitPercent(d.space.split_mode, c.myIncome, c.partnerIncome, c.myRatio);
  const rows = sharesOf(
    joint.rows.map((a) => ({
      id: a.id,
      name: a.name,
      side: a.side,
      amount: a.amount,
      base: unlinkShare(a.amount, pct),
    })),
    draft.shares,
  );
  const bad = sharesBad(rows);
  return (
    <QuestionLayout
      steps={{ total: 3, now: 1 }}
      title={copy.planTitle(pct, 100 - pct)}
      help={copy.deadline(formatMonthDay(addDays(todayKst(), 14)))}
      onBack={() => nav('/settings/couple/unlink')}
      primary={{ label: copy.next, disabled: bad }}
      onSubmit={() => !bad && nav('/settings/couple/unlink/confirm')}
    >
      <ShareEditor rows={rows} names={[c.myName, c.partnerName]} onChange={draft.set} />
    </QuestionLayout>
  );
}
