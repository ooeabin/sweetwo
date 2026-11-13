// 웹사이트 브라우저 쪽 동작: 기기별 스토어 버튼, 상단 ‘앱 받기’, 접기, UTM 저장, 측정 이벤트.
// 측정은 PostHog(쿠키 없음) 연결 전까지 보내지 않고 개발 중에만 콘솔에 남김(28 ‘측정과 쿠키’).
import { detectSiteOs, type SiteOs } from '@sweetwo/core';
import { URLS } from './site';

type Props = Record<string, string | number | boolean>;
export function track(name: string, props: Props = {}) {
  const w = window as unknown as { posthog?: { capture: (n: string, p: Props) => void } };
  if (w.posthog) w.posthog.capture(name, props);
  else if (import.meta.env.DEV) console.debug('[site]', name, props);
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
  const os = detectSiteOs(navigator.userAgent);
  document.documentElement.dataset.os = os;
  downloads(os);
  accordions();
  keepUtm();
  return os;
}
