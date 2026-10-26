import { Button, ListRow, PageHeader } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectPlatform, isApp, type UpdateState } from '../../../platform';
import { MainFrame } from '../../frame';
import { copy } from '../copy';

/** 웹사이트 페이지를 새 창으로(데스크톱은 기본 브라우저) */
export const openSite = (path: string) =>
  window.open(`${copy.siteUrl}${path}`, '_blank', 'noopener');

const updateText = (s: UpdateState): string | undefined =>
  s.status === 'checking'
    ? copy.update.checking
    : s.status === 'latest'
      ? copy.update.latest
      : s.status === 'downloading'
        ? copy.update.downloading(s.percent)
        : s.status === 'ready'
          ? copy.update.ready(s.version)
          : s.status === 'error'
            ? copy.update.error
            : undefined;

// S-19 앱 정보(docs/spec/25-settings.md): 버전 + ‘새 기능 보기’(L-03), ‘업데이트 확인’(데스크톱 자동 업데이트),
// 이용약관·개인정보 처리방침(L-05), 문의하기(S-19a). 업데이트 확인은 데스크톱만(웹은 늘 최신, 휴대폰은 스토어).
// 다 받았으면 “다시 시작” = 지금 설치. 그냥 두면 다음에 켤 때 바뀜.
export function S19About() {
  const nav = useNavigate();
  const bridge = typeof window !== 'undefined' ? window.sweetwo : undefined;
  const version = isApp(detectPlatform()) ? (bridge?.appVersion ?? '') : 'web';
  const updater = bridge?.update;
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' });
  useEffect(() => {
    if (!updater) return;
    void updater.state().then(setUpdate);
    return updater.onState(setUpdate);
  }, [updater]);
  const busy = update.status === 'checking' || update.status === 'downloading';
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.about}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <div className="hg-list">
        <ListRow label={copy.version} value={version} chevron={false} />
        <ListRow label={copy.whatsNew} onClick={() => openSite('/releases')} />
        {updater && (
          <ListRow
            label={copy.checkUpdate}
            sub={updateText(update)}
            onClick={
              busy || update.status === 'ready'
                ? undefined
                : () => void updater.check().then(setUpdate)
            }
          />
        )}
      </div>
      {updater && update.status === 'ready' && (
        <div className="hg-row" role="status">
          <Button variant="primary" onClick={() => void updater.install()}>
            {copy.update.restart}
          </Button>
        </div>
      )}
      <div className="hg-list">
        <ListRow label={copy.terms} onClick={() => openSite('/terms')} />
        <ListRow label={copy.privacy} onClick={() => openSite('/privacy')} />
      </div>
      <div className="hg-list">
        <ListRow label={copy.contact} onClick={() => nav('/settings/help/inquiry')} />
        <ListRow label={copy.myInquiries} onClick={() => nav('/settings/help/inquiries')} />
      </div>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
