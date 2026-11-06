import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark';

// 어드민 로그인·2단계 인증 틀(docs/design/components/AdminAuth.md, 2026-11-06).
// 연회색 바탕 가운데 흰 카드(400px): 워드마크(브랜드 색) + 태그 “어드민” → 제목, 도움말 → 입력·버튼 → 아래 작은 글.
// 참고: Laravel Cloud, Stripe, Buffer 로그인·인증 화면.
export function AdminAuth({
  title,
  help,
  children,
  foot,
}: {
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
          <Wordmark height={24} />
          <span className="hg-tag">어드민</span>
        </div>
        <h1 className="hg-adminauth__title">{title}</h1>
        {help && <p className="hg-adminauth__help">{help}</p>}
        <div className="hg-adminauth__body">{children}</div>
      </main>
      {foot && <p className="hg-adminauth__foot">{foot}</p>}
    </div>
  );
}
