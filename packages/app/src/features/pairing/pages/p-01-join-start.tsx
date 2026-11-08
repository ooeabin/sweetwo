import { fetchMe, invitePreview, joinSpace, type JoinResult } from '@sweetwo/api';
import { Illustration, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { paths, prefs, providerName, session } from '../../auth';
import { copy } from '../copy';
import { joinPath } from '../join-step';
import { P02aMoveRecords } from './p-02a-move-records';

type ErrorKey = keyof typeof copy.errors;

// P-01 합류 시작(A-07 초대 링크 진입). 로그인 전에도 초대한 사람을 보여 주고, ‘합류하기’ → 로그인(P-02) 뒤 이어서.
// 혼자 시작한 기록이 있으면(A-07 6번) “이미 시작한 기록이 있어요” + 합류하기 / 취소 → P-02a 옮기기.
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
  const [moving, setMoving] = useState(false);

  const afterJoin = async (r: JoinResult) => {
    if (r === 'joined' || r === 'resume') {
      const fresh = await me.refetch();
      nav(joinPath((fresh.data?.onboarding_step ?? 'P-03').toLowerCase()), { replace: true });
      return;
    }
    setMoving(false);
    setResult(r);
  };
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
      await afterJoin(await joinSpace(code));
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

  if (preview.isLoading || signedIn.isLoading || (signedIn.data && me.isLoading))
    return <QuestionSkeleton />;
  const p = preview.data;
  const blocked: ErrorKey | null =
    result && result in copy.errors
      ? (result as ErrorKey)
      : p && p.status !== 'ok'
        ? (p.status as ErrorKey)
        : null;

  if (result === 'has_records' && moving)
    return (
      <P02aMoveRecords
        code={code}
        onDone={(r) => void afterJoin(r)}
        onCancel={() => setMoving(false)}
      />
    );
  if (result === 'has_records') {
    return (
      <QuestionLayout
        title={copy.hasRecords}
        help={copy.hasRecordsHelp}
        center={false}
        primary={{ label: copy.join }}
        secondary={{ label: copy.cancel, onClick: () => nav('/', { replace: true }) }}
        onSubmit={() => setMoving(true)}
      />
    );
  }

  // 2026-11-03 질문 화면 틀: 제목 위, 코드는 바로 아래 회색 상자(O-07과 같은 모양)
  const canJoin = !blocked;
  return (
    <QuestionLayout
      hero={<Illustration name="scene-invite" className="hg-sceneart hg-sceneart--tall" motion />}
      title={p?.inviter ? copy.invited(p.inviter) : copy.join}
      help={blocked ? copy.errors[blocked] : copy.invitedHelp}
      center={false}
      primary={
        canJoin
          ? { label: copy.join, loading: busy }
          : signedIn.data
            ? { label: copy.toMonth }
            : undefined
      }
      onSubmit={() => (canJoin ? void join() : nav('/', { replace: true }))}
    >
      <p className="hg-invite-code hg-invite-code--static">
        <span className="hg-sr">{`${copy.codeLabel} ${code.toUpperCase().split('').join(' ')}`}</span>
        <span className="hg-invite-code__code" aria-hidden="true">
          {code.toUpperCase()}
        </span>
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
    </QuestionLayout>
  );
}
