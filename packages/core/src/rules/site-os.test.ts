import { expect, test } from 'vitest';
import { detectSiteOs, isPhoneOs } from './site-os';

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const WIN10 =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/130 Mobile';
const GALAXY_TAB = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari';

test('접속 OS: 휴대폰·태블릿은 그 기기 스토어, PC와 모름은 그 밖', () => {
  expect(detectSiteOs(IPHONE)).toBe('ios');
  expect(detectSiteOs(IPAD)).toBe('ios');
  expect(detectSiteOs(ANDROID)).toBe('android');
  expect(detectSiteOs(GALAXY_TAB)).toBe('android');
  expect(detectSiteOs(MAC)).toBe('other');
  expect(detectSiteOs(WIN10)).toBe('other');
  expect(detectSiteOs('')).toBe('other');
  expect(isPhoneOs('ios')).toBe(true);
  expect(isPhoneOs('other')).toBe(false);
});
