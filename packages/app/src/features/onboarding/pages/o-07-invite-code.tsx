import { createInvite } from '@sweetwo/api';
import {
  BottomSheet,
  Button,
  ChoiceCards,
  Icon,
  QuestionLayout,
  QuestionSkeleton,
} from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useStep } from '../step';
import { inviteIcons } from './o-06-invite-now';

/** 초대 링크(웹 A-07). 앱이 깔려 있으면 sweetwo://i/{code}로도 열린다. */
export const inviteLink = (code: string) => `https://app.sweetwo.kr/i/${code}`;

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    toast(copy.copied);
    return true;
  } catch {
    return false; /* 클립보드를 못 쓰는 환경: 아무것도 하지 않음 */
  }
}

// O-07 초대 코드 보내기(선택, 넘기면 홈 할 일). O-06 화면 위에 올라오는 시트(16 O-07 ‘시트’).
// 2026-11-03 주 버튼 = 카톡으로 보내기, 보조 = 링크 복사, 맨 아래 글자 버튼 = 보내기 전 ‘나중에 보낼게요’, 보내거나 복사한 뒤 ‘다음’.
// 맨 아래 버튼은 처음부터 활성. 닫아도(막, Esc, 닫기) 같이 O-11로(2026-11-10 S2-03: 이어하기로 다시 열어도 늘 O-11).
// 공유(2026-11-10 S2-05): 모바일 앱은 브리지 shareText(Android WebView에는 navigator.share가 없음), 브라우저는 navigator.share, 둘 다 없으면 링크 복사
export function O07InviteCode() {
  const s = useStep('o-07');
  const invite = useQuery({ queryKey: ['invite'], queryFn: createInvite, retry: false });
  const [sent, setSent] = useState(false);
  if (!s.ready) return <QuestionSkeleton chapter={s.chapter} onBack={s.onBack ?? null} />;
  const code = invite.data?.code;
  const next = () => void s.done(undefined, () => 'o-11', { answer: sent ? 'input' : 'none' });
  const sentBy = (channel: 'code' | 'link' | 'share') => {
    setSent(true);
    track('invite_sent', { channel, entry: 'onboarding' });
  };
  const copyAndMark = async (t: string, channel: 'code' | 'link') => {
    if (await copyText(t)) sentBy(channel);
  };
  const share = async () => {
    if (!code) return;
    const url = inviteLink(code);
    const text = copy.shareText(s.state.me?.nickname ?? '', code, url);
    const bridge = typeof window === 'undefined' ? undefined : window.sweetwo;
    if (bridge?.shareText) {
      if ((await bridge.shareText({ text })) === 'shared') sentBy('share');
      return;
    }
    if (typeof navigator.share === 'function') {
      await navigator
        .share({ text })
        .then(() => sentBy('share'))
        .catch(() => undefined);
      return;
    }
    await copyAndMark(url, 'link');
  };
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
        title={copy.inviteTitle}
        onClose={next}
        actions={
          <>
            {!invite.isError && (
              // 2026-11-03 한 줄: 왼쪽 보조 ‘링크 복사’, 오른쪽 주 버튼 ‘카톡으로 보내기’(Lyft처럼)
              <div className="hg-row hg-row--fill">
                <Button
                  variant="secondary"
                  disabled={!code}
                  onClick={() => code && void copyAndMark(inviteLink(code), 'link')}
                >
                  {copy.copyLink}
                </Button>
                <Button variant="primary" disabled={!code} onClick={() => void share()}>
                  {copy.sendKakao}
                </Button>
              </div>
            )}
            <Button variant="ghost" block className="hg-btn--quiet" onClick={next}>
              {sent || invite.isError ? copy.next : copy.sendLater}
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
          <>
            <button
              type="button"
              className="hg-invite-code"
              aria-label={
                code
                  ? `초대 코드 ${code.split('').join(' ')}, 누르면 복사`
                  : '초대 코드를 만드는 중'
              }
              onClick={() => code && void copyAndMark(code, 'code')}
            >
              <span className="hg-invite-code__code">{code ?? '······'}</span>
              <span className="hg-invite-code__tap" aria-hidden="true">
                <Icon name="copy" size={16} />
                {copy.tapToCopy}
              </span>
            </button>
          </>
        )}
      </BottomSheet>
    </>
  );
}
