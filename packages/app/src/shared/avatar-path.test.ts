import { isAvatarPath } from '@sweetwo/api';
import { expect, it } from 'vitest';

it('사진으로 인정하는 경로는 우리 저장소 avatars/{공간}/{사람}.jpg 모양뿐(소셜 계정 사진 주소는 무시)', () => {
  expect(
    isAvatarPath('0b9a4c52-1d1e-4d4f-9a53-1f0a3a0c1111/7c1f6a30-3b0e-4f7a-8e6b-2d9d5c0a2222.jpg'),
  ).toBe(true);
  expect(isAvatarPath('https://lh3.googleusercontent.com/a/xyz=s96-c')).toBe(false);
  expect(isAvatarPath('http://k.kakaocdn.net/dn/abc/img.jpg')).toBe(false);
  expect(isAvatarPath('//evil.example.com/a/b.jpg')).toBe(false);
  expect(isAvatarPath('../x/y.jpg')).toBe(false);
  expect(isAvatarPath('a/b.png')).toBe(false);
  expect(isAvatarPath(null)).toBe(false);
  expect(isAvatarPath('')).toBe(false);
});
