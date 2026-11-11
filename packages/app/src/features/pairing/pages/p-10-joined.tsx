import { Illustration, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useJoinData } from '../data';
import { joinPath } from '../join-step';
import { shouldAskPush } from './p-11-push';

// P-10 합류 축하(18 ‘합류 뒤’, 2026-11-11 D7): 합류를 마친 순간 한 번. 화면 위 축하 배경(hg-celebrate-bg) + 96px 움직이는 그림 자리
// (그림이 들어올 때까지 회색 빈 자리) + “{시작한 사람}님과 연결됐어요”. 모바일 앱이고 푸시 허용을 아직 안 물었으면 ‘다음’ → P-11, 아니면 ‘홈으로 가기’
export function P10Joined() {
  const nav = useNavigate();
  const d = useJoinData();
  const ask = useQuery({ queryKey: ['push-ask'], queryFn: shouldAskPush, staleTime: Infinity });
  if (!d.ready || ask.isLoading) return <QuestionSkeleton onBack={null} />;
  return (
    <QuestionLayout
      celebrate
      hero={<Illustration name="scene-clap" className="hg-auth__art" motion />}
      title={copy.joinedTitle(d.starterName)}
      help={d.waiting ? copy.joinedWaitHelp(d.starterName) : copy.joinedHelp}
      center
      primary={{ label: ask.data ? copy.next : copy.toHome }}
      onSubmit={() =>
        ask.data ? nav(joinPath('p-11'), { replace: true }) : nav('/', { replace: true })
      }
    />
  );
}
