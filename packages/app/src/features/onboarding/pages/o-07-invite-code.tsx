import { createInvite } from '@sweetwo/api';
import { BottomSheet, Button, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useStep } from '../step';

/** 초대 링크(웹 A-07). 앱이 깔려 있으면 sweetwo://i/{code}로도 열린다. */
export const inviteLink = (code: string) => `https://app.sweetwo.kr/i/${code}`;

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    toast(copy.copied);
  } catch {
    /* 클립보드를 못 쓰는 환경: 아무것도 하지 않음 */
  }
}

// O-07 초대 코드 보내기(선택, 넘기면 첫 주 할 일). O-06 화면 위에 올라오는 시트(16 O-07 ‘시트’).
// ‘다음’은 처음부터 활성. 닫아도(막, Esc, 닫기) 다음과 같이 O-11로.
export function O07InviteCode() {
  const s = useStep('o-07');
  const invite = useQuery({ queryKey: ['invite'], queryFn: createInvite, retry: false });
  if (!s.ready) return null;
  const code = invite.data?.code;
  const next = () => void s.done();
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
            }))}
          />
        </QuestionLayout>
      </div>
      <BottomSheet
        title={copy.inviteTitle}
        onClose={next}
        actions={
          <Button variant="primary" block onClick={next}>
            {copy.next}
          </Button>
        }
      >
        {invite.isError ? (
          <div className="hg-banner hg-banner--info" role="alert">
            <span>{copy.inviteFailed}</span>
            <Button variant="secondary" size="sm" onClick={() => void invite.refetch()}>
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
              onClick={() => code && void copyText(code)}
            >
              {code ?? '······'}
            </button>
            <p className="hg-q__help">{copy.inviteValid}</p>
            <div className="hg-row hg-row--fill">
              <Button
                variant="secondary"
                disabled={!code}
                onClick={() => code && void copyText(inviteLink(code))}
              >
                {copy.copyLink}
              </Button>
              {/* 카카오톡 공유(카카오 JS SDK)는 앱 키, 도메인 등록 뒤 붙인다. 지금은 기기 공유 창 또는 링크 복사. */}
              <Button
                variant="secondary"
                disabled={!code}
                onClick={() => {
                  if (!code) return;
                  const url = inviteLink(code);
                  if (navigator.share)
                    void navigator.share({ url, text: code }).catch(() => undefined);
                  else void copyText(url);
                }}
              >
                {copy.sendKakao}
              </Button>
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}
