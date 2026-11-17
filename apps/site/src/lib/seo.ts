// 구조화 데이터(JSON-LD, 28 ‘검색·공유 정보’). 별점·후기 같은 값은 넣지 않고 가격은 무료로만.
import type { FaqItem } from '@sweetwo/core';
import { CATCH, URLS, t } from './site';

const ORIGIN = 'https://sweetwo.kr';

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'sweeTwo',
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}/apple-touch-icon.png`,
  email: 'help@sweetwo.kr',
});

export const appLd = () => {
  const appStoreSet = Boolean(import.meta.env.PUBLIC_APP_STORE_URL);
  return {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'sweeTwo',
    alternateName: CATCH,
    description: t.landingDesc,
    inLanguage: 'ko',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'iOS, Android',
    url: `${ORIGIN}/`,
    // 앱 주소는 스토어 등록 뒤 확정된 것만(App Store 값이 없으면 Google Play만)
    installUrl: appStoreSet ? [URLS.appStore, URLS.playStore] : [URLS.playStore],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
  };
};

export const faqLd = (items: FaqItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});
