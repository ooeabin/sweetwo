import { ListRow, PageHeader } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { detectPlatform, isApp } from '../../../platform';
import { MainFrame } from '../../frame';
import { copy } from '../copy';

/** 웹사이트 페이지를 새 창으로(데스크톱은 기본 브라우저) */
export const openSite = (path: string) =>
  window.open(`${copy.siteUrl}${path}`, '_blank', 'noopener');

// S-19 앱 정보(docs/spec/25-settings.md): 버전 + ‘새 기능 보기’(L-03), 이용약관·개인정보 처리방침(L-05), 문의하기(S-19a).
// ‘업데이트 확인’은 데스크톱 자동 업데이트와 함께(웹은 늘 최신).
export function S19About() {
  const nav = useNavigate();
  const version = isApp(detectPlatform()) ? (window.sweetwo?.appVersion ?? '') : 'web';
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
      </div>
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
