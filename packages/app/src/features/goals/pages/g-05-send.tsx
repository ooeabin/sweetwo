import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { goalUsePath } from '../achieve';
import { copy } from '../copy';

type Send = keyof typeof copy.sendOptions;

// G-05 보낼 곳(22 화면별 정의): “매달 모으던 25만 원은 어디로 보낼까요?” 다른 목표 / 새 목표 만들기 / 용돈 늘리기.
// 다른 목표 → G-06 순서(먼저 모을 목표), 새 목표 → G-03a, 용돈 늘리기 → 월 수입·지출 고치기(F-05, 연결된 부부는 제안).
// 고른 곳으로 가기 전에 사용 기록(이어서)을 먼저 엶: 사용 기록 끝에서 이 선택으로 감.
export function G05Send() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { masked } = useMask();
  const [v, setV] = useState<Send | null>(null);
  const monthly = Number(params.get('m') ?? '0');
  const title = copy.sendTitle(money(monthly, masked));
  return (
    <QuestionLayout title={title} onBack={() => nav(`/goals/${id}`)}>
      <ChoiceCards<Send>
        label={title}
        value={v}
        onChange={setV}
        onPick={(s) => nav(`${goalUsePath(id)}?then=${s}`, { replace: true })}
        options={(Object.keys(copy.sendOptions) as Send[]).map((k) => ({
          value: k,
          label: copy.sendOptions[k],
        }))}
      />
    </QuestionLayout>
  );
}
