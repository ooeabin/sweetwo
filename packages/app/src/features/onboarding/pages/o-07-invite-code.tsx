import { createInvite } from '@sweetwo/api';
import { Button, QuestionLayout } from '@sweetwo/ui';
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

// O-07 초대 코드 보내기(선택, 넘기면 첫 주 할 일). ‘다음’은 처음부터 활성.
export function O07InviteCode() {
  const s = useStep('o-07');
  const invite = useQuery({ queryKey: ['invite'], queryFn: createInvite, retry: false });
  if (!s.ready) return null;
  const code = invite.data?.code;
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.inviteTitle}
      onBack={s.onBack}
      primary={{ label: copy.next }}
      onSubmit={() => void s.done()}
    >
      {invite.isError ? (
        <div className="hg-banner hg-banner--info" role="alert">
          <span>{copy.inviteFailed}</span>
          <Button variant="secondary" size="sm" onClick={() => void invite.refetch()}>
            {copy.retry}
          </Button>
        </div>
      ) : (
        <div className="hg-stack" style={{ gap: 'var(--space-4)' }}>
          <button
            type="button"
            className="hg-amount__value"
            style={{
              letterSpacing: 'var(--space-2)',
              background: 'none',
              border: 0,
              padding: 0,
              color: 'var(--ink)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            aria-label={
              code ? `초대 코드 ${code.split('').join(' ')}, 누르면 복사` : '초대 코드를 만드는 중'
            }
            onClick={() => code && void copyText(code)}
          >
            {code ?? '······'}
          </button>
          <p className="hg-q__help">{copy.inviteValid}</p>
          <div className="hg-row">
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
        </div>
      )}
    </QuestionLayout>
  );
}
