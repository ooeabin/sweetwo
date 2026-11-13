/// <reference types="vite/client" />
/** 빌드할 때 넣는 docs/ 마지막 커밋(짧은 해시와 날짜). 없으면 빈 글자 */
declare const __DOCS_COMMIT__: string;
/** 빌드할 때 넣는 문서별 마지막 수정(docs/ 기준 경로 → ‘짧은 해시 날짜’) */
declare const __DOCS_DATES__: Record<string, string>;
