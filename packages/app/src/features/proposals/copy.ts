// 제안 문구(docs/spec/22-goals.md G-08, 08 6장, 14 알림, 18 P-07·P-08·P-11). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  retry: '다시 시도',
  saveFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  notFound: '제안을 찾을 수 없어요', // [확인 필요]

  // G-08
  from: (name: string) => `${name}님 제안`,
  arrived: (name: string, item: string) => `${name}님이 ${item} 바꾸자고 제안했어요`,
  applyNote: (date: string) => `좋아요면 바로, 반대 없으면 ${date}부터 적용돼요`,
  like: '좋아요',
  differently: '다르게 해볼래요',
  oppose: '반대',
  together: '함께 정하기',
  togetherNote: '다음 월말 정리에서 함께 정해요',
  cancelSend: '보내기 취소',
  withdraw: '철회',
  proposeTo: (name: string) => `${name}님께 제안하기`,
  proposed: (name: string) => `${name}님에게 제안했어요`,
  withdrawnBy: (name: string) => `${name}님이 이 제안을 거둬들였어요`,
  answeredBy: (name: string) => `이미 ${name}님이 답했어요`,
  liked: '바로 적용했어요', // [확인 필요]
  opposed: '보류했어요. 다음 월말 정리에서 함께 다뤄요', // [확인 필요]
  withdrawn: '제안을 거둬들였어요', // [확인 필요]
  applyOn: (date: string) => `${date}부터 적용`, // [확인 필요] P-11 답 기다리는 제안

  // 항목 이름(“{항목} 전 → 후”), 알림 문장 속 목적어
  items: {
    allowance: (name: string) => `${name}님 용돈`, // [확인 필요]
    split: '분담 방식', // [확인 필요]
  },
  itemObject: {
    allowance: '용돈을',
    split: '분담 방식을',
    living_budget: '생활비 예산을',
    family_budget: '양가 비용 예산을',
    goal_order: '목표 순서를',
  } as Record<string, string>,
  livingBudget: '생활비 예산', // [확인 필요]
  familyBudget: '양가 비용 예산', // [확인 필요]
  familyBudgetValue: (total: string) => `1년 ${total}`,
  goalOrder: '목표 순서', // [확인 필요]
  goalObject: (goal: string) => `${goal} 목표를`, // [확인 필요] 목표 제안 알림 문장
  goalItems: {
    goal_amount: (goal: string) => `${goal} 목표 금액`,
    goal_deadline: (goal: string) => `${goal} 기한`,
    goal_pause: (goal: string) => `${goal} 모으기`, // [확인 필요]
    goal_delete: (goal: string) => `${goal} 목표`, // [확인 필요]
  },
  goalPaused: { true: '보류', false: '모으는 중' }, // [확인 필요]
  goalDeleted: { true: '삭제', false: '있음' }, // [확인 필요]
  goalUnknown: '목표', // [확인 필요] 지운 목표 이름 대신
  goalAdd: (goal: string) => `${goal} 목표 추가`, // [확인 필요]
  arrivedAdd: (name: string, goal: string) => `${name}님이 ${goal} 목표를 추가하자고 제안했어요`, // [확인 필요]
  change: (before: string, after: string) => `${before} → ${after}`,
  unset: '없음', // [확인 필요]
  splitModes: { half: '반반', income: '버는 만큼', custom: '직접 정할게요' },
  splitCustom: (a: string, ap: number, b: string, bp: number) => `${a} ${ap}%, ${b} ${bp}%`, // [확인 필요]
  splitPct: (name: string, pct: number) => `${name} ${pct}%`,
  status: {
    open: '제안 중',
    applied: '적용',
    held: '보류',
    withdrawn: '철회',
    expired: '만료',
    reverted: '되돌림',
    superseded: '대체됨', // [확인 필요]
  },
  received: '받은 제안',
  receivedCount: (n: number) => `받은 제안 ${n}개`, // [확인 필요] 탭 숫자 알약 화면 읽기용
};
