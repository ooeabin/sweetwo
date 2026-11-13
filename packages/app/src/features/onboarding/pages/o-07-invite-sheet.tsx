import { createInvite } from '@sweetwo/api';
import { BottomSheet, Button } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InviteButtons, InviteCodeBox, inviteActions } from '../../../shared/invite-share';
import { afterSetupPath } from '../../auth';
import { copy } from '../copy';
import { useMe, useSpace } from '../data';

/** 첫 저금(W-11, from=onboarding) 끝에 오는 주소. 홈 위에 이 시트(routes) */
export const AFTER_FIRST_SAVING_PATH = '/welcome';

// O-07 초대 코드 시트(16 O-07, 2026-11-13 O-06 없앰): 첫 저금을 만든 직후 미합류면 “같이 모을 사람을 초대할까요?” 시트를 홈 위에.
// 코드 상자·‘링크 복사’·‘카톡으로 보내기’는 S-12와 같은 공통(shared/invite-share). 맨 아래 ‘나중에 보낼게요’(보내거나 복사하면 ‘다음’).
// 닫으면(보냈든 안 보냈든) A-06 앱 잠금 권장(건너뛸 수 있음) → 홈. 이미 합류했으면 시트 없이 바로.
// 코드를 못 만들면 제목도 실패로, 맨 아래 ‘나중에 보낼게요’(S3-27)
export function O07InviteSheet() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const joined = space.data?.couple_state === 'connected';
  const invite = useQuery({
    queryKey: ['invite'],
    queryFn: createInvite,
    retry: false,
    enabled: !!space.data && !joined,
  });
  const [sent, setSent] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    void afterSetupPath().then((to) => nav(to, { replace: true }));
  };
  useEffect(() => {
    if (joined) leave();
    // 합류 여부가 정해지면 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  if (!space.data || joined || leaving) return null;
  const code = invite.data?.code;
  const act = inviteActions({
    code,
    nickname: me.data?.nickname ?? '',
    entry: 'onboarding',
    onSent: () => setSent(true),
  });
  return (
    <BottomSheet
      title={invite.isError ? copy.inviteFailedTitle : copy.inviteAfterSaving}
      onClose={leave}
      actions={
        <>
          {!invite.isError && (
            <InviteButtons
              disabled={!code}
              onLink={() => void act.copyLink()}
              onShare={() => void act.share()}
            />
          )}
          <Button variant="ghost" block className="hg-btn--quiet" onClick={leave}>
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
  );
}
