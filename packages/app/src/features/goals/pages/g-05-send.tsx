import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { goalUsePath } from '../achieve';
import { copy } from '../copy';

type Send = keyof typeof copy.sendOptions;

// G-05 매달 넣던 돈(22 화면별 정의): “매달 넣던 25만 원은 어디로 보낼까요?” 다른 목표 / 새 목표 만들기 / 분배표에서 정할게요.
// 고른 뒤 사용 기록을 먼저 묻고(G-05 사용), 끝나면 고른 곳으로: 다른 목표 → 목표 고르기 → 그 저금 줄에 더함,
// 새 목표 → G-03a(만든 목표 줄에 그 금액), 분배표에서 정할게요 → 남는 돈으로 두고 W-01.
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
        onPick={(s) => nav(`${goalUsePath(id)}?then=${s}&m=${monthly}`, { replace: true })}
        options={(Object.keys(copy.sendOptions) as Send[]).map((k) => ({
          value: k,
          label: copy.sendOptions[k],
        }))}
      />
    </QuestionLayout>
  );
}
