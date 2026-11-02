import type { ReactNode } from 'react';
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
  return (
    <Button variant={v} block {...rest}>
      <ProviderMark provider={provider} />
      {children}
      {bubble ? (
        <span className="hg-auth__bubble">{bubble}</span>
      ) : (
        recent && <span className="hg-auth__recent">{recentLabel}</span>
      )}
    </Button>
  );
}
