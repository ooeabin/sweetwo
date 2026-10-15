import { QuestionLayout, SceneMedia } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useCloseData } from '../data';

// W-04 끝(docs/spec/21-month-close.md). 다음 달 조정(W-04h)과 제안은 배우자 합류 뒤라 지금은 바뀐 값이 없음.
export function W04End() {
  const nav = useNavigate();
  const d = useCloseData();
  if (d.loading) return null;
  return (
    <QuestionLayout
      title={copy.doneTitle(d.month)}
      help={copy.noChange}
      primary={{ label: copy.toMonth }}
      onSubmit={() => nav('/', { replace: true })}
    >
      <SceneMedia scene="W-04" />
    </QuestionLayout>
  );
}
