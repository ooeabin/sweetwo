# DateWheel (없앰 2026-11-26)

**2026-11-26 사용자 결정으로 휠 컴포넌트를 모두 없앴다**(`DateWheel`, `DayWheel`, `NumberWheel`, CSS `hg-wheel*`). 시안 `work/w02-design/wheelalt.png`. 대신 한 줄 필드 + 아래 칸 시트: → **PickSheet.md**(일 `DayField`, 연·월 `YearMonthField`, 연도 `YearField`, 시 `HourField`), 날짜 전체는 DateSheet.md.

| 예전 | 지금 |
| --- | --- |
| 연도만 휠(S-11i 출생연도) | `YearField`(연도 칸 시트) |
| 연·월·일 휠(S-11h 결혼한 날·예정일) | `DateField` + 달력 시트 |
| 연·월 휠(W-11d 기한, W-15 기한, S-11c 언제부터, S-11h 예정 연·월, 달력 월 머리 ⌄) | `YearMonthField`·`YearMonthPanel`(연도 ‹ › + 12개월 칸) |
| 일 휠 1~31 + 말일(W-01 나가는 날) | `DayField`(1~31 + 말일 칸 시트). 월급날 일은 2026-11-25부터 `PaydayPicker` |
| 시 휠(S-14a 방해 금지) | `HourField`(0~23 칸 시트) |

예전 규칙(스크롤 스냅, 한 줄 44px 다섯 줄, 가운데 알약 띠, `commitInitial`)은 더 쓰지 않는다. git 기록에서 볼 수 있음.
