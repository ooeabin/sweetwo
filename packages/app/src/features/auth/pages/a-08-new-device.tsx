import { endSessions, fetchSessions, qk } from '@sweetwo/api';
import { deviceLabel, formatKstDateTime } from '@sweetwo/core';
import { AuthLayout, Button } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy, providerName } from '../copy';
import { prefs } from '../prefs';

// A-08 4·5번 새 기기 알림(15). 알림 ‘새 기기에서 로그인했어요’를 누르면 옴(:session = 새 기기 세션).
// ‘나예요’ → 홈. ‘내가 아니에요’ → 그 기기 로그아웃 → S-15 기기 목록 + “{제공자} 계정 보안도 확인해 주세요”.
// 이미 로그아웃된 기기면 안내만 하고 S-15로.
export function A08NewDevice() {
  const { session = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const sessions = useQuery({ queryKey: qk.sessions, queryFn: fetchSessions });
  const s = sessions.data?.find((x) => x.id === session);
  const gone = sessions.isSuccess && !s;
  const notMe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (s && !s.current) await endSessions(s.id);
      // S-15가 지운 기기를 다시 보이지 않게 새로 읽음
      qc.removeQueries({ queryKey: qk.sessions });
      const p = prefs.lastProvider();
      toast(p ? copy.checkProvider(providerName[p]) : copy.checkAccount);
      nav('/settings/security', { replace: true });
    } catch {
      toast(copy.newDeviceFailed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      title={copy.newDeviceTitle}
      help={
        <>
          {copy.newDeviceHelp}
          {s && (
            <>
              <br />
              {copy.newDeviceAt(deviceLabel(s.userAgent), formatKstDateTime(s.createdAt))}
            </>
          )}
          {gone && (
            <>
              <br />
              {copy.newDeviceGone}
            </>
          )}
        </>
      }
      actions={
        <>
          <Button variant="primary" block onClick={() => nav('/', { replace: true })}>
            {copy.itsMe}
          </Button>
          <Button
            variant="secondary"
            block
            disabled={busy || s?.current}
            onClick={() => void notMe()}
          >
            {copy.notMe}
          </Button>
        </>
      }
    />
  );
}
