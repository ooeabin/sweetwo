import { sharedCopy } from '../../shared/copy';

/**
 * 못 불러옴 카드(13 공통 상태 7번, 2026-11-25 구역 7 CS-07): “잠시 문제가 생겼어요” / “다시 시도해 주세요” + ‘다시 시도’(다시 요청).
 * 화면 전체를 못 불러올 때(LoadErrorFrame)와 한 자리만 못 불러올 때(월급 탭, 캘린더 본문)가 같은 모양.
 */
export function LoadErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="hg-card hg-card--fill hg-stack" role="status">
      <p className="hg-card__title">{sharedCopy.errorTitle}</p>
      <p className="hg-card__meta">{sharedCopy.errorBody}</p>
      <button
        type="button"
        className="hg-btn hg-btn--link"
        style={{ alignSelf: 'flex-start' }}
        onClick={onRetry}
      >
        {sharedCopy.retry}
      </button>
    </section>
  );
}
