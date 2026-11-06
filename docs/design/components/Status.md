# Status

어드민 표와 화면 머리의 상태 값(2026-11-06). 색 판 배지 대신 작은 점 + 글자라 표가 단정하다.

- `hg-status` + `hg-status--{tone}`: 앞에 6px 점, 글자 13px 500 `ink-2`, 점과 글자 사이 6px.
- 점 색: `ok` `invest-ink`(끝남, 연결, 게시, 승인), `warn` `warning-ink`(손볼 것: 접수, 승인 대기, 해제 대기), `bad` `danger`(거절, 잠금, 답변 기한 넘김, 글자도 `danger`), `info` `accent-ink`(처리 중), `off` `muted`(초안, 내림, 미합류, 혼자 쓰기, 사용자 답변 대기, 글자 `stone`).
- 뜻은 늘 글자가 말한다. 색만으로 말하지 않는다.
- 상태 → 색 표는 `apps/admin/src/tones.ts` 한 곳에 둔다.
- 사용자 앱에는 쓰지 않는다(앱은 Badge).

React 래퍼: `Status`(packages/ui, `tone`, 글자).

쓰는 곳: AD-02 부부 상태, AD-06 기한 넘긴 경과 시간과 문의 상세 머리, AD-10 공지 상태, AD-14 약관 승인 상태, AD-18 승인 상태와 관리자 잠금.
