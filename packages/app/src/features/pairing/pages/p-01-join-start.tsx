import {
  AuthCallError,
  fetchMe,
  invitePreview,
  joinSpace,
  qk,
  type JoinResult,
} from '@sweetwo/api';
import { CodeCells, Illustration, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { paths, prefs, providerName, session, signOut } from '../../auth';
import { copy } from '../copy';
import { joinPath } from '../join-step';
import { P02aMoveRecords } from './p-02a-move-records';

type ErrorKey = keyof typeof copy.errors;

// 초대 코드 형식(P-01 코드 입력과 같음, DB 검사와 같은 규칙). 형식이 아니면 서버에 묻지 않고 바로 ‘잘못된 코드’(2026-11-10)
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
// 상태 그림 자리(96px, 그림이 들어올 때까지 회색 빈 자리 hg-artslot, 2026-11-10 아이콘 원에서 되돌림. Illustrations ‘나중 과제’)
const StatusArt = ({ name }: { name: string }) => (
  <Illustration name={name} className="hg-auth__art" />
);

// P-01 합류 시작(A-07 초대 링크 진입). 로그인 전에도 초대한 사람을 보여 주고, ‘합류하기’ → 로그인(P-02) 뒤 이어서.
// 혼자 시작한 기록이 있으면(A-07 6번) “이미 시작한 기록이 있어요” + 합류하기 / 취소 → P-02a 옮기기.
export function P01JoinStart() {
  const { code: rawCode = '' } = useParams();
  const code = rawCode.toUpperCase();
  const wellFormed = CODE.test(code);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  // 코드 직접 입력(P-01 코드 입력)에서 왔으면 'code', 링크면 'link'(32 invite_accepted channel)
  const typed = (loc.state as { typed?: boolean } | null)?.typed === true;
  // 다시 시도는 1번만(2026-11-11 S3-21, 7초 동안 뼈대만 보이던 것)
  const preview = useQuery({
    queryKey: ['invite-preview', code],
    queryFn: () => invitePreview(code),
    enabled: wellFormed,
    retry: 1,
  });
  // 로그인 여부는 열 때마다 새로(2026-11-14 R2: 로그인 전에 담아 둔 false가 남아, 가입하고 돌아온 ?go=1이 A-02로 다시 튀었음)
  const signedIn = useQuery({
    queryKey: ['session-has'],
    queryFn: () => session.has(),
    staleTime: 0,
    gcTime: 0,
  });
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, enabled: signedIn.data === true });
  const [result, setResult] = useState<JoinResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);

  const afterJoin = async (r: JoinResult) => {
    if (r === 'joined' || r === 'resume') {
      if (r === 'joined')
        track('invite_accepted', { hours_since_sent: null, channel: typed ? 'code' : 'link' });
      prefs.setPendingInvite(null);
      await qc.invalidateQueries({ queryKey: qk.joinContext });
      const fresh = await me.refetch();
      nav(joinPath((fresh.data?.onboarding_step ?? 'P-03').toLowerCase()), { replace: true });
      return;
    }
    setMoving(false);
    // 막힌 코드(만료, 잘못됨, 공간 가득 등)는 다시 열어도 이어 가지 않음
    if (r !== 'has_records') prefs.setPendingInvite(null);
    setResult(r);
  };
  const join = async () => {
    if (busy) return;
    if (!signedIn.data || !me.data) {
      prefs.setReturnTo(`/i/${code}?go=1`); // 로그인, 가입이 끝나면 여기로 돌아와 바로 합류
      prefs.setPendingInvite(code); // 가입 도중 앱을 닫았다 열어도 합류로(R2)
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

  // ?go=1이면 한 번 바로 합류: 로그인하고 돌아온 길, 또는 O-01 첫 실행 시트에서 이미 ‘합류하기’를 누른 길
  // (2026-11-13 실구동: 시트 뒤 P-01에서 합류를 한 번 더 눌러야 했음). 로그인 전이면 초대가 유효할 때만 바로 A-02로,
  // 주소에서 go를 빼 두어 A-02에서 뒤로 오면 P-01이 보임(다시 넘어가지 않음)
  const auto = useRef(false);
  useEffect(() => {
    // 이 화면을 연 뒤 새로 확인한 로그인 여부로만(옛 값으로 A-02에 보내지 않음, R2)
    if (
      auto.current ||
      params.get('go') !== '1' ||
      !signedIn.isFetchedAfterMount ||
      signedIn.isFetching
    )
      return;
    if (signedIn.data ? !me.data : preview.data?.status !== 'ok') return;
    auto.current = true;
    if (!signedIn.data) nav(`/i/${code}`, { replace: true });
    void join();
  }, [me.data, signedIn.data, signedIn.isFetchedAfterMount, signedIn.isFetching, preview.data]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const off =
      (typeof navigator !== 'undefined' && navigator.onLine === false) ||
      (preview.error instanceof AuthCallError && preview.error.code === 'network');
    return (
      <QuestionLayout
        hero={<StatusArt name={off ? 'status-offline' : 'status-error'} />}
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
      // 2026-11-11 S3-15: 다른 상태 화면처럼 96px 그림 자리 + 가운데
      <QuestionLayout
        hero={<StatusArt name="status-has-records" />}
        title={copy.hasRecords}
        help={copy.hasRecordsHelp}
        center
        primary={{ label: copy.join }}
        secondary={{ label: copy.cancel, onClick: () => nav('/', { replace: true }) }}
        onSubmit={() => setMoving(true)}
      />
    );
  }

  // 합류 불가(15 A-07 7번, 2026-11-10 S1-06): 제목 = 예외 문구, 위에 상태 그림 자리. 막다른 화면 없이
  // ‘코드 다시 입력하기’(P-01 코드 입력) + 로그인 전 ‘처음으로’(A-02), 로그인됨 ‘홈으로 가기’(2026-11-11 D4).
  // 잘못된 코드면 코드 상자를 보이지 않음(이상한 글자를 크게 보여 주지 않게)
  if (blocked) {
    return (
      <QuestionLayout
        hero={<StatusArt name="status-invite-blocked" />}
        title={copy.errors[blocked]}
        center
        primary={{ label: copy.reenterCode }}
        secondary={
          loggedIn
            ? { label: copy.toHome, onClick: goHome }
            : { label: copy.toStart, onClick: () => nav(paths.login) }
        }
        onSubmit={() => nav(paths.joinCode, { state: { from: loggedIn ? '/' : paths.login } })}
      >
        {blocked !== 'invalid' && (
          <p className="hg-invite-code hg-invite-code--static">
            <span className="hg-sr">{`${copy.codeLabel} ${code.split('').join(' ')}`}</span>
            <CodeCells value={code} />
          </p>
        )}
      </QuestionLayout>
    );
  }

  // 2026-11-03 질문 화면 틀: 제목 위, 코드는 바로 아래 회색 상자(O-07과 같은 모양).
  // 2026-11-10 그림 + 제목 + 코드 상자 + 안내를 가운데 정렬(다른 상태 화면과 같게)
  return (
    <QuestionLayout
      hero={<Illustration name="scene-invite" className="hg-sceneart hg-sceneart--tall" motion />}
      title={p?.inviter ? copy.invited(p.inviter) : copy.join}
      help={copy.invitedHelp}
      center
      primary={{ label: copy.join, loading: busy }}
      onSubmit={() => void join()}
    >
      <p className="hg-invite-code hg-invite-code--static">
        <span className="hg-sr">{`${copy.codeLabel} ${code.split('').join(' ')}`}</span>
        <CodeCells value={code} />
      </p>
      {signedIn.data && me.data && (
        <p className="hg-help">
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
