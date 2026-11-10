import { useId, type ReactNode } from 'react';
import type { AuthProvider } from '@sweetwo/core';
import { Button, type ButtonProps } from './Button';
import { ProviderMark } from './ProviderMark';

export interface ProviderButtonProps extends Omit<ButtonProps, 'variant' | 'children'> {
  provider: AuthProvider;
  // 기본은 provider로 정함(카카오=kakao, 그 외=secondary). 이메일 충돌 강조 때만 'primary' 등으로 덮어쓴다.
  variant?: ButtonProps['variant'];
  // 이 기기에서 마지막으로 쓴 방법이면 '최근 사용' 말풍선 표시
  recent?: boolean;
  recentLabel?: ReactNode;
  // 말풍선에 ‘최근 사용’ 대신 보일 문구(이메일 충돌: 이미 이 방법으로 가입함)
  bubble?: ReactNode;
  children: ReactNode;
}

// A-02 소셜 로그인 버튼(docs/design/components/ProviderButton.md). Button + ProviderMark + 최근 사용 말풍선.
export function ProviderButton({
  provider,
  variant,
  recent,
  recentLabel,
  bubble,
  children,
  ...rest
}: ProviderButtonProps) {
  const v = variant ?? (provider === 'kakao' ? 'kakao' : 'secondary');
  // 말풍선(‘최근 사용’, 이메일 충돌)은 버튼 이름에 붙지 않게 따로 설명으로(2026-11-10, 이름은 공식 문구 그대로)
  const noteId = useId();
  const note = bubble ?? (recent ? recentLabel : undefined);
  return (
    <Button
      variant={v}
      block
      aria-describedby={note ? noteId : undefined}
      {...rest}
      // 2026-11-10 애플은 채움 버튼(라이트 검정 바탕 흰 글자, 다크 흰 바탕 검정 글자: ink/on-ink 토큰), 이메일 충돌 강조 때는 덮지 않음
      className={['hg-btn--provider', provider === 'apple' && !variant && 'hg-btn--apple', rest.className]
        .filter(Boolean)
        .join(' ')}
    >
      <ProviderMark provider={provider} />
      <span className="hg-btn__label">{children}</span>
      {note && (
        <span
          id={noteId}
          className={bubble ? 'hg-auth__bubble' : 'hg-auth__recent'}
          aria-hidden="true"
        >
          {note}
        </span>
      )}
    </Button>
  );
}
