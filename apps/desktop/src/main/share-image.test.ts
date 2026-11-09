import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' }, dialog: {} }));
const { ShareImage, pngBytes } = await import('./share-image');

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString(
  'base64',
);

describe('이미지 공유(W-01 ‘공유하기’) 값 검사', () => {
  it('PNG만 받음', () => {
    expect(pngBytes(png)?.length).toBe(11);
    expect(pngBytes(Buffer.from('hello world').toString('base64'))).toBeNull();
    expect(pngBytes('')).toBeNull();
  });
  it('파일 이름은 .png와 안전한 글자만', () => {
    expect(ShareImage.safeParse({ name: 'sweetwo-plan-2026-11-09.png', base64: png }).success).toBe(
      true,
    );
    expect(ShareImage.safeParse({ name: '../x.png', base64: png }).success).toBe(false);
    expect(ShareImage.safeParse({ name: 'x.exe', base64: png }).success).toBe(false);
  });
});
