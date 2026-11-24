import { avatarInitialCount, avatarInitials, avatarPhotoSrc } from '@sweetwo/core';
import { useState } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

// 사람 표시(Avatar) 하나. 사용자가 직접 올린 사진이 있으면 사진, 없으면 사람 색 원 + 닉네임 앞 최대 3자(2026-11-18).
// 닉네임이 없거나 파트너 빈 자리면 사람 아이콘. 소셜 계정 사진은 쓰지 않는다. docs/design/components/Avatar.md
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** 닉네임(이름이나 애칭). 글자 아바타의 글자 */
  name?: string | null;
  /** 사람 번호: 먼저 시작한 사람 1, 합류한 사람 2(누가 보든 같음) */
  no?: 1 | 2;
  /** sm 24, md 32(기본), lg 40, xl 72. 다른 크기는 소비자 CSS가 정함 */
  size?: AvatarSize;
  /** 직접 올린 프로필 사진 주소(avatars 저장소의 서명 주소만 넘김) */
  src?: string;
  /** 파트너 빈 자리 */
  empty?: boolean;
  /** 사진 대체 글(화면 읽기). 없으면 꾸밈이라 숨김 */
  alt?: string;
  className?: string;
}

const SIZE: Record<AvatarSize, string | false> = {
  sm: 'hg-avatar--sm',
  md: false,
  lg: 'hg-avatar--lg',
  xl: 'hg-avatar--xl',
};

export function Avatar({ name, no = 1, size = 'md', src, empty, alt, className }: AvatarProps) {
  // 사진이 안 열리면(주소 만료, 소셜 주소 등) 깨진 그림 대신 글자 원(2026-11-24). 모든 사용처가 여기서 한 번에 처리
  const [failed, setFailed] = useState<string | null>(null);
  const base = cx('hg-avatar', SIZE[size], className);
  const photo = avatarPhotoSrc(src, { empty, failed });
  if (photo)
    return (
      <span className={cx(base, 'hg-avatar--photo')} aria-hidden={alt ? undefined : true}>
        <img src={photo} alt={alt ?? ''} onError={() => setFailed(photo)} />
      </span>
    );
  const initials = empty ? '' : avatarInitials(name);
  if (!initials)
    return (
      <span
        className={cx(base, empty ? 'hg-avatar--empty' : `hg-avatar--p${no}`)}
        aria-hidden="true"
      >
        <Icon name="user" />
      </span>
    );
  return (
    <span
      className={cx(base, `hg-avatar--p${no}`, `hg-avatar--n${avatarInitialCount(name)}`)}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
