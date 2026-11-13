// TanStack Query 키는 여기에만 모은다.
export const qk = {
  me: ['me'] as const,
  loginEmail: ['me', 'login-email'] as const,
  space: ['space'] as const,
  /** 저금 항목(goal 행, space_goals) */
  goals: ['goals'] as const,
  partner: ['partner'] as const,
  partnerBirthYear: ['partner', 'birth-year'] as const,
  partnerBirthday: ['partner', 'birthday'] as const,
  proposals: ['proposal'] as const,
  fixedExpenses: ['fixed_expense'] as const,
  accounts: ['account'] as const,
  currentPlan: (today: string) => ['monthly_plan', today] as const,
  todos: ['todo'] as const,
  spendCategories: ['spend_category'] as const,
  monthClose: (planId: string) => ['month_close', planId] as const,
  recentCloses: ['recent_closes'] as const,
  assets: ['asset'] as const,
  partnerAssetSums: ['partner_asset_sums'] as const,
  netWorthHistory: ['net_worth_history'] as const,
  incomeItems: ['income_item'] as const,
  incomeEvents: ['income_event'] as const,
  careDays: ['care_day'] as const,
  careRecords: ['care_record'] as const,
  notifications: ['notification'] as const,
  hasUnread: ['notification', 'unread'] as const,
  /** 파트너 활동(H-08). 알림 키 아래라 새 알림이 오면 같이 새로 받음 */
  partnerActivity: ['notification', 'activity'] as const,
  holidays: ['holiday'] as const,
  assetKindNames: ['asset_kind_name'] as const,
  latestInvite: ['invite', 'latest'] as const,
  /** 합류 흐름에 필요한 것(join_context, 2026-11-11 D1) */
  joinContext: ['join_context'] as const,
  /** 다시 연결할 수 있는지(my_reconnect_ok) */
  reconnectOk: ['couple_unlink', 'reconnect_ok'] as const,
  unlink: ['couple_unlink'] as const,
  myUnlink: ['couple_unlink', 'mine'] as const,
  unlinkPartner: ['couple_unlink', 'partner'] as const,
  trash: ['trash'] as const,
  inquiries: ['inquiry'] as const,
  sessions: ['sessions'] as const,
  lastPlanEnd: ['monthly_plan', 'last'] as const,
  livingCheck: (planId: string) => ['living_check', planId] as const,
  closeBalances: ['close_balance'] as const,
  notices: ['notice'] as const,
  weddingItems: ['wedding_item'] as const,
  incomePeriods: ['income_period'] as const,
  checklistDone: ['checklist_done'] as const,
  avatars: ['avatars'] as const,
  carePhotos: ['care_photos'] as const,
  photoConsent: ['consent', 'photo'] as const,
  photoUrls: (paths: string[]) => ['photo_urls', ...paths] as const,
  weddingPayments: ['wedding_payment'] as const,
  pastPlans: (today: string) => ['monthly_plan', 'past', today] as const,
  recentClosesLong: ['recent_closes', 'long'] as const,
  assetHistory: (id: string) => ['asset_history', id] as const,
  splits: ['salary_split'] as const,
  checklists: (today: string) => ['pay_checklist', today] as const,
  pastChecklists: (owner: string | null, before: string) =>
    ['pay_checklist', 'past', owner ?? 'joint', before] as const,
  /** 저금 항목별 모은 금액 */
  goalSaved: ['goal_saved'] as const,
  pendingTerms: ['pending_terms'] as const,
  mailBounced: ['mail_bounced'] as const,
  /** 저금 항목 하나의 체크 줄(W-10 저금 내역) */
  goalLines: (id: string) => ['pay_check_line', 'goal', id] as const,
  // ── v2.2(ADR 0009) ──
  /** 관리 형태(my_manage_style). 공간 키 아래라 공간이 바뀌면 같이 새로 받음 */
  manageStyle: ['space', 'manage_style'] as const,
  /** 관리 형태 바꾸기 요청(mode_change_request) */
  modeRequests: ['mode_change_request'] as const,
  /** 상대에게 보이는 내(또는 상대) 월급 계획(partner_plan_view). viewer = 보는 사람(S-13p 미리 보기는 상대 id) */
  partnerPlanView: (viewer: string | null) => ['partner_plan_view', viewer ?? 'me'] as const,
  /** 날짜를 정한 월급 변경(salary_change) */
  salaryChanges: ['salary_change'] as const,
  /** 홈 띠 닫기·끝냄(home_task_state) */
  homeTasks: ['home_task_state'] as const,
};

/** 월급 계획이 바뀌면 다시 읽을 것(W-01 줄 RPC 뒤, Realtime salary_split 신호): 월급 계획, 체크리스트, 저금 항목, 모은 금액 */
export const splitKeys = [qk.splits, ['pay_checklist'], qk.goals, qk.goalSaved] as const;

/** 관리 형태가 바뀌면 다시 읽을 것(request/answer_mode_change 뒤, Realtime mode_change_request): 공간, 요청, 월급 계획 쪽, 상대 보기 */
export const manageKeys = [qk.space, qk.modeRequests, ...splitKeys, ['partner_plan_view']] as const;
/** 월급 변경이 바뀌면 다시 읽을 것(schedule/cancel_salary_change 뒤, Realtime salary_change): 변경 목록, 나, 상대, 월급 계획 쪽 */
export const salaryChangeKeys = [qk.salaryChanges, qk.me, qk.partner, ...splitKeys] as const;
