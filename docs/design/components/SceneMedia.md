# SceneMedia

장면 영상 칸. 정해진 다섯 화면에서 장면 그림이 한 번 움직이는 짧은 영상을 보여 주고, 못 틀 때는 정지 그림을 보여 줌.

- 소비자가 주는 것: 영상 주소(Motion 묶음), 정지 그림 주소(Illustrations 묶음), 비율(1:1 또는 3:4).
- 구조: `figure.hg-scene` 안에 `<video muted playsinline autoplay poster="정지 그림">`(`loop` 없음, `controls` 없음) + 같은 정지 그림 `<img class="hg-scene__still" alt="">`.
- 비율: 기본 1:1(`hg-scene`), P-01만 3:4(`hg-scene--tall`). 너비는 화면이 정함(최대 320px), 그림은 `object-fit: contain`.
- 바탕: 영상 바탕이 흰색(#ffffff)이라 라이트 모드의 흰 `surface` 위에만 둠. 회색 바탕(`surface-alt`), 틴트 카드, 다크 모드 위에 영상을 올리지 않음. 칸에 테두리, 모서리 둥글림, 그림자 없음(흰 바탕과 붙어 보이게).
- 재생: 화면에 들어올 때 한 번. 끝나면 마지막 장면에서 멈춤(장면마다 정함, README ‘움직이는 그림’ 표). 다시 보려면 화면에 다시 들어와야 함.
- 정지 그림으로 바꾸는 때(`is-still` 또는 자동): 다크 모드(`[data-theme="dark"]`), `prefers-reduced-motion`, 영상을 불러오기 전, 불러오기 실패(`error` 이벤트), 저전력 모드에서 자동 재생이 막힘. 정지 그림은 바탕을 지운 PNG라 어떤 바탕에도 놓임.
- 소리 없음. 영상은 장식이라 `aria-hidden`, 뜻은 화면 제목이 전함. 칸에 글자를 겹치지 않음.
- 파일: 영상은 Motion 묶음 MP4(H.264, 5~6초, 480×480, 3:4는 480×640, 300KB 이하). 정지 그림은 1024px로 만들고 바탕을 지운 512px PNG로 배포.

쓰는 곳: W-04 월말 정리 끝(`scene-pie`), P-11 배우자 합류 완료(`scene-cherries`), P-01 초대받은 사람 첫 화면(`scene-box`, 3:4), H-T1 결혼일 전환 축하(`scene-cake-candle`), A-02 로그인 첫 화면(`scene-tart`). 그 밖의 자리는 정지 그림만.
