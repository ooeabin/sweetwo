import { AuthLayout, Button } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { paths } from '../flow';
import { prefs } from '../prefs';

// O-01 시작 화면. 첫 실행에만(로그아웃 뒤 실행은 A-02).
export function O01Start() {
  const nav = useNavigate();
  const go = (entry: 'first_run' | 'invite') => {
    prefs.setStarted();
    // ‘초대받았어요’는 P-01 코드 입력으로 가야 한다. 합류 단계(P 탭)에서 경로를 붙일 때까지 A-02로.
    nav(paths.login, { state: { fromStart: true, entry } });
  };
  return (
    <AuthLayout
      title={copy.startTitle}
      actions={
        <>
          <Button variant="primary" block onClick={() => go('first_run')}>
            {copy.start}
          </Button>
          <Button variant="secondary" block onClick={() => go('invite')}>
            {copy.invited}
          </Button>
        </>
      }
    />
  );
}
