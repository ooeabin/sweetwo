import { Illustration, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pushAsked } from '../../../shared/push-ask';
import { afterSetupPath } from '../../auth';
import { copy } from '../copy';
import { useJoinData } from '../data';
import { joinPath } from '../join-step';

// P-10 합류 축하(18, 2026-11-11 D7): 합류를 마친 순간 한 번. 화면 위 축하 배경(hg-celebrate-bg) + 96px 움직이는 그림 자리
// (그림이 들어올 때까지 회색 빈 자리) + “{시작한 사람}님과 연결됐어요” / “이제 같이 모은 걸 같이 봐요”(2026-11-13).
// 알림 종류를 아직 안 골랐으면 ‘다음’ → P-11, 아니면 ‘홈으로 가기’(A-06 권장을 아직 안 물었으면 먼저)
export function P10Joined() {
  const nav = useNavigate();
  const d = useJoinData();
  const [ask] = useState(() => !pushAsked());
  if (!d.ready) return <QuestionSkeleton onBack={null} />;
  return (
    <QuestionLayout
      celebrate
      hero={<Illustration name="scene-clap" className="hg-auth__art" motion />}
      title={copy.joinedTitle(d.starterName)}
      help={d.waiting ? copy.joinedWaitHelp(d.starterName) : copy.joinedHelp}
      center
      primary={{ label: ask ? copy.next : copy.toHomeAfter }}
      onSubmit={() =>
        ask
          ? nav(joinPath('p-11'), { replace: true })
          : void afterSetupPath().then((to) => nav(to, { replace: true }))
      }
    />
  );
}
