import { describe, expect, it } from 'vitest';
import { avatarInitialCount, avatarInitials, avatarPhotoSrc } from './avatar';

describe('avatarInitials', () => {
  it('두 글자 이름은 그대로', () => {
    expect(avatarInitials('예빈')).toBe('예빈');
  });
  it('세 글자 이름은 세 글자', () => {
    expect(avatarInitials('윤예빈')).toBe('윤예빈');
  });
  it('긴 이름은 앞에서 3자', () => {
    expect(avatarInitials('김철수바보')).toBe('김철수');
  });
  it('영문은 대문자로 바꾸지 않고 앞에서 3자', () => {
    expect(avatarInitials('Chanwoo')).toBe('Cha');
    expect(avatarInitials('chanwoo')).toBe('cha');
  });
  it('숫자도 글자', () => {
    expect(avatarInitials('1234')).toBe('123');
  });
  it('공백은 빼고 센다', () => {
    expect(avatarInitials('  김 철 수바보')).toBe('김철수');
    expect(avatarInitials('a b')).toBe('ab');
  });
  it('이모지와 조합 문자가 깨지지 않는다', () => {
    expect(avatarInitials('🐰🐻🦊🐼')).toBe('🐰🐻🦊');
    expect(avatarInitials('👨‍👩‍👧예빈')).toBe('👨‍👩‍👧예빈');
    expect(avatarInitials('🇰🇷🇯🇵빈')).toBe('🇰🇷🇯🇵빈');
    expect(avatarInitials('éabc')).toBe('éab');
  });
  it('이름이 없으면 빈 글자', () => {
    expect(avatarInitials('')).toBe('');
    expect(avatarInitials('   ')).toBe('');
    expect(avatarInitials(null)).toBe('');
    expect(avatarInitials(undefined)).toBe('');
  });
});

it('avatarInitialCount는 1~3, 없으면 0', () => {
  expect(avatarInitialCount('예')).toBe(1);
  expect(avatarInitialCount('예빈')).toBe(2);
  expect(avatarInitialCount('김철수바보')).toBe(3);
  expect(avatarInitialCount('🐰🐻🦊🐼')).toBe(3);
  expect(avatarInitialCount('')).toBe(0);
});

describe('avatarPhotoSrc (사진이 안 열리면 글자 원으로)', () => {
  const url = 'https://x.supabase.co/storage/v1/object/sign/avatars/s/u.jpg?token=t';
  it('주소가 있으면 사진', () => {
    expect(avatarPhotoSrc(url)).toBe(url);
  });
  it('빈 값, 공백, 없음이면 사진 없음', () => {
    expect(avatarPhotoSrc('')).toBeUndefined();
    expect(avatarPhotoSrc('   ')).toBeUndefined();
    expect(avatarPhotoSrc(null)).toBeUndefined();
    expect(avatarPhotoSrc(undefined)).toBeUndefined();
  });
  it('불러오기에 실패한 주소와 파트너 빈 자리는 사진 없음, 다른 주소는 다시 사진', () => {
    expect(avatarPhotoSrc(url, { failed: url })).toBeUndefined();
    expect(avatarPhotoSrc(url, { failed: 'https://other/a.jpg' })).toBe(url);
    expect(avatarPhotoSrc(url, { empty: true })).toBeUndefined();
  });
});
