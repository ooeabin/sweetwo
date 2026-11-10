import { fetchMe, invitePreview, joinSpace, type JoinResult } from '@sweetwo/api';
import { Icon, Illustration, QuestionLayout, QuestionSkeleton, type IconName } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { paths, prefs, providerName, session, signOut } from '../../auth';
import { copy } from '../copy';
import { joinPath } from '../join-step';
import { P02aMoveRecords } from './p-02a-move-records';

type ErrorKey = keyof typeof copy.errors;

// 초대 코드 형식(P-01 코드 입력과 같음, DB 검사와 같은 규칙). 형식이 아니면 서버에 묻지 않고 바로 ‘잘못된 코드’(2026-11-10)
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
// 합류 불가 상태 화면 아이콘(그림이 들어올 때까지, 2026-11-10 상태 화면 = 아이콘 원)
const BLOCKED_ICON: Record<ErrorKey, IconName> = {
  expired: 'hourglass',
  invalid: 'circle-alert',
  locked: 'lock',
  already_connected: 'users-three',
  own_code: 'user',
  used: 'handshake',
  unavailable: 'user-minus',
};
const StatusIcon = ({ name }: { name: IconName }) => (
  <span className="hg-auth__icon" aria-hidden="true">
    <Icon name={name} />
  </span>
);

// P-01 합류 시작(A-07 초대 링크 진입). 로그인 전에도 초대한 사람을 보여 주고, ‘합류하기’ → 로그인(P-02) 뒤 이어서.
// 혼자 시작한 기록이 있으면(A-07 6번) “이미 시작한 기록이 있어요” + 합류하기 / 취소 → P-02a 옮기기.
export function P01JoinStart() {
  const { code: rawCode = '' } = useParams();
  const code = rawCode.toUpperCase();
  const wellFormed = CODE.test(code);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const preview = useQuery({
    queryKey: ['invite-preview', code],
    queryFn: () => invitePreview(code),
    enabled: wellFormed,
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

  if ((wellFormed && preview.isLoading) || signedIn.isLoading || (signedIn.data && me.isLoading))
    return <QuestionSkeleton />;
  const p = preview.data;
  const blocked: ErrorKey | null = !wellFormed
    ? 'invalid'
    : result && result in copy.errors
      ? (result as ErrorKey)
      : p && p.status !== 'ok'
        ? (p.status as ErrorKey)
        : null;
  const loggedIn = !!signedIn.data;
  const goHome = () => nav('/', { replace: true });

  // 초대 정보를 못 불러옴(13 공통 상태 6·7번): 정상인 척 ‘합류하기’를 보이지 않음(2026-11-10 S1-07)
  if (wellFormed && preview.isError && !blocked) {
    const off = typeof navigator !== 'undefined' && navigator.onLine === false;
    return (
      <QuestionLayout
        hero={<StatusIcon name={off ? 'link' : 'circle-alert'} />}
        title={off ? copy.offlineTitle : copy.errorTitle}
        help={off ? copy.offlineHelp : copy.errorHelp}
        primary={{ label: copy.retry }}
        secondary={loggedIn ? undefined : { label: copy.toStart, onClick: () => nav(paths.login) }}
        onSubmit={() => void preview.refetch()}
      />
    );
  }

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

  // 합류 불가(15 A-07 7번, 2026-11-10 S1-06): 제목 = 예외 문구, 상태 아이콘 원. 막다른 화면 없이
  // 로그인 전 = ‘코드 다시 입력하기’(P-01 코드 입력) + ‘처음으로’(A-02), 로그인됨 = ‘홈으로 가기’.
  // 잘못된 코드면 코드 상자를 보이지 않음(이상한 글자를 크게 보여 주지 않게)
  if (blocked) {
    return (
      <QuestionLayout
        hero={<StatusIcon name={BLOCKED_ICON[blocked]} />}
        title={copy.errors[blocked]}
        primary={{ label: loggedIn ? copy.toHome : copy.reenterCode }}
        secondary={loggedIn ? undefined : { label: copy.toStart, onClick: () => nav(paths.login) }}
        onSubmit={() => (loggedIn ? goHome() : nav(paths.joinCode))}
      >
        {blocked !== 'invalid' && (
          <p className="hg-invite-code hg-invite-code--static">
            <span className="hg-sr">{`${copy.codeLabel} ${code.split('').join(' ')}`}</span>
            <span className="hg-invite-code__code" aria-hidden="true">
              {code}
            </span>
          </p>
        )}
      </QuestionLayout>
    );
  }

  // 2026-11-03 질문 화면 틀: 제목 위, 코드는 바로 아래 회색 상자(O-07과 같은 모양)
  return (
    <QuestionLayout
      hero={<Illustration name="scene-invite" className="hg-sceneart hg-sceneart--tall" motion />}
      title={p?.inviter ? copy.invited(p.inviter) : copy.join}
      help={copy.invitedHelp}
      center={false}
      primary={{ label: copy.join, loading: busy }}
      onSubmit={() => void join()}
    >
      <p className="hg-invite-code hg-invite-code--static">
        <span className="hg-sr">{`${copy.codeLabel} ${code.split('').join(' ')}`}</span>
        <span className="hg-invite-code__code" aria-hidden="true">
          {code}
        </span>
      </p>
      {signedIn.data && me.data && (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.joinAs(providerName[me.data.provider])}{' '}
          <button
            type="button"
            className="hg-btn hg-btn--link"
            onClick={() => {
              // 다른 계정: 이 기기 데이터(캐시, 최근 사용, PIN)를 지운 뒤 돌아올 자리를 기억(로그아웃이 돌아갈 화면을 비우므로 뒤에)
              void signOut({ accountChange: true }).finally(() => {
                prefs.setReturnTo(`/i/${code}?go=1`);
                nav(paths.login);
              });
            }}
          >
            {copy.otherAccount}
          </button>
        </p>
      )}
    </QuestionLayout>
  );
}
