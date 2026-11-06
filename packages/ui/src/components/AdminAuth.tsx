import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Wordmark } from './Wordmark';

// 어드민 로그인·2단계 인증 틀(docs/design/components/AdminAuth.md, 2026-11-06).
// 연회색 바탕 가운데 흰 카드(400px): 검정 워드마크 + 태그 “어드민” → (아이콘) 제목, 도움말 → 입력·버튼 → 아래 작은 글.
// 참고: Laravel Cloud, Stripe, Buffer 로그인·인증 화면.
export function AdminAuth({
  icon,
  title,
  help,
  children,
  foot,
}: {
  /** 제목 위 작은 아이콘 원(메일 보냄 등) */
  icon?: IconName;
  title: ReactNode;
  help?: ReactNode;
  children?: ReactNode;
  /** 카드 아래 작은 글 */
  foot?: ReactNode;
}) {
  return (
    <div className="hg-adminauth">
      <main className="hg-adminauth__card">
        <div className="hg-adminauth__brand">
          <Wordmark tone="mono" height={24} />
          <span className="hg-tag">어드민</span>
        </div>
        {icon && (
          <span className="hg-adminauth__icon" aria-hidden="true">
            <Icon name={icon} />
          </span>
        )}
        <h1 className="hg-adminauth__title">{title}</h1>
        {help && <p className="hg-adminauth__help">{help}</p>}
        <div className="hg-adminauth__body">{children}</div>
      </main>
      {foot && <p className="hg-adminauth__foot">{foot}</p>}
    </div>
  );
}
