import { fetchMe, invitePreview, joinSpace, type JoinResult } from '@sweetwo/api';
import { AuthLayout, Button, SceneMedia } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { paths, prefs, providerName, session } from '../../auth';
import { copy } from '../copy';
import { joinPath } from '../join-step';

type ErrorKey = keyof typeof copy.errors;

// P-01 합류 시작(A-07 초대 링크 진입). 로그인 전에도 초대한 사람을 보여 주고, ‘합류하기’ → 로그인(P-02) 뒤 이어서.
// 혼자 쓰던 기록 옮기기(P-02a)는 다음 단계라 지금은 안내만.
export function P01JoinStart() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const preview = useQuery({
    queryKey: ['invite-preview', code],
    queryFn: () => invitePreview(code),
  });
  const signedIn = useQuery({ queryKey: ['session-has'], queryFn: () => session.has() });
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, enabled: signedIn.data === true });
  const [result, setResult] = useState<JoinResult | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (busy) return;
    if (!signedIn.data || !me.data) {
      prefs.setReturnTo(`/i/${code}?go=1`); // 로그인, 가입이 끝나면 여기로 돌아와 바로 합류
      nav(paths.login, {
        state: { fromStart: true, entry: 'invite', inviter: preview.data?.inviter },
      });
      return;
    }
    setBusy(true);
    try {
      const r = await joinSpace(code);
      if (r === 'joined' || r === 'resume') {
        const fresh = await me.refetch();
        nav(joinPath((fresh.data?.onboarding_step ?? 'P-03').toLowerCase()), { replace: true });
        return;
      }
      setResult(r);
    } catch {
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void join() });
    } finally {
      setBusy(false);
    }
  };

  // 로그인하고 돌아온 길(?go=1)이면 한 번 바로 합류
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || params.get('go') !== '1' || !me.data) return;
    auto.current = true;
    void join();
  }, [me.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (preview.isLoading || signedIn.isLoading || (signedIn.data && me.isLoading)) return null;
  const p = preview.data;
  const blocked: ErrorKey | null =
    result && result in copy.errors
      ? (result as ErrorKey)
      : p && p.status !== 'ok'
        ? (p.status as ErrorKey)
        : null;

  if (result === 'has_records') {
    return (
      <AuthLayout
        title={copy.hasRecords}
        help={copy.hasRecordsHelp}
        actions={
          <Button variant="primary" block onClick={() => nav('/', { replace: true })}>
            {copy.toMonth}
          </Button>
        }
      />
    );
  }

  return (
    <AuthLayout
      media={<SceneMedia tall />}
      title={p?.inviter ? copy.invited(p.inviter) : copy.join}
      help={blocked ? copy.errors[blocked] : copy.invitedHelp}
      actions={
        <>
          <p
            className="hg-amount__value"
            style={{ margin: 0, letterSpacing: 'var(--space-2)' }}
            aria-label={`${copy.codeLabel} ${code.toUpperCase().split('').join(' ')}`}
          >
            {code.toUpperCase()}
          </p>
          {signedIn.data && me.data && !blocked && (
            <p className="hg-help" style={{ margin: 0 }}>
              {copy.joinAs(providerName[me.data.provider])}{' '}
              <button
                type="button"
                className="hg-btn hg-btn--link"
                onClick={() => {
                  prefs.setReturnTo(`/i/${code}?go=1`);
                  void session.signOut().finally(() => nav(paths.login));
                }}
              >
                {copy.otherAccount}
              </button>
            </p>
          )}
          {blocked ? (
            signedIn.data && (
              <Button variant="primary" block onClick={() => nav('/', { replace: true })}>
                {copy.toMonth}
              </Button>
            )
          ) : (
            <Button
              variant="primary"
              block
              className={busy ? 'is-loading' : undefined}
              onClick={() => void join()}
            >
              {copy.join}
            </Button>
          )}
        </>
      }
    />
  );
}
