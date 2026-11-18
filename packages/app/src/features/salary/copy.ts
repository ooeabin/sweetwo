// 월급 탭 문구(docs/spec/20-salary-plan.md 체크리스트·저금 항목 W-10~W-12, 홈 19-this-month.md H-03). 기획서 “ ” 안 문장 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
import { formatMonthDay, object } from '@sweetwo/core';

export const copy = {
  // W-01 3b 파트너 탭(각자) 공개 단계(20 W-01 고친 점, 08 6장, PR 11)
  partnerSavingOnly: (name: string) => `${name}님은 저축·투자만 보여 주기로 정했어요`,
  partnerDoneOnly: (name: string) => `${name}님은 ‘했어요’만 보여 주기로 정했어요`,
  doneThisMonth: '이번 달 했어요',
  notDoneYet: '아직이에요', // [확인 필요]
  // 상대 ‘했어요만’ 저금 이름 대신(서버 space_goals와 같은 말, 2026-11-13 P1 = A)
  privateSaving: '개인 저축·투자', // [확인 필요]
  // W-01b·W-01c 분담 도우미(20 ‘월급 탭 v2.2’, 06 3-7, 2026-11-13) [확인 필요]
  splitShare: {
    // 첫 단계는 통장 이름을 물음(2026-11-16 문구 리뷰 결정). ‘낼 몫 정하기’는 도우미 전체 이름
    nameQ: '같이 쓰는 통장 이름이 뭐예요?', // [확인 필요]
    nameChips: { living: '생활비 통장', date: '데이트 통장' } as Record<string, string>,
    nameSelf: '직접 쓸게요',
    nameLabel: '통장 이름',
    totalQ: '둘이 한 달에 얼마 넣을까요?',
    mineQ: '내 몫은 한 달에 얼마예요?',
    ruleQ: '어떻게 나눌까요?',
    rules: { half: '반반', income_ratio: '월급 비율', custom: '직접' } as Record<string, string>,
    customQ: '내 몫은 한 달에 얼마예요?',
    result: (me: string, a: string, them: string, b: string, ra: number, rb: number) =>
      `${me} ${a}, ${them} ${b} (${ra} : ${rb})`,
    propose: (name: string) => `${name}님께 알리기`,
    addMine: '내 월급 계획에 넣기',
    proposed: (name: string) => `${name}님께 알렸어요`,
    added: '월급 계획에 넣었어요',
    waiting: (name: string) => `${name}님 답을 기다려요`,
    title: (name: string, account: string) => `${name}님이 ‘${account}’ 나누기를 알렸어요`,
    body: (total: string, me: string, a: string, them: string, b: string) =>
      `한 달 ${total}, ${me} ${a}, ${them} ${b}`,
    ruleLine: {
      half: '반반으로 나눠요',
      income_ratio: (ra: number, rb: number) => `월급 비율로 나눠요 (${ra} : ${rb})`,
      custom: '직접 정한 금액이에요',
    },
    yes: '좋아요',
    no: '지금처럼 할게요',
    accepted: '월급 계획에 같이 쓰는 통장을 넣었어요',
    // [확인 필요] 06 3-7 M9(2026-11-16 5차 검토 B4): ‘좋아요’로 통장 몫만큼 내 생활비·고정지출 줄이 줄었을 때
    acceptedCut: (what: 'living' | 'fixed' | 'both') =>
      `월급 계획에 같이 쓰는 통장을 넣고 그만큼 ${
        what === 'both' ? '생활비와 고정지출을' : what === 'living' ? '생활비를' : '고정지출을'
      } 줄였어요`,
    expired: '답할 수 있는 기간이 지났어요',
    gone: '지금은 답할 게 없어요',
    notConnected: '파트너가 합류하면 알릴 수 있어요',
    ok: '확인',
    next: '다음',
    tooLong: '20자까지 쓸 수 있어요',
    unit: '1만 원 단위로 적어 주세요',
    overTotal: '한 달 금액보다 적게 적어 주세요',
  },
  // W-01 월급 계획
  splitTitle: '월급 계획',
  save: '저장',
  saved: '월급 계획을 바꿨어요',
  undo: '되돌리기',
  splitPending: '연결 해제를 기다리는 동안에는 월급 계획을 고칠 수 없어요',
  // 각자 모드 파트너 것은 보기만(2026-11-09) [확인 필요]
  partnerSplitView: (name: string) => `${name}님 월급 계획이에요. 보기만 할 수 있어요`,
  partnerChecklistView: (name: string) => `${name}님 월급날 확인 목록이에요. 보기만 할 수 있어요`,
  // 파트너 탭(각자)인데 파트너 월급 계획이 없음(2026-11-12 QA 5구간 D3, 0원 영수증 대신 빈 카드) [확인 필요]
  partnerNoPlan: (name: string) => `${name}님은 아직 월급 계획이 없어요`,
  refill: '추천값으로 다시 채우기',
  refillTitle: '추천값으로 다시 채울까요?', // [확인 필요]
  // 2026-11-12 QA 5구간 D1: 직접 추가한 지출은 그대로라 무엇이 바뀌는지 적음 [확인 필요]
  refillBody: '용돈과 기한 있는 저축·투자가 추천값으로 바뀌어요. 이미 적은 지출은 그대로예요', // 2026-11-15 추천 고정지출·생활비 줄 없앰
  refillOk: '다시 채우기', // [확인 필요]
  cancel: '취소',
  // W-01 영수증(2026-11-09) [확인 필요]
  // 2026-11-18 화면 이름 = 서랍 줄 이름(구간 탭 ‘이번 달 / 계획’ 없앰) [확인 필요]
  monthTitle: '이번 달 월급 체크',
  planTitle: '월급 계획 템플릿',
  planLink: '월급 계획 템플릿', // W-02 머리 이동 링크(‘›’는 아이콘)
  monthLinkTo: '이번 달 월급 체크', // W-01 머리 이동 링크(‘›’는 아이콘)
  everyMonth: (day: string) => `매달 ${day}`,
  jointPaydays: (parts: string[]) => parts.join(', '),
  personPayday: (name: string, day: string) => `${name} ${day}`,
  incomeLabel: (amount: string) => `월급 ${amount}, 내 월급 고치기`,
  ratioLabel: (saving: number, spend: number, free: string) =>
    `저축·투자 ${saving}%, 지출 ${spend}%, ${free}`,
  legendSaving: (n: number) => `저축·투자 ${n}%`,
  legendSpend: (n: number) => `지출 ${n}%`,
  legendFree: (n: number) => `아직 안 정한 월급 ${n}%`,
  legendShort: (amount: string) => `아직 안 정한 월급 ${amount}`,
  allocated: '계획한 월급',
  leftoverLabel: '아직 안 정한 월급',
  addSpend: '+ 지출 추가',
  spendChips: [
    { name: '관리비', code: 'maintenance' },
    { name: '통신비', code: 'phone' },
    { name: '보험료', code: 'insurance' },
    { name: '구독료', code: 'subscription' },
    { name: '교통비', code: 'transport' },
    { name: '부모님 용돈', code: 'parents' },
  ] as const,
  spendChipsLabel: '지출 이름',
  allowanceRows: '용돈', // 화면 읽기: W-01 지출 묶음 맨 위 용돈 줄 목록(2026-11-16 R4-3)
  /** W-01 첫 달 묻기(2026-11-16 4차 검토 사용자 결정, 20 W-01 ‘첫 달 묻기’) [모두 확인 필요] */
  firstSpend: {
    title: '매달 나가는 지출이 있어요?',
    chips: [
      { name: '월세', code: 'rent' },
      { name: '관리비', code: 'maintenance' },
      { name: '통신비', code: 'phone' },
      { name: '보험료', code: 'insurance' },
      { name: '대출 상환', code: 'loan' },
      { name: '생활비', code: 'living' },
    ] as const,
    other: '그 밖에',
    done: '다 넣었어요',
    skip: '건너뛸게요',
  },
  addMyShareHint: '내가 내는 몫만 적어요', // [확인 필요] 2026-11-16 r6 ‘매달 나가는 지출’ 금액 시트 아래 회색 한 줄(월세를 둘이 나눠 내면 내 몫)
  sharedAccountChip: '같이 쓰는 통장', // [확인 필요] 2026-11-16 R4-4 ‘+ 지출 추가’ 칩 끝(통장 줄을 숨겼을 때)
  ownName: '직접 입력',
  editPlan: '편집하기',
  share: '공유하기',
  editTitle: '월급 계획 편집',
  editDone: '완료',
  rowLabel: (name: string, amount: string) => `${name} ${amount}`,
  handle: (name: string) => `${name} 끌어서 순서 바꾸기`,
  moveUp: (name: string) => `${name} 위로`,
  moveDown: (name: string) => `${name} 아래로`,
  moved: (name: string, pos: number) => `${name}, ${pos}번째`,
  removeLabel: (name: string) => `${name} 지우기`,
  /** 금액 시트의 줄 지우기 화면 읽기 이름(키패드 ‘한 글자 지우기’와 구분, 2026-11-13 UX B M8) */
  removeLineLabel: (name: string) => `${name} 줄 지우기`,
  locked: '보기만 할 수 있어요',
  lineChanged: (name: string, amount: string) => `${object(name)} ${amount}으로 바꿨어요`,
  lineAdded: (name: string) => `${object(name)} 추가했어요`,
  lineDeleted: (name: string) => `${object(name)} 지웠어요`,
  stopQ: (name: string) => `${object(name)} 그만 모을까요?`,
  orderChanged: '순서를 바꿨어요',
  duplicateName: '이미 있는 이름이에요',
  tooManyLines: '직접 추가한 지출은 10개까지예요',
  imageSaved: '이미지를 저장했어요',
  imageName: (date: string) => `sweetwo-plan-${date}.png`,
  // W-02 이번 달 월급
  cycleTitle: (label: string) => label,
  period: (start: string, end: string) => `${start} ~ ${end}`,
  progress: (total: number, done: number) => `${total}개 중 ${done}개 완료`,
  close: '닫기',
  prevMonth: '지난 달 보기', // [확인 필요]
  nextMonth: '다음 달 보기', // [확인 필요]
  partnerChangedSplit: (name: string) =>
    `${name}님이 월급 계획을 바꿔서 확인 안 한 줄을 다시 계산했어요`, // 2026-11-13 UX B ‘체크’ → ‘확인’
  allDone: '모두 확인했어요',
  savingLine: (goal: string, amount: string) => `${goal}에 ${amount}`,
  spendLine: (name: string, amount: string) => `${name} ${amount}`,
  checkLabel: (name: string) => `${name} 확인`,
  viewLabel: (name: string, state: string) =>
    `${name} ${state === 'checked' ? '확인했어요' : state === 'skipped' ? '건너뜀' : '아직 확인 안 했어요'}`, // [확인 필요] 화면 읽기용(파트너 줄), 2026-11-13 ‘못 함’ → ‘건너뜀’
  // ‘못 함’ 줄 체크 칸 화면 읽기(2026-11-12 D2: 빈 원 + “이번 달은 못 했어요”) [확인 필요]
  skippedLabel: (name: string) => `${name} 건너뜀`, // 2026-11-13 ‘못 함’ → ‘건너뜀’
  otherAmount: '다른 금액으로 했어요', // 2026-11-13 W-02 5번
  // 줄을 누르면 여는 시트(2026-11-03) [확인 필요]
  lineSheet: (name: string, amount: string) => `${name} ${amount}`,
  sent: '계획대로 했어요', // 2026-11-13 W-02 5번(줄 시트 주 버튼)
  // 체크한 사람·때(2026-11-03): 파트너가 체크했으면 이름 칩 + “08.26 체크”, 내가 체크했으면 날짜만
  checkedAt: (date: string) => `${date} 확인`, // [확인 필요] 2026-11-13 UX B ‘체크’ → ‘확인’
  // W-05 ‘이번 달은 못 했어요’ 뒤 Toast(2026-11-03)
  skippedDone: (name: string) => `${name}, 이번 달은 건너뛰었어요`, // [확인 필요] 2026-11-13
  skipped: '이번 달은 건너뛰었어요', // [확인 필요] 2026-11-13 W-02 6번 건너뛴 줄 보조 줄
  skipThis: '이번 달은 건너뛸게요', // [확인 필요] 2026-11-13 W-02 5번 줄 시트
  // W-01 ↔ W-02 잇기(2026-11-09) [확인 필요]
  sentOfPlan: (sent: string, planned: string) => `계획한 ${planned} 중 ${sent} 확인했어요`, // 2026-11-16 문구 리뷰(예전 “확인한 금액 … / …”)
  monthLineToo: '이번 달 아직 확인하지 않은 것도 바꿨어요',
  madeFromPlan: (month: number) => `${month}월 계획대로 월급날 확인 목록을 만들었어요`,
  // 다 끝난 달(2026-11-12 W-02 끝 화면 대신 W-02 막대 아래 한 줄 + Toast, D4: ‘못 함’이 섞이면 ‘마쳤어요’) [확인 필요]
  // 2026-11-13 W-02 7번: “11월 25일 월급, 계획대로 됐어요” / 건너뜀이 섞이면 “…확인을 마쳤어요” [확인 필요]
  monthFinished: (start: string, kind: 'all' | 'mixed') =>
    `${formatMonthDay(start)} 월급, ${kind === 'all' ? '계획대로 됐어요' : '확인을 마쳤어요'}`,
  // 공유 이미지(달 결과, W-01과 같은 canvas) [확인 필요]
  received: (date: string) => `${date} 받음`,
  sentTotal: '확인한 금액',
  skippedShort: '건너뜀',
  monthImageName: (ym: string) => `sweetwo-${ym}.png`,
  // W-02 묶음 ‘모두 계획대로 했어요’(2026-11-09 round 3, 2026-11-16 문구 리뷰에서 ‘모두 보냈어요’를 바꿈)
  groupAllSent: '모두 계획대로 했어요',
  groupAllSentLabel: (group: string) => `${group} 모두 계획대로 했어요`,
  groupSavingDone: (n: number, amount: string) => `저축·투자 ${n}개에 ${amount} 더했어요`,
  groupSpendDone: (n: number) => `지출 ${n}개를 확인했어요`,
  // 토스트는 한 줄(Toast.md): 저금 항목 이름이 길면 8자 + … 로 줄여 금액이 잘리지 않게
  addedToGoal: (goal: string, amount: string) =>
    `${[...goal].length > 8 ? `${[...goal].slice(0, 8).join('')}…` : goal}에 ${amount} 더했어요`,
  checked: '확인했어요', // [확인 필요] 지출 줄 확인 토스트(2026-11-13 UX B)
  alreadyChecked: (who: string) => `${who}님이 먼저 확인했어요`,
  closed: '지난 달 월급날 확인 목록은 고칠 수 없어요', // [확인 필요]
  failed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',
  noChecklist: '월급을 넣으면 월급 계획을 만들어 드려요',
  tellSalary: '월급 알려 주기',
  // W-02a 다른 금액
  howMuch: '얼마를 보냈어요?',
  howMuchFor: (line: string) => `${line}, 이번 달은 얼마였어요?`, // [확인 필요] 2026-11-13 W-02a
  planned: (amount: string) => `계획 ${amount}`, // [확인 필요] 2026-11-09
  lessThanPlan: (amount: string) => `계획보다 ${amount} 적어요`,
  moreThanPlan: (amount: string) => `계획보다 ${amount} 많아요`, // [확인 필요]
  next: '다음',
  ok: '확인',
  // W-05 월급 전 확인
  reviewTitle: (start: string) => `${formatMonthDay(start)} 월급, 확인할 게 남았어요`, // [확인 필요] 2026-11-13 W-05
  reviewNone: '빠진 게 없어요', // [확인 필요]
  // 월급 계획 목록(O-50, W-01 같은 틀), W-02 묶음 이름도 같이 씀
  splitIncome: (amount: string) => `월급 ${amount}`,
  splitIncomeJoint: (amount: string) => `둘이 합친 월급 ${amount}`, // P-06 합쳐서(두 사람 합)
  paydayLast: '말일',
  payday: (d: number) => `${d}일`,
  savingGroup: '저축·투자',
  spendGroup: '지출',
  lineNames: { fixed: '고정지출', living: '생활비', allowance: '용돈' },
  fixedSub: '월세·관리비·보험·통신·대출 상환처럼 매달 정해진 지출',
  livingSub: '식비·장보기처럼 그때그때 쓰는 지출', // [확인 필요]
  /**
   * 기한까지 월 필요액(06 5-3). now = 지금 매달 넣는 금액(다르면 덧붙임). 2026-11-16 4차 검토 R4-2: “매달 24만 원이 필요해요”가
   * 내가 정한 30만 원과 달라 틀린 줄 알았음 → 기한 기준임을 말하고 지금 금액을 나란히 [확인 필요]
   */
  needPerMonth: (amount: string, now?: string) =>
    `기한까지 매달 ${amount}이면 돼요${now && now !== amount ? `. 지금은 ${now}씩 모아요` : ''}`,
  // 월 필요액 > 매달 금액(2026-11-09, W-10 3번, W-11d 보조) [확인 필요]
  lateBy: (n: number) => `지금대로면 기한보다 ${n}개월 늦어요`,
  changeMonthly: '매달 금액 바꾸기', // [확인 필요]
  setMonthly: '매달 모을 금액 정하기', // [확인 필요] 2026-11-16 r6 W-10 매달 0원이면 안내 줄 → W-01 금액 시트
  changeDeadline: '기한 바꾸기', // [확인 필요]
  addLine: '+ 줄 추가',
  addLineTitle: '줄 추가',
  newLineName: '줄 이름', // [확인 필요]
  newLinePlaceholder: '예: 부모님 용돈',
  removeLine: '줄 지우기', // [확인 필요]
  lineAmount: (name: string) => `${name} 금액`,
  tenThousandUnit: '1만 원 단위로 넣어 주세요', // [확인 필요]
  leftover: (amount: string) => `아직 안 정한 월급 ${amount}`,
  short: (amount: string) => `${amount}이 모자라요`,
  shortHelp: '지출이나 저축·투자를 줄여 주세요',
  // 월급 탭(2026-11-08 ADR 0007)
  tabTitle: '월급',
  addItem: '+ 저축·투자 추가', // [확인 필요] 묶음 밖(W-02 월급 탭 머리 오른쪽 버튼). 2026-11-17 ‘저금’ → ‘저축·투자’
  monthlyShort: (amount: string) => `매달 ${amount}`, // [확인 필요] 2026-11-18 W-01 저축·투자 줄 큰 금액
  targetPct: (pct: number) => `목표 금액의 ${pct}%`, // [확인 필요] 2026-11-18 W-01 저축·투자 줄 진행 글자
  savingRowLabel: (name: string, monthly: string, saved: string, pct: number | null) =>
    `${name} 매달 ${monthly}, 모은 금액 ${saved}${pct === null ? '' : `, 목표 금액의 ${pct}%`}`, // 화면 읽기 이름
  addItemInReceipt: '+ 저축·투자 추가', // [확인 필요] 2026-11-18 W-01 영수증 구획 끝(묶음이 여럿이라 무엇을 더하는지 보이게, ‘+ 지출 추가’와 같은 꼴)
  addItemIn: '+ 추가', // [확인 필요] 2026-11-17 ‘저축·투자’ 구획·묶음 안(분할 편집기)
  // 첫 저금 빈 줄(2026-11-09, 내 저금이 없을 때) [확인 필요]. ListRow + 아이콘이 글자 앞 ‘+’를 대신
  firstSaving: (left: string) => `저축·투자 추가 (아직 안 정한 월급 ${left})`, // 묶음 밖(홈 H-01)
  firstSavingIn: (left: string) => `추가 (아직 안 정한 월급 ${left})`, // [확인 필요] 2026-11-17 묶음 안(W-02)
  // 20 ‘첫 저금’ 3번(2026-11-13): 예전 비교 문구 “…님처럼 나도 모을 곳을…”은 없앰 [확인 필요]
  firstSavingTogether: (partner: string, goal: string) =>
    `${partner ? `${partner}님` : '파트너'} ‘${goal}’에 같이 모을까요?`,
  firstSavingLeft: (left: string) => `아직 안 정한 월급 ${left}`,
  // 2026-11-16 r6: 용돈이 이미 빠진 돈이라는 걸 보임 [확인 필요]
  firstSavingExcl: (allowance: string) => `용돈 ${allowance} 빼고`,
  seeItem: '저축·투자 보기', // [확인 필요] 저금 줄 시트·금액 입력 아래(2026-11-09 ‘저금 항목’ 대신)
  itemProgress: (saved: string, target: string) => `${saved} / ${target}`,
  closedFold: (n: number) => `그만 모은 것 ${n}개`, // [확인 필요]
  // W-10 저금 카드 접기 줄(2026-11-15 3차 검토) [확인 필요]
  foldOpen: '자세히 보기',
  foldClose: '접기',
  // W-13 저금 목록(2026-11-09 round 3) [확인 필요]
  listTitle: '저축·투자',
  listOpen: '저축·투자 목록 보기', // 저금 묶음 머리(누르는 제목) 화면 읽기 이름
  listSaved: (amount: string) => `모은 금액 ${amount}`,
  /** 같이 모으기에 든 저금 줄 보조 줄(W-02, 묶음 합계 ‘둘이 모은 금액’과 나눔, 2026-11-14 R4) */
  myShare: (amount: string) => `내 몫 ${amount}`, // [확인 필요]
  listEmpty: '아직 저축·투자가 없어요',
  listAdd: '추가', // [확인 필요] 2026-11-17 묶음·목록 안 끝 줄(+ 아이콘이 ‘+’)
  listAddOut: '저축·투자 추가', // [확인 필요] 2026-11-17 묶음 밖(W-10c 맞출 게 없을 때 버튼)
  // W-10 저금 항목 상세
  back: '뒤로',
  thisMonth: '이번 달', // [확인 필요] 매달 카드의 이번 달 줄
  savedLabel: '모은 금액',
  targetOf: (target: string, pct: number) => `목표 금액 ${target}의 ${pct}%`, // [확인 필요]
  edit: '고치기',
  until: (ym: string) => `${ym}까지`,
  setDeadline: '기한 정하기', // [확인 필요]
  noTarget: '목표 금액을 정하면 얼마나 모았는지 보여 드려요', // [확인 필요]
  setTarget: '금액 정하기', // [확인 필요]
  reachedAll: (target: string) => `${target}을 다 모았어요`, // [확인 필요]
  achieved: '달성',
  monthlyOf: (amount: string) => `매달 ${amount}씩`,
  change: '바꾸기',
  history: '모은 내역', // [확인 필요]
  historyChecked: (label: string, amount: string) => `${label} ${amount}`,
  historyOther: (label: string, amount: string) => `${label} 다른 금액 ${amount}`,
  historySkipped: (label: string) => `${label} 건너뜀`,
  historyStart: (amount: string) => `이미 모은 금액 ${amount}`, // 2026-11-09(2026-11-16 ‘시작할 때 모은 금액’에서)
  noHistory: '아직 기록이 없어요', // [확인 필요]
  more: '더보기',
  info: '정보',
  createdOn: (date: string) => `${date}에 만들었어요`, // [확인 필요]
  createdBy: (name: string) => `만든 사람 ${name}`, // [확인 필요]
  closedNote: '그만 모으기로 했어요', // [확인 필요]
  partnerItem: (name: string) => `${name}님이 모으고 있어요. 보기만 할 수 있어요`, // [확인 필요] 2026-11-09
  itemPending: '연결 해제를 기다리는 동안에는 저축·투자를 고칠 수 없어요', // 2026-11-12 S7-09 W-10 맨 위 회색 한 줄
  menu: '더보기',
  rename: '이름 바꾸기',
  remove: '지우기',
  removed: '휴지통으로 옮겼어요',
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  // W-10a 고치기
  saveEdit: '저장',
  amountChanged: '목표 금액을 바꿨어요', // [확인 필요]
  deadlineChanged: '기한을 바꿨어요',
  nameChanged: '이름을 바꿨어요', // [확인 필요]
  targetCleared: '목표 금액을 지웠어요', // [확인 필요]
  deadlineCleared: '기한을 지웠어요', // [확인 필요]
  clearTarget: '목표 금액 지우기', // [확인 필요]
  clearDeadline: '기한 지우기', // [확인 필요]
  // W-10a 매달 금액·새 목표 금액(2026-11-09 round 3) [확인 필요]
  monthlyChanged: '매달 금액을 바꿨어요',
  retargetQ: '새 목표 금액은 얼마예요?',
  retargetHelp: (saved: string) => `지금 모은 금액 ${saved}`,
  retargetLow: '지금 모은 금액보다 크게 넣어 주세요',
  notBeforeThisMonth: '이번 달부터 고를 수 있어요', // [확인 필요]
  nameRequired: '이름을 넣어 주세요',
  saveFailed: '저장하지 못했어요',
  conflictQ: '어느 쪽으로 할까요?',
  conflictBody: (partner: string) => `${partner}님이 방금 이 값을 바꿨어요`,
  conflictMine: '내 값',
  conflictTheirs: (partner: string) => `${partner}님 값`,
  // W-11 저금 항목 추가
  addNameQ: '무엇을 위해 모을까요?', // [확인 필요]
  addNameHelp: '매달 월급에서 이만큼 떼어 둬요. 월급 계획 템플릿에 들어가요', // [확인 필요] 2026-11-18 첫 질문 회색 한 줄
  addNamePlaceholder: '예: 여행, 적금', // [확인 필요]
  addMonthlyQ: '매달 얼마씩 모을까요?', // [확인 필요]
  addMonthlyHelp: (left: string, allowance?: string) =>
    `아직 안 정한 월급 ${left}${allowance ? `, 용돈 ${allowance} 빼고` : ''}`, // 2026-11-16 r6 용돈 빼고
  addTargetQ: '모으고 싶은 목표 금액이 있나요?', // [확인 필요]
  addTargetHelp: '정하면 얼마나 모았는지 보여 드려요', // [확인 필요]
  addNoTarget: '목표 금액 없이 모을게요', // [확인 필요]
  // W-11c 선택 칸(2026-11-09, 만들 때만) [확인 필요]
  addHasStart: '이미 모은 금액이 있어요',
  addStart: '이미 모은 금액',
  addStartOver: '목표 금액보다 적게 넣어 주세요',
  addDeadlineQ: '언제까지 모을까요?',
  addNoDeadline: '기한 없이 모을게요', // [확인 필요]
  addDone: '추가하기', // [확인 필요]
  added: '월급 계획 템플릿에 넣었어요', // [확인 필요] 2026-11-18 W-11 끝 W-01로(예전 ‘저축·투자를 추가했어요’)
  addShort: '아직 안 정한 월급이 모자라요. 지출이나 저축·투자를 줄여 주세요',
  addBlocked: '연결 해제를 기다리는 동안에는 저축·투자를 추가할 수 없어요',
  addNoSplit: '월급이 생기면 저축·투자를 추가할 수 있어요', // [확인 필요]
  // W-12 달성 축하, W-12a
  achievedEyebrow: '다 모았어요', // [확인 필요] 2026-11-09 ‘목표 달성’ 대신
  storyAll: (n: number) => `${n}개월 동안 매달 둘이 같이 모았어요`,
  storySome: (n: number, m: number) => `${n}개월 중 ${m}번은 둘이 같이 모았어요`,
  storySolo: (n: number) => `${n}개월 만에 모았어요`,
  afterQ: (name: string) => `${object(name)} 어떻게 할까요?`, // [확인 필요] 2026-11-17 이름을 넣음(J-6)
  afterQLoading: '어떻게 할까요?', // [확인 필요] 이름을 읽기 전 뼈대
  afterKeep: '계속 모을게요', // [확인 필요]
  afterStop: '그만할게요', // [확인 필요]
  // W-12a 선택지 보조 한 줄, 셋째 선택지(2026-11-09 round 3) [확인 필요]
  afterKeepSub: '목표 금액만 지우고 지금처럼 모아요',
  afterStopSub: '월급 계획에서는 빠지지만 모은 내역은 남아요',
  afterRetarget: '목표 금액을 새로 정할게요',
  afterRetargetSub: '모은 금액은 그대로 두고 더 큰 금액으로 이어서 모아요',
  keptToast: '목표 금액을 지우고 계속 모을게요',
  stoppedToast: '그만 모으기로 했어요', // [확인 필요]

  // ── v2.2 확인 루프(20 ‘월급 탭 v2.2’, 2026-11-13) [모두 확인 필요] ──
  cycleOf: (start: string) => `${formatMonthDay(start)} 월급`, // 07 1장 확인 목록 이름
  autoPayday: '월급날',
  autoPill: (day: string) => `자동 ${day}`, // W-01 5c “자동 26일”, “자동 월급날”
  autoWait: (day: string) => `자동 ${day}`, // W-02 2번 “자동 26일”(W-01과 같은 순서, 2026-11-16)
  autoDone: '자동 확인',
  autoLabel: (name: string, day: string) => `${name}, 자동, ${day}에 나가요`, // 화면 읽기
  autoDoneLabel: (name: string) => `${name}, 자동으로 확인했어요`,
  autoGroup: (n: number) => `자동으로 나가는 것 ${n}개`,
  autoGroupHelp: '안 나간 게 있으면 눌러서 바꿔 주세요',
  manualGroup: (n: number) => `확인할 것 ${n}개`,
  confirmAll: '모두 계획대로 됐어요', // W-02 4번(버튼 말투 예외 Q2)
  lateHelp: '다음 월급날 전까지 언제든 확인할 수 있어요', // W-02 8번
  lateTitle: (start: string) => `${formatMonthDay(start)} 월급`,
  firstWait: (start: string) => `${formatMonthDay(start)} 첫 월급날에 확인해요`, // W-02 첫 확인 목록 전
  firstWaitNoDate: '첫 월급날에 확인해요',
  // W-02 0a 첫 월급날 전 미리 보기(2026-11-15 3차 검토) [확인 필요]
  previewTitle: '월급날에 확인할 것',
  previewAuto: '자동으로 나가요',
  moneyInGo: '수입 적기',
  // W-01 줄 설정(7a), 보내기(5e), 관리하는 사람의 상대 용돈(5f), 같이 쓰는 통장(5d)
  inChecklist: '월급날 확인 목록에 넣기',
  autoPay: '은행에서 자동으로 보내요',
  autoDay: '나가는 날',
  chipPayday: '월급날',
  chipNextDay: '다음 날',
  autoDayChips: '나가는 날 고르기',
  lineSettingChanged: (name: string) => `${name} 설정을 바꿨어요`,
  sendName: '보내기',
  sendNote: '월급 − 용돈',
  // 애칭이 없을 때 상대 이름(CLAUDE.md 문구 ‘없으면 파트너’)
  partnerFallback: '파트너',
  sharedAccountName: '같이 쓰는 통장',
  /** W-02 한 사람 관리형 관리하지 않는 쪽: 관리하는 사람이 확인하는 손 줄 묶음 머리(보기만) [확인 필요] 2026-11-13 UX B H2 */
  managerChecks: (name: string) => (name ? `${name}님이 확인해요` : '파트너가 확인해요'),
  addSharedAccount: '+ 같이 쓰는 통장 추가',
  allowanceNotify: (name: string) => (name ? `${name}님께 알려 드려요` : '파트너에게 알려 드려요'),
  noPaydayHead: '수입이 들어올 때', // W-01 머리 ‘매달 25일’ 자리(날짜 없음)
  // W-01d 자동으로 나가는 것 고르기
  autoPickTitle: '자동으로 나가는 걸 골라 주세요',
  autoPickSave: '저장하기',
  autoPickNone: '자동으로 나가는 게 없어요',
  autoPickSaved: '자동으로 나가는 걸 정했어요',
  autoPickEmpty: '고를 지출이나 저축·투자가 없어요',
  autoPickLine: (name: string) => `${name} 자동으로 나가요`,
  // H-13 기간 한 줄(07 6장, 홈 H-11 자리와 월급 탭 ‘이번 달’ 자리가 같이 씀) [모두 확인 필요]
  periodNone: '수입이 들어오면 ‘수입 적기’로 알려 주세요',
  periodEarly: (amount: string) => `이번 기간 수입 ${amount}`,
  periodIn: (amount: string) => `수입 ${amount}`,
  periodNeed: (amount: string) => `월급 계획 ${amount}`,
  periodSince: (date: string) => `${formatMonthDay(date)}부터`,
  periodFull: '더 들어온 수입은 저축·투자에 넣을 수 있어요',
  periodGap: (n: number) => `마지막으로 수입이 들어온 지 ${n}일 됐어요`,
  periodBarLabel: (inn: string, need: string, since: string) =>
    `이번 기간 수입 ${inn}, 월급 계획 ${need}, ${since}`,
  // ───────── v2.2 같이 모으기와 수입 기록(20 ‘월급 탭 v2.2’, ADR 0009, PR 10) ─────────
  // W-10 고친 점
  etaAt: (ym: string) => `지금 속도면 ${ym}에 다 모아요`, // [확인 필요] 3a(‘기한보다 n개월 늦어요’ 대신)
  remainUntil: (ym: string, amount: string) => `${ym}까지 ${amount} 더 필요해요`, // [확인 필요] 3b G5
  remainUntilPct: (ym: string) => `${ym}까지`, // [확인 필요] 퍼센트만(SaveTogether.md)
  historyStartV22: (amount: string) => `이미 모은 금액 ${amount}`, // [확인 필요] 6a
  historyMoneyIn: (amount: string) => `수입에서 넣었어요 ${amount}`,
  historyAuto: (amount: string) => `자동으로 넣었어요 ${amount}`, // [확인 필요] 날짜 없는 사람 자동 넣기
  historyAdjust: (sign: '+' | '−', amount: string) => `바로잡기 ${sign}${amount}`, // [확인 필요]
  historyReconcile: (sign: '+' | '−', amount: string) => `잔액 맞추기 ${sign}${amount}`, // [확인 필요]
  historyNotePaid: (amount: string) => `쓸 곳 메모 −${amount}`, // [확인 필요]
  moneyIn: '수입 적기', // AddRow 글자(+ 아이콘이 ‘+’를 대신)
  menuAdjust: '모은 금액 바로잡기', // [확인 필요]
  menuNotes: '쓸 곳 메모', // [확인 필요]
  menuBundle: '같이 모으기 시작하기',
  menuReconcile: '통장 잔액과 맞추기', // W-13 ⋯
  // 묶음 카드(W-10 0번, W-13 묶음 줄, SaveTogether.md)
  together: '같이 모으기',
  bundleTotalOf: (target: string, pct: number) => `목표 금액 ${target}의 ${pct}%`, // [확인 필요]
  bundleEach: (a: string, av: string, b: string, bv: string) => `${a} ${av}, ${b} ${bv}`, // [확인 필요]
  bundlePaused: '같이 모으기를 잠시 멈췄어요', // [확인 필요]
  bundleDone: '다 모았어요',
  bundleEdit: '같이 모으기 고치기', // [확인 필요] 묶음 카드 ⋯ 화면 읽기
  bundleMine: (name: string) => `내 ${name}`, // [확인 필요] W-13 펼친 줄
  // 상대가 ‘했어요만’이면 서버가 이름을 주지 않음 → “{이름}님 저금”(2026-11-13 P1 = A)
  bundlePartnerRow: (who: string, name: string | null) => `${who}님 ${name ?? '저축·투자'}`, // [확인 필요]
  bundleOpen: (name: string) => `${name} 펼치기`, // [확인 필요] 화면 읽기
  bundleLabel: (name: string, amount: string, rest: string) =>
    [`같이 모으기`, name, amount, rest].filter(Boolean).join(', '), // 화면 읽기 한 문장
  partnerBundleItem: (name: string) => `${name}님이 모으고 있어요. 같이 모으기 합계만 보여요`, // [확인 필요] 각자 금액을 안 켰을 때
  // W-10b 모은 금액 바로잡기
  adjustQ: '모은 금액 바로잡기', // [확인 필요]
  adjustAdd: '더할게요', // [확인 필요]
  adjustSub: '뺄게요', // [확인 필요]
  adjustAmountQ: (sign: 'add' | 'sub') => (sign === 'add' ? '얼마를 더할까요?' : '얼마를 뺄까요?'), // [확인 필요]
  adjustNow: (amount: string) => `지금 모은 금액 ${amount}`, // [확인 필요]
  adjustOver: '모은 금액보다 많이 뺄 수 없어요', // [확인 필요]
  adjustReasonQ: '왜 바꾸나요?', // [확인 필요]
  adjustReasonHelp: '이 내용은 나만 봐요', // [확인 필요]
  adjustReasons: {
    used: '꺼내 썼어요',
    interest: '이자가 붙었어요',
    fix: '숫자를 맞춰요',
    custom: '직접 쓰기',
  }, // [확인 필요]
  adjustReasonLabel: '바꾸는 까닭', // 화면 읽기
  adjustCustomPlaceholder: '예: 여행 경비', // [확인 필요]
  adjustHide: '주간 요약에 넣지 않기', // [확인 필요] G11
  adjustSave: '바로잡기', // [확인 필요] 주 버튼
  adjusted: '모은 금액을 바로잡았어요', // [확인 필요]
  // W-10c 실제 잔액 맞추기
  reconcileQ: '통장 잔액과 모은 금액을 맞춰 볼까요?',
  reconcileHelp: '통장에 실제로 모인 금액을 적어 주세요', // [확인 필요] 2026-11-16 “비우면 그대로 둬요” 뺌
  reconcileNow: (amount: string) => `지금 모은 금액 ${amount}`, // [확인 필요]
  reconcileActual: '실제로 모인 금액', // [확인 필요]
  reconcileSave: '맞추기', // [확인 필요]
  reconciled: (n: number) => (n ? `저축·투자 ${n}개를 실제 잔액과 맞췄어요` : '실제 잔액과 같아요'), // [확인 필요]
  reconcileEmpty: '맞출 저축·투자가 없어요', // [확인 필요]
  // W-11e 은행에서 자동으로 나가요?
  autoQ: '은행에서 자동으로 보내요?', // [확인 필요]
  autoYes: '네, 자동이에요', // [확인 필요]
  autoNo: '아니요, 직접 보내요', // [확인 필요]
  autoDayQ: '언제 나가요?', // [확인 필요]
  autoDayPayday: '월급날', // [확인 필요] 칩
  autoDayNext: '다음 날', // [확인 필요] 칩
  autoDayLabel: '나가는 날', // [확인 필요]
  autoDayOf: (d: number) => (d === 31 ? '말일' : `${d}일`),
  // W-11 끝
  bundleAskQ: (name: string) => `${name}님과 같이 모을까요?`, // [확인 필요]
  bundleAskYes: '같이 모을게요', // [확인 필요]
  inviteAskQ: '같이 모을 사람을 초대할까요?', // [확인 필요]
  inviteAskYes: '초대할게요', // [확인 필요]
  laterAnswer: '나중에 할게요',
  // W-12b 다음엔 뭘 같이 모을까요
  nextQ: '다음엔 뭘 같이 모을까요?', // [확인 필요]
  nextRedeadline: (name: string) => `‘${name}’ 기한을 새로 정할게요`, // [확인 필요]
  nextCustom: '직접 정할게요', // [확인 필요]
  addNameChips: '이름 고르기', // [확인 필요] W-11a 칩 묶음 화면 읽기 이름
  chipNames: {
    wedding: '결혼 비용',
    honeymoon: '신혼여행',
    emergency: '비상금',
    jeonse_loan: '전세 대출 갚기',
    travel: '여행',
    moving: '이사',
    gift: '선물',
  }, // 19 ‘이름 칩 표’ [확인 필요]
  // W-14 쓸 곳 메모, W-14a
  notesTitle: (name: string) => `쓸 곳 메모 ${name}`, // [확인 필요] 제목 “쓸 곳 메모” + 저금 이름
  notesHelp: '모은 금액을 어디에 쓸지 적어 두면 캘린더에도 보여요', // [확인 필요]
  notesEmpty: '아직 메모가 없어요', // [확인 필요]
  noteAdd: '메모 추가', // [확인 필요] AddRow(+ 아이콘)
  notePaid: '냈어요', // [확인 필요]
  notePaidDone: '냈어요', // 줄 표시 [확인 필요]
  notePaidLabel: (name: string) => `${name} 냈어요`, // 화면 읽기
  notePayQ: (amount: string) => `모은 금액에서 ${amount} 뺄까요?`, // [확인 필요] F3
  notePayAmountQ: '얼마를 냈어요?', // [확인 필요] 금액이 없는 메모
  notePaySub: '뺄게요', // [확인 필요]
  notePayKeep: '그대로 둘게요', // [확인 필요]
  notePaidToast: (name: string) => `${name}, 냈어요`, // [확인 필요]
  notePaidSubToast: (amount: string) => `모은 금액에서 ${amount} 뺐어요`, // [확인 필요]
  noteNameQ: '모은 금액을 어디에 쓸 거예요?', // W-14a 이름
  noteNamePlaceholder: '예: 예식장 잔금', // [확인 필요]
  noteAmountQ: '얼마쯤 들어요?', // [확인 필요] 예상 금액(선택)
  noteNoAmount: '금액 없이 적을게요', // [확인 필요]
  noteDateQ: '언제 내요?', // [확인 필요]
  noteNoDate: '날짜 없이 적을게요', // [확인 필요]
  noteSave: '저장',
  noteSaved: '메모를 저장했어요', // [확인 필요]
  noteDeleted: '메모를 지웠어요', // [확인 필요]
  noteDelete: '메모 지우기', // [확인 필요]
  noteDue: (date: string) => date,
  notBeforeToday: '오늘부터 고를 수 있어요', // [확인 필요]
  // W-15 같이 모으기로 묶기
  bundlePartnerQ: (name: string) => `${name}님 저축·투자 중 같이 모을 걸 골라 주세요`, // [확인 필요]
  bundleFromMine: '내 저축·투자에서 시작할게요', // [확인 필요]
  bundleMineQ: '어떤 저축·투자로 같이 모을까요?', // [확인 필요]
  bundleNewSaving: '새 저축·투자 만들기', // [확인 필요]
  bundleTargetQ: '같이 모을 목표 금액이 있나요?', // [확인 필요]
  bundleTargetHelp: '두 저축·투자 목표 금액을 더한 금액이에요', // [확인 필요] Q11 처음 값이 있을 때
  bundleNoTarget: '목표 금액 없이 모을게요', // [확인 필요]
  bundleDeadlineQ: '언제까지 모을까요?',
  bundleNoDeadline: '기한 없이 모을게요', // [확인 필요]
  bundleNoticeQ: '같이 모으기 전에 알려 드려요', // [확인 필요] 고지 화면 제목
  bundleNotice:
    '합계는 둘 다 봐요. 그래서 서로 얼마 넣었는지 짐작할 수 있어요. 각자 금액은 둘 다 켜야 보여요', // G1
  percentOnly: '퍼센트만 보여 주기', // [확인 필요]
  percentOnlyHelp: '둘 다 금액 대신 %로 봐요', // [확인 필요]
  percentOnlyNoTarget: '목표 금액이 있어야 고를 수 있어요', // [확인 필요]
  bundleStart: '같이 모으기 시작하기', // [확인 필요]
  bundleJoin: '같이 모으기 시작하기', // [확인 필요] 들어가기(2~4단계)
  bundleStarted: '같이 모으기를 시작했어요', // [확인 필요]
  bundleJoinQ: (who: string, name: string) => `${who}님 ‘${name}’에 같이 모을까요?`, // [확인 필요] 띠 13번과 같은 말
  bundleNoMine: '같이 모을 내 저축·투자가 없어요', // [확인 필요]
  bundleBlocked: '지금은 같이 모으기를 만들 수 없어요', // [확인 필요] 합쳐서·연결 전 등
  // W-15a 묶음 고치기
  bundleEditTitle: '같이 모으기', // [확인 필요]
  bundleName: '이름',
  bundleTarget: '목표 금액',
  bundleDeadline: '기한',
  bundleNone: '없음', // [확인 필요]
  showEach: '각자 모은 금액 보여 주기', // [확인 필요]
  showEachHelp: (name: string) => `${name}님도 켜야 보여요`, // [확인 필요]
  bundleLeave: '같이 모으기 풀기', // [확인 필요]
  bundleLeaveQ: '같이 모으기를 풀까요?', // [확인 필요]
  bundleLeaveBody: '각자 저축·투자는 그대로 남아요', // [확인 필요]
  bundleLeaveOk: '풀게요', // [확인 필요]
  bundleLeft: '같이 모으기를 풀었어요', // [확인 필요]
  bundleChanged: (field: 'name' | 'target' | 'deadline') =>
    field === 'name'
      ? '이름을 바꿨어요'
      : field === 'target'
        ? '목표 금액을 바꿨어요'
        : '기한을 바꿨어요', // [확인 필요]
  bundleNameQ: '이름을 뭐라고 할까요?', // [확인 필요]
  // W-20 수입 적기, W-20a
  moneyInQ: '얼마를 받았어요?',
  moneyInDate: '받은 날', // [확인 필요]
  moneyInDateToday: '받은 날 오늘', // [확인 필요]
  moneyInFuture: '오늘이나 지난 날만 고를 수 있어요',
  moneyInKinds: {
    salary: '월급',
    bonus: '상여',
    family: '가족이 보태 줬어요',
    work: '프리랜스·부업',
    refund: '환급',
    etc: '그 밖',
  }, // [확인 필요]
  moneyInKindLabel: '어떤 수입이에요?', // 칩 묶음 이름
  moneyInDistributeQ: '저축·투자에 얼마씩 넣을까요?', // [확인 필요]
  moneyInLeft: (total: string, left: string) => `수입 ${total} 중 아직 안 넣은 ${left}`, // 2026-11-16 r6 (예전 “…중 남은 …”)
  moneyInOver: '수입보다 많이 넣을 수 없어요',
  moneyInPut: '넣기', // [확인 필요]
  /** W-20a 적기만(2026-11-16 R4-7: 수입 적기가 저금 나누기로만 끝났음) [확인 필요] */
  moneyInSkip: '저축·투자에 안 넣을게요',
  /** W-02 ‘수입’ 묶음(이번 달에 적은 기록, 2026-11-16 R4-7) */
  moneyInGroup: '수입',
  moneyInRow: (date: string, kind: string) => `${date}, ${kind}`,
  moneyInNoSaving: '넣을 저축·투자가 없어요. 수입만 적어 둘게요',
  moneyInLogged: '수입을 적었어요',
  moneyInPutDone: (n: number, amount: string) => `저축·투자 ${n}개에 ${amount} 넣었어요`, // [확인 필요]
  amountOf: (name: string) => `${name} 금액`, // 화면 읽기
  wonUnit: '원',
  // 2026-11-14 실구동 고침 A(20 v2.2 ‘고침 A’)
  bundleJoinHelp: '같이 모으면 둘이 모은 합계를 하나로 봐요', // H1 들어갈 묶음이 있을 때
  bundleSeparate: '따로 새로 모을게요', // [확인 필요]
  bundleWaitingQ: (who: string, name: string) => `${who}님이 아직 ‘${name}’에 들어오지 않았어요`, // [확인 필요]
  bundleWaitingHelp: '다른 저축·투자로 하나 더 같이 모을 수도 있어요',
  bundleOpenBlocked: '들어오길 기다리는 같이 모으기가 있어요', // [확인 필요] 서버 bundle_open
  bundleJoinCta: '같이 모으기에 들어가기', // [확인 필요] W-10 0c, W-20a
  moneyInNoSavingJoin: (name: string) =>
    `넣을 저축·투자가 없어요. ‘${name}’에 같이 모으면 넣을 수 있어요`, // [확인 필요]
  moneyInAll: '나머지 모두 넣기', // W-20a
  moneyInAllLabel: (name: string) => `${name}에 나머지 모두 넣기`, // 화면 읽기
  moneyInList: '수입 기록', // W-20b
  moneyInListEmpty: '아직 적은 수입이 없어요',
  moneyInPutOf: (amount: string) => `저축·투자에 ${amount} 넣었어요`, // [확인 필요] W-20b 줄 보조
  moneyInRowMenu: (amount: string) => `${amount} 기록 메뉴`, // 화면 읽기
  moneyInEdit: '고치기',
  moneyInDelete: '지우기',
  moneyInDeleted: '수입 기록을 지웠어요',
  moneyInDeletedPut: '수입 기록과 저축·투자에 넣은 금액을 지웠어요', // 나눠 넣은 게 있을 때
  moneyInEdited: '수입 기록을 고쳤어요',
  moneyInEditBelow: '저축·투자에 넣은 금액보다 적게 고칠 수 없어요', // [확인 필요]
  moneyInEditSave: '저장',
  noteOverdue: (date: string) => `${date}이 지났어요`, // W-14 안 낸 메모(날짜는 ‘…일’로 끝남)
  monthlyOverLeft: (left: string) => `아직 안 정한 월급 ${left}보다 적게 넣어 주세요`, // W-11b(막지 않음)
  needPerMonthTogether: (amount: string, now?: string) =>
    `기한까지 둘이 매달 ${amount}이면 돼요${now && now !== amount ? `. 지금은 ${now}씩 모아요` : ''}`, // [확인 필요] 같이 계열 W-11d·W-10, 2026-11-16 R4-2
  // ── W-21 지난 달 모아보기(20 W-21, 2026-11-17) [모두 확인 필요] ──
  archiveTitle: '지난 달 모아보기',
  archiveLink: '지난 달 모아보기', // W-02 머리 링크(‘›’는 아이콘)
  archiveResult: {
    all: '계획대로 됐어요',
    mixed: '확인을 마쳤어요',
    late: (n: number) => `확인할 것 ${n}개`,
  },
  archivePlanned: (amount: string) => `계획한 월급 ${amount}`, // 오른쪽 큰 숫자가 모은 금액이라 보조 줄에 계획 합
  archiveEmpty: '아직 지난 달 기록이 없어요',
  /** 날짜 없는 사람: 줄 이름 “10월 3일 ~ 11월 1일”, 보조 “수입 2번” */
  archivePeriod: (start: string, end: string) => `${start} ~ ${end}`,
  archivePeriodCount: (n: number) => `수입 ${n}번`,
};
