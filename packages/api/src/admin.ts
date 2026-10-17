import {
  AdminAccessData,
  AdminDashboard,
  AdminInquiry,
  AdminMe,
  AdminReveal,
  AdminUserDetail,
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
];
const fail = (e: { message?: string } | null) => {
  if (!e) return;
  const code = KNOWN.find((k) => e.message?.includes(k));
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
