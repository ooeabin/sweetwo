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
  /** 같이 모으기 묶음(bundle_view) */
  bundles: ['saving_bundle'] as const,
  /** 돈 들어왔어요 기록(money_in) */
  moneyIns: ['money_in'] as const,
  /** 날짜 없는 사람의 기간(money_in_period). 돈 들어왔어요 키 아래 */
  moneyInPeriod: (today: string) => ['money_in', 'period', today] as const,
  /** 한 저금의 돈 움직임(goal_move_public)과 내 사유 글 */
  goalMoves: (id: string) => ['goal_move', id] as const,
  goalMoveReasons: (id: string) => ['goal_move', id, 'reasons'] as const,
  /** 쓸 곳 메모(저금 또는 묶음 하나, 다가오는 것) */
  savingNotes: (o: { goalId?: string; bundleId?: string }) =>
    ['saving_note', o.goalId ?? '', o.bundleId ?? ''] as const,
  upcomingNotes: (from: string, to: string) => ['saving_note', 'upcoming', from, to] as const,
  /** 분담(shared_account) */
  sharedAccounts: ['shared_account'] as const,
  /** 순자산 요약(networth_summary), 순위 미리 보기(networth_rank_pair), 열린 순위 요청 */
  networthSummary: ['asset', 'summary'] as const,
  rankPair: ['asset', 'rank_pair'] as const,
  rankRequest: ['rank_consent_request'] as const,
  /** 내가 순위를 본 적이 있나(rank_view, 첫 조회 무료 판단) */
  rankViewed: ['rank_view'] as const,
};

/** 월급 계획이 바뀌면 다시 읽을 것(W-01 줄 RPC 뒤, Realtime salary_split 신호): 월급 계획, 체크리스트, 저금 항목, 모은 금액 */
export const splitKeys = [qk.splits, ['pay_checklist'], qk.goals, qk.goalSaved] as const;

/** 관리 형태가 바뀌면 다시 읽을 것(request/answer_mode_change 뒤, Realtime mode_change_request): 공간, 요청, 월급 계획 쪽, 상대 보기 */
export const manageKeys = [qk.space, qk.modeRequests, ...splitKeys, ['partner_plan_view']] as const;
/** 월급 변경이 바뀌면 다시 읽을 것(schedule/cancel_salary_change 뒤, Realtime salary_change): 변경 목록, 나, 상대, 월급 계획 쪽 */
export const salaryChangeKeys = [qk.salaryChanges, qk.me, qk.partner, ...splitKeys] as const;
/** 모은 금액이 바뀌면 다시 읽을 것(바로잡기, 잔액 맞추기, 냈어요, 돈 나눠 넣기 뒤): 저금, 모은 금액, 움직임, 묶음, 메모 */
export const savingKeys = [
  qk.goals,
  qk.goalSaved,
  ['goal_move'],
  qk.bundles,
  ['saving_note'],
] as const;
/** 묶음이 바뀌면(묶음 RPC 뒤, Realtime saving_bundle) */
export const bundleKeys = [qk.bundles, qk.goals, qk.goalSaved] as const;
/** 돈 들어왔어요가 바뀌면(기록·고치기·지우기·나눠 넣기 뒤, Realtime money_in) */
export const moneyInKeys = [qk.moneyIns, ...savingKeys] as const;
/** 분담이 바뀌면(propose/answer_split 뒤, Realtime shared_account): 분담, 월급 계획 쪽 */
export const splitAccountKeys = [qk.sharedAccounts, ...splitKeys] as const;
/** 순위·동의가 바뀌면(request/answer/turnOff, record_rank_view, Realtime rank_consent_request) */
export const rankKeys = [qk.rankRequest, qk.rankPair, qk.rankViewed, qk.me, qk.partner] as const;
