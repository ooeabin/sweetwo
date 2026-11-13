# ArtPick

> 2026-11-08: 목표 지정 사진 고르기(G-02p)를 없앰(ADR 0007). 지금은 프로필 사진(S-11e) 고르기에만 씀.

지정 그림 고르기(2026-11-03). 목표 지정 사진(G-02p, 2026-11-04 그 종류 1장 + 맨 앞 ‘내 사진 올리기’. 직접 만든 목표는 올리기 칸만).

- 소비자가 주는 것: 항목(이름 + 그림 주소, 그림이 없으면 빈 자리), 지금 고른 이름, 고를 때 동작, 모양(원 `round` / 둥근 네모), 빈 자리 아이콘, 목록 이름, 항목 화면 읽기 이름.
- 모양: `hg-artpick` 격자 4열(사이 `space-3`, 고르기 묶음 `hg-artchoose` 최대 440px). 칸 `hg-artpick__item`은 정사각, 둥근 네모 `radius-lg`, `hg-artpick--round`면 원.
- 그림: `<img>`로 꽉 채움(`object-fit: cover`). 그림 파일이 없으면 `hairline-soft` 회색 바탕 + `stone` 아이콘 24px(아바타는 사람, 목표는 템플릿 아이콘).
- 고른 칸: `aria-pressed="true"`, 바깥 고리(`surface` 2px + `ink` 2px, Avatar 끌어 놓기와 같음) + 오른쪽 아래 `ink` 원 체크(`hg-artpick__check`). 브랜드 오렌지는 쓰지 않음.
- 칸 아래 이름(2026-11-05) `hg-artpick__name`: 12px `slate` 가운데, 고른 칸은 `ink` 600. 항목에 `name`을 주면 화면 읽기 이름도 같음. G-02p는 “사진 올리기” “내 사진”(올린 사진이 있을 때) “기본 사진”.
- 맨 앞 칸(`lead`): ‘사진 올리기’ `hg-artpick__upload`(투명 바탕 + `border-control` 점선 1.5px + 카메라, 아래 이름). 누르면 파일 고르기, 끌어 놓기도 됨.
- 미리보기 `hg-artprev`: 격자 위에 고른 그림을 크게. 프로필 `--round` 원 120px, 목표 16:10 `radius-xl`. 그림 없으면 회색 바탕 + 아이콘 44px.
- 누르면 고르기만, 아래 주 버튼 “저장하기”로 저장(바꿨을 때만 누를 수 있음). 저장 중에는 칸을 모두 막음.
- 앱 묶음: `shared/art-choose.tsx` ArtChoose. 설정 하위 화면과 같은 QuestionLayout 안에 미리보기 + 격자, 아래 고정 영역에 고지(`note`, 가운데) + 주 버튼 “저장하기”. 올리기 → 같은 틀 안 ImageCrop.
- 키보드: 칸마다 버튼(Tab으로 이동, Enter·Space로 고름), 포커스 고리 `focus-ring`(`ink`).
- 쓰는 곳: G-02p(둥근 네모, [사진 올리기][내 사진][기본 사진]. 직접 만든 목표의 기본 사진은 회색 빈 자리 + 깃발). 레퍼런스: WhatsApp·Snapchat 아바타, Monarch·PayPal 목표 커버.

- 2026-11-08: 그림·아이콘 자리는 2D 플랫으로 다시 만들 때까지 빈 자리(회색 판 `hg-artslot`이나 빈 원·빈 칸). 이 문서의 3D·사진·Phosphor 그림 설명은 다시 만들 때의 주제(→ Illustrations ‘나중 과제’).
