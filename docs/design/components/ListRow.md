# ListRow

목록 한 줄. 설정 항목, 자산 항목, 파트너 활동에 씀.

- 소비자가 주는 것: 앞 요소(아이콘·Avatar·Toggle, 선택), 라벨, 보조 1줄(선택), 값(선택), 이동 표시(선택).
- 높이 56px 이상, 세로 가운데 정렬. 값은 오른쪽 정렬 `tabular-nums`.
- 누르면 이동하는 줄만 화살표(`hg-chevron`)이고 줄 전체가 `button`(또는 `a`). 토글 줄은 화살표 없음.
- 여러 줄은 `hg-list`로 묶음: 흰 바탕, 1px `hairline-soft` 테두리, `radius-xl`, 행 사이 구분선 없음, 행 높이 60px 이상. 앱 틀의 맨 바깥 묶음은 옅은 그림자(`shadow-1`)를 더함(AppFrame).
- 행 앞 아이콘 칸 `Lead`(`hg-lead`, 40px 원): 영역 색 원 + 아이콘(`hg-lead--together` 등, 공동 생활비 = 우리 둘, 저금 항목 = `goal` 저금통) 또는 사진(`photo`, `hg-lead--photo`, 원 안을 꽉 채움. 2026-11-08 목표 사진을 없애 지금 쓰는 곳 없음). 장식이라 `aria-hidden`.
- 사진 미리보기 `hg-thumb`(40px, `radius-md`, 잘라 채움): 챙길 날 드린 기록(Y-09)에서 첫 사진. 장식이라 `aria-hidden`, 사진 수는 보조 줄 “사진 3장”.

## 설정 줄

- 값 + 화살표: 오른쪽에 현재 값(`hg-listrow__value is-soft`, `slate` 400) + `hg-chevron`. 누르면 고르는 화면·BottomSheet.
- 스위치 줄: 오른쪽 Toggle(`button role="switch"` + `aria-checked`, 라벨을 `aria-labelledby`로). 줄 자체는 누르는 대상 아님, 바로 적용.
- 앞 아이콘은 20px `ink`, 보조 1줄은 지금 설정을 사실로(“월요일 오전 9시”).
- 줄만 목록(2026-11-04 F-08): `hg-list hg-list--plain`은 테두리·바탕·그림자 없이 줄만. 좌우 여백 0, 값 17px, 보조 14px `slate`. 토스형 구역(StatBlock 아래)에서만.

- 3D 아이콘 앞 칸(2026-11-05): `Lead art3d={icon3d(이름)}`이면 원 판 없이 사물만(`hg-lead--art`, 40px 칸을 꽉 채움, 영역 색 없음). 월급 체크리스트 쓰는 돈 줄(`line-*`, 저금 줄은 저금통 아이콘 `Lead icon="piggy-bank"`, 2026-11-08), 캘린더 돈 일정·챙길 날(`goal-deadline`, `asset-deposit`, `line-*`, `care-gift`). 파일이 없으면 `icon`.

- 2026-11-08: 그림·아이콘 자리는 2D 플랫으로 다시 만들 때까지 빈 자리(회색 판 `hg-artslot`이나 빈 원·빈 칸). 이 문서의 3D·사진·Phosphor 그림 설명은 다시 만들 때의 주제(→ Illustrations ‘나중 과제’).
- `Lead action`(2026-11-08): ‘+ 추가’ 같은 동작 아이콘만 그대로 그림. 종류 아이콘(`icon`, `art3d`)은 빈 원.
- 잠긴 줄(`locked`, 2026-11-09): 고칠 수 없는 줄(각자 모드 파트너 월급 계획 W-01)은 꺾쇠 자리에 Phosphor `lock` 16px(`hg-listrow__lock`, `stone`). 누를 수 없음(div). 왜 잠겼는지는 목록 위 회색 한 줄로 알림(“{파트너}님 월급 계획이에요. 보기만 할 수 있어요”).
