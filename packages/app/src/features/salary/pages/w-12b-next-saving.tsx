import { nextSavingOptions, nextSavingReason, todayKst, type SavingChip } from '@sweetwo/core';
import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';
import { salaryPaths, savingPaths } from '../paths';
import { useSavingItems } from '../saving';
import { SavingQuestionError } from '../saving-parts';
import { EMPTY_DRAFT, writeDraft } from '../saving-draft';

type Opt = 'redeadline' | SavingChip | 'custom';

/**
 * W-12b 다음엔 뭘 같이 모을까요(20 v2.2, G4): W-12a에서 고른 뒤, 묶음 달성 뒤, 홈 띠 11번(기한 지남)에서 열림.
 * 기한이 지난 저금(다 못 모음)이면 맨 위 “‘여행’ 기한을 새로 정할게요”(→ W-10a 기한), 그다음 이름 칩 3개(19 ‘이름 칩 표’)
 * + ‘직접 정할게요’ + 글자 버튼 ‘나중에 할게요’. 칩은 W-11a에 이름을 채워 시작. `?why=achieved`(W-12a에서 고른 뒤), `?back=checklist`면 끝나고 W-02로
 */
export function W12bNextSaving() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const d = useSavingItems();
  const seen = useRef(false);
  const [value, setValue] = useState<Opt | null>(null);
  const i = d.ready ? d.byId(id) : undefined;
  const reason = i
    ? (nextSavingReason(
        {
          status: i.goal.status,
          closed_at: i.goal.closed_at,
          target_amount: i.goal.target_amount,
          deadline: i.goal.deadline,
          saved: i.saved,
        },
        todayKst(),
      ) ?? (params.get('why') === 'achieved' || i.state !== 'saving' ? 'achieved' : null))
    : null;
  const opts = reason ? nextSavingOptions(reason, d.ready ? d.space.marriage_status : null) : [];
  useEffect(() => {
    if (!reason || seen.current) return;
    seen.current = true;
    track('next_saving_prompt_viewed', { from: reason, chip_code: null });
  }, [reason]);
  const done = () =>
    nav(params.get('back') === 'checklist' ? salaryPaths.checklist : savingPaths.item(id), {
      replace: true,
    });
  if (!d.ready && d.failed) return <SavingQuestionError onBack={done} onRetry={d.retry} />;
  if (!d.ready) return <QuestionSkeleton title={copy.nextQ} />;
  if (!i || !reason) return <Navigate to={savingPaths.item(id)} replace />;
  const pick = (v: Opt) => {
    track('next_saving_prompt_chosen', { from: reason, chip_code: v });
    if (v === 'redeadline') {
      nav(savingPaths.edit(id, 'deadline'), { replace: true });
      return;
    }
    // 칩이면 이름을 채워 W-11a(새 입력), 직접이면 빈 이름
    writeDraft({ ...EMPTY_DRAFT, name: v === 'custom' ? '' : copy.chipNames[v] });
    nav(`${savingPaths.add}/a?from=next`, { replace: true });
  };
  return (
    <QuestionLayout
      title={copy.nextQ}
      onBack={done}
      later={{
        label: copy.laterAnswer,
        onClick: () => {
          track('next_saving_prompt_chosen', { from: reason, chip_code: 'later' });
          done();
        },
      }}
    >
      <ChoiceCards<Opt>
        label={copy.nextQ}
        value={value}
        onChange={setValue}
        onPick={pick}
        options={opts.map((o) => ({
          value: o,
          label:
            o === 'redeadline'
              ? copy.nextRedeadline(i.goal.name)
              : o === 'custom'
                ? copy.nextCustom
                : copy.chipNames[o],
        }))}
      />
    </QuestionLayout>
  );
}
