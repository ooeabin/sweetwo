// e2e 가짜 Supabase(2026-11-13 PR 14에서 한 폴더로 모음). 스펙은 이 파일에서만 가져온다.
//
// 흉내는 Playwright page.route 하나(app-db)가 기본이고, v2.2 화면 묶음마다 앞에서 먼저 받는다.
// 같은 RPC를 두 곳이 흉내 내면 나중에 붙인 route가 먼저 받음(Playwright 규칙) → 아래 순서표가 실제 우선순위.
//
// | 파일 | 붙이는 함수 | 맡는 것 |
// | --- | --- | --- |
// | supabase.ts | mockSupabase | 로그인(auth), 가짜 JWT, 찬우·예빈 ID(chanwoo, YEBIN) |
// | app-db.ts | mockOnboarding → MemDb | 앱 전체 기본 DB(표 읽기·쓰기, 예전 RPC 대부분). 처음에 v22-pay를 먼저 부름 |
// | v22-pay.ts | (app-db가 부름) handleV22Pay | 월급날 확인·홈 v2.2: start_checklist, check_pay_line, confirm_payday, split_lines_configure, dismiss_home_task, money_in_period, bundle_view(읽기) |
// | saving.ts | mockSaving | 같이 모으기·돈 기록: bundle_*, log_money_in, distribute_money_in, adjust_saving, reconcile_savings, saving_note·mark_note_paid, goal_saved_sums |
// | v22-settings.ts | mockV22Settings | 공개·관계·설정: request/answer/cancel_mode_change, partner_plan_view, propose/answer_split, schedule/cancel_salary_change, rank 동의, 다시 연결 |
// | realtime.ts | mockRealtime | Realtime 웹소켓 |
// | seed-home.ts | seed | 홈·월급 화면 공통 시드(찬우 월급 계획, 저금 둘) |
//
// 서버와 같은 모양(B1, 2026-11-13): 앱이 Zod로 검사하는 응답은 mock-shapes.spec.ts가 core 스키마로 다시 확인한다.
// 새 RPC를 흉내 내면 그 스펙에도 한 줄 더한다.
export { mockOnboarding, type MemDb } from './app-db';
export { json, ok, rpcError } from './http';
export { mockRealtime } from './realtime';
export { mockSaving, newSavingDb, notiTitles, type SavingDb } from './saving';
export { seed } from './seed-home';
export {
  asReturningFromProvider,
  chanwoo,
  fakeJwt,
  mockSupabase,
  SB,
  YEBIN,
  type MockOptions,
} from './supabase';
export { emptyV22, handleV22Pay, type V22PayDb } from './v22-pay';
export { mockV22Settings, type V22SettingsDb } from './v22-settings';
