// 관리 형태(docs/spec/08 v2.2 ‘세 질문 → 엔진 값’, plan v2.2 2-5, ADR 0009 결정 6·8-1).
// O-30 “같이 쓰는 생활비가 있어요?” + O-30b “같이 모으는 저금이 있어요?” + O-30c “누가 주로 관리해요?”를
// 엔진 값(salary_mode, 관리하는 사람)과 이름 코드로 옮김. 서버 resolve_manage_style(·my_manage_style)과 같은 결과.
// 화면 규칙은 salary_mode와 관리하는 사람만 본다. shared_living·shared_saving은 권유와 이름 표시에만.

export type SalaryMode = 'separate' | 'joint';
/** O-30c 답. ‘제가 주로 해요’ / ‘{파트너}가 주로 해요’ / ‘둘이 같이 해요’ / ‘각자 자기 월급으로 해요’ */
export type ManagerAnswer = 'me' | 'partner' | 'together' | 'each';
/** 이름 코드(앱 copy가 “한 사람이 관리해요” 등으로 바꿈) */
export type ManageStyle =
  'one_manager' | 'together' | 'living_saving' | 'living_only' | 'saving_only' | 'separate';

export interface ResolvedManageStyle {
  salaryMode: SalaryMode;
  /** 관리하는 사람(‘나’ 기준). 한 사람 관리형만 */
  manager: 'me' | 'partner' | null;
  style: ManageStyle;
}

/** 같이 계열(엔진 합쳐서) 이름 코드 */
export const JOINT_STYLES: readonly ManageStyle[] = ['one_manager', 'together'];

/**
 * 2-5 표(서버 resolve_manage_style). 생활비 ‘아니요’면 O-30c 답은 보지 않음.
 * 생활비 ‘네’인데 관리 답이 없으면 'need_manager' 오류(서버와 같은 코드)
 */
export function resolveManageStyle(
  sharedLiving: boolean,
  sharedSaving: boolean | null,
  manager: ManagerAnswer | null,
): ResolvedManageStyle {
  const saving = sharedSaving ?? false;
  if (!sharedLiving)
    return { salaryMode: 'separate', manager: null, style: saving ? 'saving_only' : 'separate' };
  if (manager === 'me' || manager === 'partner')
    return { salaryMode: 'joint', manager, style: 'one_manager' };
  if (manager === 'together') return { salaryMode: 'joint', manager: null, style: 'together' };
  if (manager === 'each')
    return {
      salaryMode: 'separate',
      manager: null,
      style: saving ? 'living_saving' : 'living_only',
    };
  throw new Error('need_manager');
}

export interface ManageSpace {
  salary_mode: SalaryMode;
  manager_user_id: string | null;
  shared_living: boolean | null;
  shared_saving: boolean | null;
}

/** 지금 공간의 이름 코드(서버 my_manage_style). 옛 공간(아직 세 질문 전)도 같은 규칙 */
export function manageStyleOf(s: ManageSpace): ManageStyle {
  if (s.salary_mode === 'joint') return s.manager_user_id ? 'one_manager' : 'together';
  const living = s.shared_living ?? false;
  const saving = s.shared_saving ?? false;
  if (living && saving) return 'living_saving';
  if (living) return 'living_only';
  if (saving) return 'saving_only';
  return 'separate';
}

/** 한 사람 관리형에서 내가 관리하지 않는 쪽인가(H-11 ‘보내기와 용돈은 자동이에요’, 보내기 줄 잠금) */
export const isNonManager = (
  s: Pick<ManageSpace, 'salary_mode' | 'manager_user_id'>,
  meId: string,
) => s.salary_mode === 'joint' && !!s.manager_user_id && s.manager_user_id !== meId;

/** 같이 모으기 묶음(W-15)을 만들 수 있는 엔진(각자 계열만) */
export const bundleAllowed = (mode: SalaryMode) => mode === 'separate';

/** 분석 manage_answers_saved.manager 값(32 8-4) */
export const managerEventValue = (m: ManagerAnswer | null) =>
  m === 'me' ? 'self' : m === 'together' ? 'both' : m;

export interface ModeChangeInput {
  /** 연결돼 있고 상대가 있음 */
  connected: boolean;
  fromMode: SalaryMode;
  /** 지금 관리하는 사람 id */
  fromManagerId: string | null;
  toMode: SalaryMode;
  /** 바꾼 뒤 관리하는 사람 id */
  toManagerId: string | null;
  partnerId: string | null;
}

/**
 * 바꾸기에 상대 ‘좋아요’가 필요한가(서버 request_mode_change, D7):
 * 연결된 공간에서 (가) 각자 → 합쳐서, (나) 관리하는 사람을 ‘상대’로 바꿈. 그 밖은 바로 적용 + 상대 알림
 */
export function modeChangeNeedsAccept(o: ModeChangeInput): boolean {
  if (!o.connected || !o.partnerId) return false;
  if (o.fromMode === 'separate' && o.toMode === 'joint') return true;
  return o.toMode === 'joint' && o.toManagerId === o.partnerId && o.fromManagerId !== o.partnerId;
}
