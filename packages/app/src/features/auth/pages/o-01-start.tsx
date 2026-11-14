import { AuthLayout, BottomSheet, Button, CodeCells, Wordmark } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';
import { paths } from '../flow';
import { prefs } from '../prefs';
import { session } from '../session';

// 초대 코드: 영문 대문자와 숫자 6자(헷갈리는 I, O, 0, 1은 안 씀). P-01과 같은 규칙
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
type Found = { code: string; source: 'clipboard' | 'referrer' };

// O-01 시작 화면. 첫 실행에만(로그아웃 뒤 실행은 A-02). 2026-11-13 v2.2: 메인 문구 “같이 모으는 돈, 둘이 같이 봐요”, 서브 없음.
// 첫 실행에 설치 리퍼러(Android)·클립보드(iOS, L-07이 복사)에 초대 코드가 있으면 시트 “받은 초대 코드로 합류할까요?”
// ‘합류하기’ → P-01을 거쳐 바로 로그인(A-02 초대 문구, 한 번만 누름) / ‘아니요, 새로 시작할게요’. 브리지(window.sweetwo.inviteCode)가 없으면 묻지 않음
export function O01Start() {
  const nav = useNavigate();
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    const read = session.bridge?.inviteCode?.firstRun;
    if (!read || prefs.inviteAutofillChecked()) return;
    let alive = true;
    void read()
      .catch(() => null)
      .then((r) => {
        prefs.setInviteAutofillChecked();
        const code = r?.code.trim().toUpperCase();
        if (alive && r && code && CODE.test(code)) setFound({ code, source: r.source });
      });
    return () => {
      alive = false;
    };
  }, []);
  const go = (entry: 'first_run' | 'invite') => {
    prefs.setStarted();
    // ‘코드 입력하기’는 P-01 코드 직접 입력 → 합류하기 → A-02(초대 문구)
    nav(entry === 'invite' ? paths.joinCode : paths.login, { state: { fromStart: true, entry } });
  };
  const answer = (join: boolean) => {
    if (!found) return;
    track('invite_code_autofilled', { source: found.source, result: join ? 'join' : 'decline' });
    setFound(null);
    if (!join) return;
    prefs.setStarted();
    // 시트에서 이미 ‘합류하기’를 눌렀으니 P-01에서 다시 누르지 않게 바로 이어서(?go=1, 2026-11-13 실구동)
    nav(`/i/${found.code}?go=1`);
  };
  return (
    <>
      <AuthLayout
        className="hg-auth--hero hg-auth--start"
        // 2026-11-10 워드마크 위 시작 그림 자리(scene-start) 없앰: A-02와 같은 워드마크 히어로
        media={<Wordmark height={40} />}
        title={copy.catchphrase}
        actions={
          <>
            <Button variant="primary" block onClick={() => go('first_run')}>
              {copy.start}
            </Button>
            <p className="hg-auth__alt">
              {copy.invitedAsk}{' '}
              <button type="button" className="hg-btn hg-btn--link" onClick={() => go('invite')}>
                {copy.invitedLink}
              </button>
            </p>
          </>
        }
      />
      {found && (
        <BottomSheet
          title={copy.autofillTitle}
          onClose={() => answer(false)}
          actions={
            <>
              <Button variant="primary" block onClick={() => answer(true)}>
                {copy.autofillJoin}
              </Button>
              <Button variant="ghost" block className="hg-btn--quiet" onClick={() => answer(false)}>
                {copy.autofillNo}
              </Button>
            </>
          }
        >
          <p className="hg-invite-code">
            <span className="hg-sr">{`${copy.codeLabel} ${found.code.split('').join(' ')}`}</span>
            <CodeCells value={found.code} />
          </p>
        </BottomSheet>
      )}
    </>
  );
}
