// 웹사이트 브라우저 쪽 동작: 기기별 스토어 버튼, 상단 ‘앱 받기’, 접기, UTM 저장, 측정 이벤트.
// 측정은 GA4(gtag.js, ADR 0010, 28 ‘측정과 쿠키’): 운영 빌드에 PUBLIC_GA_MEASUREMENT_ID가 있을 때만. 없으면(개발·e2e) 개발 중 콘솔만.
import { detectSiteOs, type SiteOs } from '@sweetwo/core';
import { URLS } from './site';

type Props = Record<string, string | number | boolean>;
type Gtag = (...args: unknown[]) => void;
type GaWindow = { dataLayer?: unknown[]; gtag?: Gtag };

export function track(name: string, props: Props = {}) {
  const w = window as unknown as GaWindow;
  if (w.gtag) w.gtag('event', name, props);
  else if (import.meta.env.DEV) console.debug('[site]', name, props);
}

/** 측정하지 않는 주소: 초대(/i/ 코드), 로그인 복귀(/auth/ code), 앱 열기 안내(/n/) */
export const NO_GA_PATH = /^\/(i|auth|n)(\/|$)/;

/** GA에 보낼 페이지 주소: 쿼리는 utm_*만 남기고 해시는 뺌(코드·토큰이 주소에 실려 나가지 않게) */
export function gaPageLocation(href: string): string {
  const u = new URL(href);
  const keep = [...u.searchParams.entries()].filter(([k]) => k.startsWith('utm_'));
  const q = new URLSearchParams(keep).toString();
  return `${u.origin}${u.pathname}${q ? `?${q}` : ''}`;
}

/** gtag.js를 붙인다(인라인 스크립트 없이). 광고 맞춤 신호·Google 신호 끔 */
function startGa(id: string) {
  if (!/^G-[A-Z0-9]+$/.test(id) || NO_GA_PATH.test(location.pathname)) return;
  const w = window as unknown as GaWindow;
  w.dataLayer = w.dataLayer ?? [];
  // gtag.js는 arguments 객체를 dataLayer에서 읽음(공식 스니펫과 같은 모양)
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer?.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', id, {
    page_location: gaPageLocation(location.href),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.append(s);
}

const safe = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch {
    return fallback;
  }
};
const UTM_KEY = 'sweetwo-utm';

/** UTM 값은 웹사이트 이벤트에만(28 ‘측정과 쿠키’): 들어올 때 저장해 두고 이벤트에 붙임 */
function keepUtm() {
  const q = new URLSearchParams(location.search);
  const utm = [...q.entries()].filter(([k]) => k.startsWith('utm_'));
  if (utm.length)
    safe(() => localStorage.setItem(UTM_KEY, new URLSearchParams(utm).toString()), undefined);
}
const utmProps = (): Props =>
  Object.fromEntries(new URLSearchParams(safe(() => localStorage.getItem(UTM_KEY), null) ?? ''));

/** 앱 받기 영역(data-download): 기기에 맞는 것만 보이게 */
function downloads(os: SiteOs) {
  document.querySelectorAll<HTMLElement>('[data-download]').forEach((box) => {
    box.querySelectorAll<HTMLElement>('[data-os]').forEach((el) => {
      const want = el.dataset.os ?? '';
      el.hidden = !want.split(' ').includes(os);
    });
  });
  document.querySelectorAll<HTMLAnchorElement>('a[data-store]').forEach((a) =>
    a.addEventListener('click', () =>
      track('site_store_clicked', {
        store: a.dataset.store ?? '',
        placement: a.dataset.placement ?? '',
        ...utmProps(),
      }),
    ),
  );
  // 상단 ‘앱 받기’: 휴대폰은 그 기기 스토어, 그 밖은 맨 아래 앱 받기(#get)
  document.querySelectorAll<HTMLAnchorElement>('a[data-get-app]').forEach((a) => {
    if (os === 'ios' || os === 'android') {
      a.href = os === 'ios' ? URLS.appStore : URLS.playStore;
      a.dataset.store = os === 'ios' ? 'app_store' : 'google_play';
      a.addEventListener('click', () =>
        track('site_store_clicked', {
          store: a.dataset.store ?? '',
          placement: 'top',
          ...utmProps(),
        }),
      );
    }
  });
}

/** 접기(hg-acc): 버튼 aria-expanded, 답 hidden */
export function accordions(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('.hg-acc__q').forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', () => {
      const a = document.getElementById(b.getAttribute('aria-controls') ?? '');
      if (!a) return;
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      b.closest('.hg-acc__item')?.classList.toggle('is-open', open);
      a.hidden = !open;
      if (open && b.dataset.faq) track('site_faq_opened', { faq_id: b.dataset.faq });
    });
  });
}

export function boot() {
  const ga = import.meta.env.PUBLIC_GA_MEASUREMENT_ID as string | undefined;
  if (import.meta.env.PROD && ga) startGa(ga);
  const os = detectSiteOs(navigator.userAgent);
  document.documentElement.dataset.os = os;
  downloads(os);
  accordions();
  keepUtm();
  return os;
}
