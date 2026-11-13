import { createInvite } from '@sweetwo/api';
import { BottomSheet, Button, ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { InviteButtons, InviteCodeBox, inviteActions } from '../../../shared/invite-share';
import { copy } from '../copy';
import { useStep } from '../step';
import { inviteIcons } from './o-06-invite-now';

// O-07 초대 코드 보내기(선택, 넘기면 홈 할 일). O-06 화면 위에 올라오는 시트(16 O-07 ‘시트’).
// 2026-11-03 주 버튼 = 카톡으로 보내기, 보조 = 링크 복사, 맨 아래 글자 버튼 = 보내기 전 ‘나중에 보낼게요’, 보내거나 복사한 뒤 ‘다음’.
// 맨 아래 버튼은 처음부터 활성. 닫아도(막, Esc, 닫기) 같이 O-11로(2026-11-10 S2-03: 이어하기로 다시 열어도 늘 O-11).
// 코드 상자·보내기는 S-12와 같은 공통(shared/invite-share, 2026-11-11 D6). 코드를 못 만들면 제목도 실패로, 맨 아래 ‘나중에 보낼게요’(S3-27)
export function O07InviteCode() {
  const s = useStep('o-07');
  const invite = useQuery({ queryKey: ['invite'], queryFn: createInvite, retry: false });
  const [sent, setSent] = useState(false);
  if (!s.ready) return <QuestionSkeleton chapter={s.chapter} onBack={s.onBack ?? null} />;
  const code = invite.data?.code;
  const next = () => void s.done(undefined, () => 'o-11', { answer: sent ? 'input' : 'none' });
  const act = inviteActions({
    code,
    nickname: s.state.me?.nickname ?? '',
    entry: 'onboarding',
    onSent: () => setSent(true),
  });
  return (
    <>
      {/* 시트 뒤: 방금 고른 O-06 화면 그대로(누를 수 없음) */}
      <div ref={(el) => el?.setAttribute('inert', '')} aria-hidden="true">
        <QuestionLayout
          chapter={s.chapter}
          title={copy.inviteNow}
          help={copy.inviteNowHelp}
          onBack={s.onBack}
        >
          <ChoiceCards<'now' | 'later'>
            label={copy.inviteNow}
            value="now"
            onChange={() => undefined}
            options={(['now', 'later'] as const).map((k) => ({
              value: k,
              label: copy.inviteChoices[k],
              icon: inviteIcons[k],
            }))}
            go
          />
        </QuestionLayout>
      </div>
      <BottomSheet
        title={invite.isError ? copy.inviteFailedTitle : copy.inviteTitle}
        onClose={next}
        actions={
          <>
            {!invite.isError && (
              // 2026-11-03 한 줄: 왼쪽 보조 ‘링크 복사’, 오른쪽 주 버튼 ‘카톡으로 보내기’(Lyft처럼)
              <InviteButtons
                disabled={!code}
                onLink={() => void act.copyLink()}
                onShare={() => void act.share()}
              />
            )}
            <Button variant="ghost" block className="hg-btn--quiet" onClick={next}>
              {sent ? copy.next : copy.sendLater}
            </Button>
          </>
        }
      >
        {invite.isError ? (
          <div className="hg-banner hg-banner--info" role="alert">
            <span>{copy.inviteFailed}</span>
            <Button
              variant="secondary"
              size="sm"
              loading={invite.isFetching}
              onClick={() => void invite.refetch()}
            >
              {copy.retry}
            </Button>
          </div>
        ) : (
          <InviteCodeBox code={code} onCopy={() => void act.copyCode()} />
        )}
      </BottomSheet>
    </>
  );
}
