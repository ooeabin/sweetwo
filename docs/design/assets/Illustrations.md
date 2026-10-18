# Illustrations

목표 그림, 빈 상태 그림. 무광 3D 그림(심볼은 평면 파이 차트, 그림체는 그대로), 힉스필드에서 1024px로 만들고 바탕을 지운 512px PNG로 배포. 앱 코드에는 같은 그림을 webp로 줄여 넣음(packages/ui, 150KB 이하). 규칙은 README ‘그림’ 장.

| 파일 | 목표 | 그림 |
| --- | --- | --- |
| goal-01-emergency | 비상금 | 동전이 담긴 유리 저금병(체리색 리본) |
| goal-02-high-interest-loan | 고금리 대출 갚기 | 반으로 자른 카드와 체리색 가위 |
| goal-03-prepay-mortgage | 전세·주택대출 중도상환 | 열쇠(체리색 태그) |
| goal-04-home | 내 집 마련 | 집(체리색 지붕) |
| goal-05-moving | 전세 만기·이사 대비 | 이삿짐 상자 |
| goal-06-furniture | 가전·가구·인테리어 | 소파 |
| goal-07-baby | 출산 준비 | 가슴에 체리 한 알만 있는 흰 아기 우주복 |
| goal-08-education | 아이 교육·양육 | 책가방 |
| goal-09-family-event | 양가 큰 행사 | 빵빠레 |
| goal-10-pet | 반려동물 | 밥그릇과 뼈 모양 과자 |
| goal-11-family-cost | 양가 비용 | 선물 상자 |
| goal-12-travel | 여행 | 여행 가방 |
| goal-13-anniversary | 결혼기념일 | 꽃다발 |
| goal-14-big-purchase | 명품·큰 물건 구입 | 쇼핑백 |
| goal-15-hobby | 취미·자기계발 | 책과 연필 |
| goal-16-car | 자동차 구입·교체 | 자동차 |
| goal-17-car-upkeep | 자동차 유지비 | 짧은 은색 렌치 |
| goal-18-annual-fixed | 연간 고정 지출 | 올해 연도 탁상 달력(해마다 교체) |
| goal-19-retirement | 노후·연금 | 흔들의자 |
| goal-20-invest | 투자 종잣돈 | 새싹 화분 |
| goal-21-wedding | 결혼 비용 | 장식 없는 금반지 두 개 |
| empty-plate | 모든 빈 상태 | 부스러기만 남은 빈 디저트 접시와 포크 |

- 직접 만든 목표: 기본은 회색 기본 그림(`--custom`: `hairline-soft` 회색 바탕 + `stone` 색 `flag-pennant`(깃발) 아이콘). 사용자가 사진을 올리면 그 사진(`--photo`, 꽉 채움). 이 묶음의 그림은 쓰지 않음.
- 쓰는 곳: 목표 카드 `hg-card__art`(56px), 위젯 `hg-wg__art`(40px), 목표 달성 `hg-art`(200px), 빈 상태 `hg-empty__art`(120px). 모두 `object-fit: contain`.
- 다시 그리기, 색 바꾸기, 잘라 쓰기 금지. 새 목표가 생기면 README 부록 프롬프트 틀로 같은 스타일로 만듦.
- 장면 그림(scene 묶음)과 장면 영상은 없앰(2026-10-19). W-04, P-11, P-01, H-T1의 장면 자리는 그림 없이 비워 둠(SceneMedia). A-02 로그인 첫 화면은 그 자리에 영어 워드마크(`Wordmark`)를 넣음.
