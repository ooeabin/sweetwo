import { useNavigate } from 'react-router-dom';
import { NotiView } from '../view';

// N-02 좁은 창 알림 화면(전체 화면, 하단 독 없음): 뒤로 + “알림” + “모두 읽음”, 맨 아래 “알림 설정”
export function N02Notifications() {
  const nav = useNavigate();
  return <NotiView variant="page" onClose={() => nav(-1)} />;
}
