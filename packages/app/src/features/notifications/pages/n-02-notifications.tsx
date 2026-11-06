import { useNavigate } from 'react-router-dom';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { NotiView } from '../view';

// N-02 좁은 창 알림 화면: 2026-11-04 머리 공통화로 다른 화면과 같은 앱 머리(홈과 같은 제목 + 검색·알림·설정) 아래
// ‘‹ 알림 … 모두 읽음’ 줄. 하단 독은 없음(설정 하위와 같은 sub). 맨 아래 “알림 설정”
export function N02Notifications() {
  const nav = useNavigate();
  return (
    <MainFrame
      sub="settings"
      current={null}
      narrowTitle={copy.title}
      columns={[<NotiView key="n" variant="page" onClose={() => nav(-1)} />]}
    />
  );
}
