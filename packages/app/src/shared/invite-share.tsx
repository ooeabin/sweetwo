import { Button, CodeCells, Icon } from '@sweetwo/ui';
import { track } from './analytics';
import { toast } from './toast';

// 초대 코드 보내기(16 O-07, 25 S-12 공통, 2026-11-11 QA 3구간 D6·D9): 6자 코드 상자(누르면 복사) + ‘링크 복사’ + ‘카톡으로 보내기’.
// 공유: 모바일 앱은 브리지 shareText(Android WebView에는 navigator.share가 없음), 브라우저는 navigator.share, 둘 다 없으면 링크 복사.
// 복사를 못 하면 Toast(아무 반응 없던 것, S3-12)

export const inviteCopy = {
  codeLabel: '초대 코드',
  copyLink: '링크 복사',
  tapToCopy: '눌러서 복사', // [확인 필요] 코드 상자 아래
  sendKakao: '카톡으로 보내기',
  copied: '복사했어요', // [확인 필요] 복사 토스트
  copyFailed: '복사하지 못했어요. 코드를 직접 적어 보내 주세요', // [확인 필요] 2026-11-11 S3-12
  making: '초대 코드를 만드는 중',
  /** 공유 글(2026-11-10 S2-05). 호칭이 없으면 ‘파트너가’ */
  shareText: (name: string, code: string, link: string) =>
    `${name ? `${name}님이` : '파트너가'} sweeTwo에 초대했어요. 초대 코드 ${code} ${link}`, // [확인 필요]
};

/** 초대 링크(웹 A-07). 앱이 깔려 있으면 sweetwo://i/{code}로도 열린다. */
export const inviteLink = (code: string) => `https://app.sweetwo.kr/i/${code}`;

export type InviteEntry = 'onboarding' | 'home' | 'settings';
type Channel = 'code' | 'link' | 'share';

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    toast(inviteCopy.copied);
    return true;
  } catch {
    toast(inviteCopy.copyFailed);
    return false;
  }
}

/** 보내기 동작 셋. 보낸 뒤(복사, 공유 성공) onSent + invite_sent(32 4-3) */
export function inviteActions(o: {
  code: string | undefined;
  nickname: string;
  entry: InviteEntry;
  onSent?: (channel: Channel) => void;
}) {
  const sent = (channel: Channel) => {
    track('invite_sent', { channel, entry: o.entry });
    o.onSent?.(channel);
  };
  const copyAndMark = async (t: string, channel: 'code' | 'link') => {
    if (await copyText(t)) sent(channel);
  };
  return {
    copyCode: () => (o.code ? copyAndMark(o.code, 'code') : Promise.resolve()),
    copyLink: () => (o.code ? copyAndMark(inviteLink(o.code), 'link') : Promise.resolve()),
    share: async () => {
      if (!o.code) return;
      const url = inviteLink(o.code);
      const text = inviteCopy.shareText(o.nickname, o.code, url);
      const bridge = typeof window === 'undefined' ? undefined : window.sweetwo;
      if (bridge?.shareText) {
        if ((await bridge.shareText({ text })) === 'shared') sent('share');
        return;
      }
      if (typeof navigator.share === 'function') {
        await navigator
          .share({ text })
          .then(() => sent('share'))
          .catch(() => undefined);
        return;
      }
      await copyAndMark(url, 'link');
    },
  };
}

/** 6자 코드 상자(O-07과 같은 모양, D9). 2026-11-11 한 글자씩 칸(CodeCells, 넣는 칸과 같은 모양). 누르면 복사 */
export function InviteCodeBox({ code, onCopy }: { code: string | undefined; onCopy: () => void }) {
  return (
    <button
      type="button"
      className="hg-invite-code"
      aria-label={
        code
          ? `${inviteCopy.codeLabel} ${code.split('').join(' ')}, 누르면 복사`
          : inviteCopy.making
      }
      onClick={() => code && onCopy()}
    >
      <CodeCells value={code ?? ''} />
      <span className="hg-invite-code__tap" aria-hidden="true">
        <Icon name="copy" size={16} />
        {inviteCopy.tapToCopy}
      </span>
    </button>
  );
}

/** ‘링크 복사’(보조) + ‘카톡으로 보내기’(주) 한 줄(O-07 2026-11-03, Lyft처럼) */
export function InviteButtons({
  disabled,
  onLink,
  onShare,
  size,
}: {
  disabled?: boolean;
  onLink: () => void;
  onShare: () => void;
  size?: 'sm';
}) {
  return (
    <div className="hg-row hg-row--fill">
      <Button variant="secondary" size={size} disabled={disabled} onClick={onLink}>
        {inviteCopy.copyLink}
      </Button>
      <Button variant="primary" size={size} disabled={disabled} onClick={onShare}>
        {inviteCopy.sendKakao}
      </Button>
    </div>
  );
}
