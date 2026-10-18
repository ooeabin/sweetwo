import { expect, test } from 'vitest';
import { detectSiteOs, installOs } from './site-os';

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const MAC_OLD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 Safari/605.1.15';
const WIN10 =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const WIN7 = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 Chrome/109 Safari/537.36';
const WIN32 = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';

test('접속 OS: Mac, Windows 10 64비트, 휴대폰', () => {
  expect(detectSiteOs(MAC)).toBe('mac');
  expect(detectSiteOs(WIN10)).toBe('win');
  expect(detectSiteOs(IPHONE)).toBe('mobile');
  expect(detectSiteOs(ANDROID)).toBe('mobile');
});

test('지원하지 않는 OS: macOS 10.14 이하(알 수 있을 때만), Windows 7·8, 32비트', () => {
  expect(detectSiteOs(MAC_OLD)).toBe('unsupported');
  expect(detectSiteOs(WIN7)).toBe('unsupported');
  expect(detectSiteOs(WIN32)).toBe('unsupported');
});

test('모름: 리눅스 등', () => {
  expect(detectSiteOs('Mozilla/5.0 (X11; Linux x86_64) Chrome/130')).toBe('unknown');
  expect(detectSiteOs('')).toBe('unknown');
});

test('L-02 os 값: 맞으면 그대로, 없거나 틀리면 접속 OS', () => {
  expect(installOs('win', MAC)).toBe('win');
  expect(installOs('linux', MAC)).toBe('mac');
  expect(installOs(null, IPHONE)).toBeNull();
});
