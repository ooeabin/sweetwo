import { Button } from '@sweetwo/ui';
import { MainFrame } from '../frame';
import { copy } from './copy';

/** 설정 화면을 불러오지 못했을 때(빈 화면 대신, 2026-11-03): 안내 + 다시 시도 */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const body = (
    <div className="hg-banner hg-banner--info" role="alert">
      <span>{copy.failed}</span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {copy.retry}
      </Button>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
