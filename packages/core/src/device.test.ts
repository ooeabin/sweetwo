import { describe, expect, it } from 'vitest';
import { deviceLabel } from './device';

describe('기기 이름', () => {
  it('앱, 브라우저, OS', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537')).toBe(
      'Chrome(Windows)',
    );
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Edg/130')).toBe('Edge(Windows)');
    expect(deviceLabel('Mozilla/5.0 (Macintosh) Version/17 Safari/605')).toBe('Safari(Mac)');
    expect(deviceLabel(null)).toBe('알 수 없는 기기');
  });
  it('모바일 앱(웹뷰에 sweeTwo)', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Mobile sweeTwo',
      ),
    ).toBe('휴대폰 앱(iOS)');
    expect(
      deviceLabel('Mozilla/5.0 (Linux; Android 15) Chrome/130 Mobile Safari/537 sweeTwo'),
    ).toBe('휴대폰 앱(Android)');
    // iPad 앱 웹뷰(Mac처럼 알려 줌)
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit sweeTwo')).toBe(
      '휴대폰 앱(iOS)',
    );
  });
});
