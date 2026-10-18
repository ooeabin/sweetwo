# ImageCrop

프로필 사진 올리기와 자르기(S-11e). 사진을 고르거나 끌어 놓고, 정사각 틀 안에서 옮기고 키워 원으로 저장.

- 소비자가 주는 것: 고른 파일(또는 끌어 놓은 파일), 확대 비율, 위치, 오류 종류.
- 올리기 칸(`hg-drop`): 이미지 아이콘 → “사진을 끌어 놓거나 골라 주세요” → 보조 버튼 “사진 고르기” → 도움말 “JPG, PNG, HEIC, 10MB 이하”. 끌어 오는 동안 `is-over`(실선 `ink` 테두리 + `surface-alt`).
- 자르기(`hg-crop`): 정사각 무대(`hg-crop__stage`) 위에 정사각 틀(`hg-crop__frame`, 3등분 선, 바깥은 `scrim`으로 어둡게). 틀은 고정, 사진을 끌어서 옮김. 사진이 틀 밖으로 비지 않게 막음.
- 확대: 아래 줄 `minus` 아이콘 → 슬라이더(Slider의 `hg-slider__track`) → `plus` 아이콘. 1배~3배, 처음은 틀을 꽉 채우는 배율.
- 결과 미리보기(`hg-crop__preview`): Avatar 사진 72px, 32px 원 두 개를 나란히. 저장은 원으로 보이지만 파일은 정사각으로 둠.
- 버튼: 보조 “다시 고르기”, 주 “저장할게요”(오른쪽 끝). 저장하면 Toast “사진을 바꿨어요”.
- 오류는 올리기 칸 아래 도움말 자리(`hg-help is-error`) 1줄, 칸 테두리 `danger`(`is-error`): “10MB 이하 사진만 올릴 수 있어요”, “이 형식은 올릴 수 없어요”. 아이콘을 같이 둠.
- 키보드: 무대에 포커스하면 ←↑→↓로 8px씩 옮김, +와 −로 확대. 무대 `aria-label` “사진 위치, 화살표로 옮겨요”.
- 사진 지우기는 S-11 Menu의 “사진 지우기”, 지우면 이름 첫 글자 Avatar.

쓰는 곳: 설정 S-11 내 정보 → S-11e 사진 바꾸기. 좁은 창은 BottomSheet, 데스크톱은 Modal 안.

- React 래퍼 `ImageCrop`(packages/ui): `src`(object URL), `labels`, `size`(기본 512), `onCancel`, `onSave(jpeg)`. 올리기 칸(`hg-drop`)은 화면(S-11e)이 그림.
