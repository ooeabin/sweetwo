import { AuthLayout, Button, Illustration, Wordmark } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { paths } from '../flow';
import { prefs } from '../prefs';

// O-01 시작 화면. 첫 실행에만(로그아웃 뒤 실행은 A-02).
export function O01Start() {
  const nav = useNavigate();
  const go = (entry: 'first_run' | 'invite') => {
    prefs.setStarted();
    // ‘코드 입력하기’는 P-01 코드 직접 입력 → 합류하기 → A-02(초대 문구)
    nav(entry === 'invite' ? paths.joinCode : paths.login, { state: { fromStart: true, entry } });
  };
  return (
    <AuthLayout
      className="hg-auth--hero hg-auth--start"
      media={
        <>
          {/* 시작 그림(Illustrations ‘나중 과제’ 1-17 scene-start, 120px)이 들어올 때까지 회색 빈 자리(2026-11-09) */}
          <Illustration name="scene-start" className="hg-sceneart" />
          <Wordmark height={40} />
        </>
      }
      title={copy.catchphrase}
      help={copy.startHelp}
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
  );
}
