import { parseConsentDoc } from '@sweetwo/core';
import { BottomSheet, Button } from '@sweetwo/ui';
import { useMemo } from 'react';
import marketingMd from '../../content/consents/marketing.md?raw';
import privacyMd from '../../content/consents/privacy.md?raw';
import spaceSharingMd from '../../content/consents/space-sharing.md?raw';
import { copy } from './copy';
import { session } from './session';

// A-05·A-05r ‘보기’(15 A-05 2·3번, 2026-11-10): 앱 밖 새 창 대신 앱 안에서.
// - 개인정보 수집·이용, 공간 공유, 마케팅: 동의 문서(apps/site/src/content/consents, pnpm content:sync)를 시트로
// - 이용약관(과 A-05r ‘바뀐 점 보기’): 웹사이트 L-05를 앱 안 브라우저(브리지 openUrl)로. 브리지가 없으면(개발) 새 창
export type ConsentDocKey = 'privacy' | 'spaceSharing' | 'marketing';
const SOURCES: Record<ConsentDocKey, string> = {
  privacy: privacyMd,
  spaceSharing: spaceSharingMd,
  marketing: marketingMd,
};

export function openPolicy(url: string) {
  const b = session.bridge;
  if (b?.openUrl) void b.openUrl(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function ConsentDocSheet({ doc, onClose }: { doc: ConsentDocKey; onClose: () => void }) {
  const d = useMemo(() => parseConsentDoc(SOURCES[doc]), [doc]);
  return (
    <BottomSheet
      title={d.title}
      onClose={onClose}
      closeLabel={copy.close}
      // 긴 글이라 아래에 보이는 ‘닫기’(시트 × 는 키보드로만 보임)
      actions={
        <Button variant="secondary" block onClick={onClose}>
          {copy.close}
        </Button>
      }
    >
      <div className="hg-doc">
        {d.blocks.map((b, i) =>
          b.kind === 'h2' ? (
            <h2 key={i}>{b.text}</h2>
          ) : b.kind === 'ul' ? (
            <ul key={i}>
              {b.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{b.text}</p>
          ),
        )}
      </div>
    </BottomSheet>
  );
}
