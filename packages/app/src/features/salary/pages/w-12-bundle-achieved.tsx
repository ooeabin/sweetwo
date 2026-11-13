import { achieveBundle } from '@sweetwo/api';
import { DoneMark, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { hideToast } from '../../../shared/toast';
import { copy } from '../copy';
import { savingPaths, togetherPaths } from '../paths';
import { useBundles } from '../together';

/**
 * W-12 묶음 달성 축하(20 v2.2 ‘W-12, W-12a, W-12b’: 묶음은 합계 기준, 두 사람 모두 W-12). 사람마다 한 번(서버 achieve_bundle).
 * 큰 숫자 = 합계(퍼센트만이면 %). “다음” → W-12b(다음 저금, 내 저금 기준). ‘그만할게요’는 각자 자기 저금 W-10에서
 */
export function W12BundleAchieved() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const bundles = useBundles();
  const { masked } = useMask();
  const b = bundles.data?.find((x) => x.id === id);
  const mine = b?.goals.find((g) => g.mine);
  const sent = useRef(false);
  useEffect(() => {
    if (!b || sent.current) return;
    sent.current = true;
    track('bundle_achieved', { entry: 'celebrate', has_target: true, on: true });
  }, [b]);
  if (bundles.isLoading) return <QuestionSkeleton />;
  if (!b || !mine || b.status !== 'achieved')
    return <Navigate to={mine ? savingPaths.item(mine.id) : savingPaths.list} replace />;
  return (
    <QuestionLayout
      center
      celebrate
      hero={<DoneMark art="celebrate" />}
      title={
        <>
          <span className="hg-celebrate__eyebrow">{copy.bundleDone}</span>
          <span className="hg-celebrate__title">{b.name}</span>
        </>
      }
      primary={{ label: copy.next }}
      onSubmit={() => {
        hideToast();
        nav(`${togetherPaths.next(mine.id)}?why=achieved`, { replace: true });
      }}
    >
      <div className="hg-celebrate__body hg-celebrate__body--plain">
        <p className="hg-celebrate__value">
          {b.percent_only ? `${b.pct ?? 100}%` : money(b.total ?? 0, masked)}
        </p>
      </div>
    </QuestionLayout>
  );
}

/**
 * 묶음 달성 지켜보기: 내가 든 묶음이 달성(합계 ≥ 목표 금액, 서버 bundle_refresh)이고 이 사람이 처음 보면 축하로.
 * W-10, W-13, 월급 탭에 붙음(홈 H-10도 쓸 수 있게 index에서 내보냄). 한 번에 하나
 */
export function BundleAchieveWatch() {
  const bundles = useBundles();
  const nav = useNavigate();
  const tried = useRef(new Set<string>());
  const key = (bundles.data ?? []).map((b) => `${b.id}:${b.status}`).join('|');
  useEffect(() => {
    const b = (bundles.data ?? []).find(
      (x) => x.status === 'achieved' && x.goals.some((g) => g.mine) && !tried.current.has(x.id),
    );
    if (!b) return;
    tried.current.add(b.id);
    void achieveBundle(b.id)
      .then((first) => {
        if (!first) return;
        hideToast(1500);
        nav(togetherPaths.bundleAchieved(b.id));
      })
      .catch(() => undefined);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
