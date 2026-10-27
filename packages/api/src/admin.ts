import {
  AdminAccessData,
  AdminDashboard,
  AdminInquiry,
  AdminMe,
  AdminReveal,
  AdminUserDetail,
  type AdminRole,
  type Json,
  type Tables,
} from '@sweetwo/core';
import { supabase } from './client';

// 어드민(27, 33). 어드민 앱만 부른다. 권한·2단계 인증·감사 로그는 서버 함수가 확인한다.
// 오류는 서버 코드(not_admin, mfa_required, no_permission …)를 그대로 올려 화면이 문구로 바꾼다.
export class AdminError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const KNOWN = [
  'not_admin',
  'mfa_required',
  'no_permission',
  'not_found',
  'reason_required',
  'bad_scope',
  'raw_one_screen',
  'not_allowed',
  'bad_body',
  'bad_action',
  'self_approval',
  'quiet_hours',
  'legal_check_required',
  'bad_value',
  'self_lock',
  // 로그인 링크(Supabase Auth 오류 코드)
  'over_email_send_rate_limit',
  'email_address_not_authorized',
];
const fail = (e: { message?: string; code?: string } | null) => {
  if (!e) return;
  const code = KNOWN.find((k) => e.code === k || e.message?.includes(k));
  throw new AdminError(code ?? (e.message?.includes('fetch') ? 'network' : 'unknown'));
};

// ── 로그인(매직 링크 + 인증 앱 OTP) ─────────────────────────────────────
export async function adminSendLink(email: string, redirectTo: string) {
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  fail(error);
}
/** 매직 링크로 돌아오면(?code=) 세션으로 바꾸고 주소에서 지움. 지금 세션(없으면 null) */
export async function adminSession() {
  const sb = supabase();
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (code) {
    await sb.auth.exchangeCodeForSession(code).catch(() => undefined);
    url.searchParams.delete('code');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  const { data } = await sb.auth.getSession();
  return data.session;
}
export async function adminSignOut() {
  await supabase().auth.signOut();
}
/** 2단계 인증 상태: 등록한 인증 앱이 있는지, 지금 세션이 aal2인지 */
export async function adminMfaState() {
  const sb = supabase();
  const [{ data: aal, error: e1 }, { data: f, error: e2 }] = await Promise.all([
    sb.auth.mfa.getAuthenticatorAssuranceLevel(),
    sb.auth.mfa.listFactors(),
  ]);
  fail(e1);
  fail(e2);
  const totp = (f?.totp ?? []).find((x) => x.status === 'verified') ?? null;
  return { current: aal?.currentLevel ?? null, factorId: totp?.id ?? null };
}
/** 인증 앱 등록 시작: QR(svg 데이터 주소)와 비밀 값 */
export async function adminMfaEnroll() {
  const { data, error } = await supabase().auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'sweeTwo 어드민',
  });
  fail(error);
  return {
    factorId: data?.id ?? '',
    qr: data?.totp.qr_code ?? '',
    secret: data?.totp.secret ?? '',
  };
}
export async function adminMfaVerify(factorId: string, code: string) {
  const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId, code });
  fail(error);
}

// ── 관리자, 대시보드, 회원 ────────────────────────────────────────────
/** 관리자가 아무도 없을 때 회사 도메인 이메일이면 첫 최고 관리자(서버가 확인) */
export async function adminBootstrap(): Promise<boolean> {
  const { data, error } = await supabase().rpc('admin_bootstrap');
  fail(error);
  return !!data;
}
export async function fetchAdminMe(): Promise<AdminMe> {
  const { data, error } = await supabase().rpc('admin_me');
  fail(error);
  return AdminMe.parse(data);
}
export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const { data, error } = await supabase().rpc('admin_dashboard');
  fail(error);
  return AdminDashboard.parse(data);
}
export type AdminSearchRow = {
  user_id: string;
  email_masked: string;
  created_at: string;
  couple_state: string | null;
  subscription: string;
};
/** 내려받기 전 사유 기록(감사 로그). 돌려줌: 파일에 적을 관리자 ID */
export async function adminNoteExport(
  screen: 'AD-02',
  reason: string,
  rows: number,
): Promise<string> {
  const { data, error } = await supabase().rpc('admin_note_export', {
    p_screen: screen,
    p_reason: reason,
    p_rows: rows,
  });
  fail(error);
  return String(data ?? '');
}
export async function adminSearch(q: string): Promise<AdminSearchRow[]> {
  const { data, error } = await supabase().rpc('admin_search', { p_q: q });
  fail(error);
  return data ?? [];
}
export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  const { data, error } = await supabase().rpc('admin_user_detail', { p_user: id });
  fail(error);
  return AdminUserDetail.parse(data);
}
export async function adminReveal(
  id: string,
  reason: string,
  inquiryNo: string,
  scopes: ('email' | 'sign_ins' | 'payments')[],
): Promise<AdminReveal> {
  const { data, error } = await supabase().rpc('admin_reveal', {
    p_user: id,
    p_reason: reason,
    p_inquiry_no: inquiryNo,
    p_scopes: scopes,
  });
  fail(error);
  return AdminReveal.parse(data);
}
export async function adminRequestAccess(
  inquiryId: string,
  scopes: string[],
  raw: boolean,
  reason: string,
): Promise<string> {
  const { data, error } = await supabase().rpc('admin_request_access', {
    p_inquiry: inquiryId,
    p_scopes: scopes,
    p_raw: raw,
    p_reason: reason,
  });
  fail(error);
  return data as string;
}
export async function fetchAdminAccessData(accessId: string): Promise<AdminAccessData> {
  const { data, error } = await supabase().rpc('admin_access_data', { p_access: accessId });
  fail(error);
  return AdminAccessData.parse(data);
}
export type AdminAction = 'sign_out_all' | 'rights_access' | 'rights_fix' | 'rights_delete';
export async function adminAccountAction(
  id: string,
  action: AdminAction,
  inquiryNo: string,
  note: string,
) {
  const { error } = await supabase().rpc('admin_account_action', {
    p_user: id,
    p_action: action,
    p_inquiry_no: inquiryNo,
    p_note: note,
  });
  fail(error);
}

// ── 문의(AD-06) ──────────────────────────────────────────────────────
export type InquiryStatus = 'received' | 'in_progress' | 'waiting_user' | 'done';
export type AdminInquiryRow = {
  id: string;
  no: string;
  category: string;
  status: string;
  channel: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};
export async function fetchAdminInquiries(status: InquiryStatus): Promise<AdminInquiryRow[]> {
  const { data, error } = await supabase().rpc('admin_inquiries', { p_status: status });
  fail(error);
  return data ?? [];
}
export async function fetchAdminInquiryCounts(): Promise<Record<InquiryStatus, number>> {
  const { data, error } = await supabase().rpc('admin_inquiry_counts');
  fail(error);
  const o = (data ?? {}) as Record<string, number>;
  return {
    received: o.received ?? 0,
    in_progress: o.in_progress ?? 0,
    waiting_user: o.waiting_user ?? 0,
    done: o.done ?? 0,
  };
}
export async function fetchAdminInquiry(id: string): Promise<AdminInquiry> {
  const { data, error } = await supabase().rpc('admin_inquiry', { p_id: id });
  fail(error);
  return AdminInquiry.parse(data);
}
export async function adminAnswerInquiry(id: string, body: string, status: InquiryStatus) {
  const { error } = await supabase().rpc('admin_answer_inquiry', {
    p_id: id,
    p_body: body,
    p_status: status,
  });
  fail(error);
}
export async function adminSetInquiryStatus(id: string, status: InquiryStatus) {
  const { error } = await supabase().rpc('admin_set_inquiry_status', {
    p_id: id,
    p_status: status,
  });
  fail(error);
}

// ── 감사 로그(AD-17) ─────────────────────────────────────────────────
export type AdminAuditRow = Tables<'admin_audit'>;
export async function fetchAdminAudit(f: {
  admin?: string;
  target?: string;
  action?: string;
  from?: string;
  to?: string;
}): Promise<AdminAuditRow[]> {
  const { data, error } = await supabase().rpc('admin_audit_rows', {
    ...(f.admin ? { p_admin: f.admin } : {}),
    ...(f.target ? { p_target: f.target } : {}),
    ...(f.action ? { p_action: f.action } : {}),
    ...(f.from ? { p_from: f.from } : {}),
    ...(f.to ? { p_to: f.to } : {}),
  });
  fail(error);
  return data ?? [];
}

// ── 2인 승인 ─────────────────────────────────────────────────────────
export type ApprovalStatus = 'requested' | 'approved' | 'rejected' | 'cancelled';
export type AdminApprovalRow = {
  id: string;
  kind: string;
  summary: string;
  payload: Json;
  requested_by: string | null;
  requested_at: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
};
export async function fetchAdminApprovals(status: ApprovalStatus): Promise<AdminApprovalRow[]> {
  const { data, error } = await supabase().rpc('admin_approvals', { p_status: status });
  fail(error);
  return data ?? [];
}
export async function adminDecide(id: string, decision: 'approve' | 'reject' | 'cancel') {
  const { error } = await supabase().rpc('admin_decide', { p_id: id, p_decision: decision });
  fail(error);
}

// ── AD-10 공지 ───────────────────────────────────────────────────────
export type Notice = Tables<'notice'>;
export async function fetchAdminNotices(): Promise<Notice[]> {
  const { data, error } = await supabase().rpc('admin_notices');
  fail(error);
  return data ?? [];
}
/** 약관 개정·장애 공지를 이메일로도(초안·승인 대기만) */
export async function adminSetNoticeEmail(id: string, email: boolean) {
  const { error } = await supabase().rpc('admin_set_notice_email', { p_id: id, p_email: email });
  fail(error);
}
export async function adminSaveNotice(n: {
  id: string | null;
  kind: string;
  title: string;
  body: string;
  importance: 'normal' | 'must';
  platforms: ('desktop' | 'mobile' | 'web')[];
  startsAt: string;
  endsAt: string;
  request: boolean;
}): Promise<string> {
  const { data, error } = await supabase().rpc('admin_save_notice', {
    // 새 공지는 p_id = null(PostgREST는 null 그대로 넘김)
    p_id: n.id as string,
    p_kind: n.kind,
    p_title: n.title,
    p_body: n.body,
    p_importance: n.importance,
    p_platforms: n.platforms,
    p_starts_at: n.startsAt,
    p_ends_at: n.endsAt,
    p_request: n.request,
  });
  fail(error);
  return data as string;
}
export async function adminEndNotice(id: string) {
  const { error } = await supabase().rpc('admin_end_notice', { p_id: id });
  fail(error);
}

// ── AD-14·15 버전 ────────────────────────────────────────────────────
export type ContentVersion = Tables<'content_version'>;
export async function fetchContentVersions(): Promise<ContentVersion[]> {
  const { data, error } = await supabase().rpc('admin_content_versions');
  fail(error);
  return data ?? [];
}
export async function adminAddContentVersion(v: {
  kind: 'guide' | 'checklist' | 'faq';
  key: string;
  version: string;
  effective: string;
  checked: string;
  note: string;
}) {
  const { error } = await supabase().rpc('admin_add_content_version', {
    p_kind: v.kind,
    p_key: v.key,
    p_version: v.version,
    p_effective: v.effective,
    p_checked: v.checked,
    p_note: v.note,
  });
  fail(error);
}
export type TermsVersionRow = {
  id: string;
  kind: string;
  version: string;
  effective_on: string;
  reconsent: boolean;
  legal_checked: boolean;
  status: string;
  agreed: number;
};
export async function fetchTermsVersions(): Promise<TermsVersionRow[]> {
  const { data, error } = await supabase().rpc('admin_terms_versions');
  fail(error);
  return data ?? [];
}
export async function adminAddTermsVersion(v: {
  kind: 'terms' | 'privacy';
  version: string;
  effective: string;
  reconsent: boolean;
  legalChecked: boolean;
}) {
  const { error } = await supabase().rpc('admin_add_terms_version', {
    p_kind: v.kind,
    p_version: v.version,
    p_effective: v.effective,
    p_reconsent: v.reconsent,
    p_legal_checked: v.legalChecked,
  });
  fail(error);
}

// ── AD-16 앱 버전·점검 ───────────────────────────────────────────────
export type AppConfigRow = {
  min_version_desktop: string;
  min_version_web: string;
  min_version_ios: string;
  min_version_android: string;
  latest_version_desktop: string;
  maintenance_starts_at: string | null;
  maintenance_ends_at: string | null;
  maintenance_message: string | null;
};
export async function fetchAdminAppConfig(): Promise<AppConfigRow> {
  const { data, error } = await supabase().rpc('admin_app_config');
  fail(error);
  return data as unknown as AppConfigRow;
}
export async function adminRequestAppConfig(p: Partial<AppConfigRow>) {
  const { error } = await supabase().rpc('admin_request_app_config', { p: p as Json });
  fail(error);
}

// ── AD-18 관리자 계정 ────────────────────────────────────────────────
export type AdminUserRow = {
  email: string;
  name: string;
  roles: AdminRole[];
  locked: boolean;
  last_seen_at: string | null;
  linked: boolean;
  mfa: boolean;
};
export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase().rpc('admin_users');
  fail(error);
  return (data ?? []) as AdminUserRow[];
}
export async function adminRequestUser(email: string, name: string, roles: AdminRole[]) {
  const { error } = await supabase().rpc('admin_request_user', {
    p_email: email,
    p_name: name,
    p_roles: roles,
  });
  fail(error);
}
export async function adminSetLock(email: string, locked: boolean) {
  const { error } = await supabase().rpc('admin_set_lock', { p_email: email, p_locked: locked });
  fail(error);
}
export async function fetchAdminReviews(): Promise<
  { at: string; by_email: string | null; note: string }[]
> {
  const { data, error } = await supabase().rpc('admin_reviews');
  fail(error);
  return data ?? [];
}
export async function adminAddReview(note: string) {
  const { error } = await supabase().rpc('admin_add_review', { p_note: note });
  fail(error);
}

// ── AD-19 기준 데이터 ────────────────────────────────────────────────
export type LoanRate = Tables<'loan_rate'>;
export async function fetchLoanRates(): Promise<LoanRate[]> {
  const { data, error } = await supabase().from('loan_rate').select('*').order('kind');
  fail(error);
  return data ?? [];
}
export async function adminSetLoanRate(kind: string, rateBp: number, applied: string) {
  const { error } = await supabase().rpc('admin_set_loan_rate', {
    p_kind: kind,
    p_rate_bp: rateBp,
    p_applied: applied,
  });
  fail(error);
}
export async function adminSetHoliday(
  date: string,
  name: string,
  kind: 'holiday' | 'substitute' | 'temporary',
  del = false,
) {
  const { error } = await supabase().rpc('admin_set_holiday', {
    p_date: date,
    p_name: name,
    p_kind: kind,
    p_delete: del,
  });
  fail(error);
}
