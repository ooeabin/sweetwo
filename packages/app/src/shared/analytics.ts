import type { AmountBand, AuthProvider, HomeTodo } from '@sweetwo/core';

// 분석 이벤트(docs/spec/32-success-metrics.md 이벤트 표). 이름과 속성은 표 그대로.
// PostHog 연결 전까지는 보내지 않고 개발 중에만 콘솔에 남긴다. (서버) 표시 이벤트는 서버가 보낸다.
export type AnalyticsEvent =
  | {
      name: 'app_first_launch';
      props: { download_id: string | null; os: string; app_version: string };
    }
  | {
      name: 'login_started';
      props: {
        method: AuthProvider;
        entry: 'first_run' | 'revisit' | 'invite' | 'session_expired';
        flow: 'browser' | 'popup' | 'redirect';
      };
    }
  | {
      name: 'login_failed';
      props: {
        method: AuthProvider;
        reason:
          | 'cancelled'
          | 'timeout'
          | 'provider_error'
          | 'email_conflict'
          | 'request_mismatch'
          | 'browser_open_failed';
      };
    }
  | {
      name: 'signup_cancelled';
      props: { screen_id: 'A-04' | 'A-05'; via: 'back' | 'hardware_back' };
    }
  | { name: 'pin_forgot_confirmed'; props: Record<string, never> }
  | { name: 'invite_link_opened'; props: { signed_in: boolean } }
  | { name: 'update_view_only'; props: { app_version: string } }
  | {
      name: 'profile_photo_changed';
      props: { action: 'set' | 'remove' | 'imported' };
    }
  | {
      // 온보딩(32 4-3, 2026-11-10 QA 2구간 S2-04). 시작한 사람 흐름. 합류(P-)는 파트너 합류 쪽에서
      name: 'onboarding_started';
      props: { entry: 'direct' | 'invite_link' };
    }
  | {
      name: 'onboarding_step_viewed';
      props: {
        screen_id: string;
        flow: 'starter' | 'partner';
        required: boolean;
        marriage_state: 'married' | 'engaged' | 'undecided' | null;
      };
    }
  | {
      name: 'onboarding_step_completed';
      props: {
        screen_id: string;
        answer: 'input' | 'none';
        duration_sec: number;
        changed_after_back: boolean;
      };
    }
  | { name: 'onboarding_step_skipped'; props: { screen_id: string } }
  | {
      name: 'onboarding_resumed';
      props: { screen_id: string; hours_since_last: number };
    }
  | {
      name: 'onboarding_completed';
      props: {
        duration_sec: number;
        salary_mode: 'separate' | 'combined';
        income_band: AmountBand | 'none';
        split_left_band: AmountBand | 'short';
        no_income: boolean;
      };
    }
  | {
      // O-07 초대 코드 보내기(32 4-3). share = 기기 공유 창(카카오톡 등)
      name: 'invite_sent';
      props: { channel: 'code' | 'link' | 'share'; entry: 'onboarding' | 'home' | 'settings' };
    }
  | {
      // P-01 ‘합류하기’로 코드를 잡음(32 4-3). hours_since_sent는 앱이 모름(null, 서버 이벤트로)
      name: 'invite_accepted';
      props: { hours_since_sent: number | null; channel: 'link' | 'code' };
    }
  | {
      // 합류 완료(32 4-3). hours_since_invite는 앱이 모름(null)
      name: 'partner_joined';
      props: {
        hours_since_invite: number | null;
        mid_cycle: boolean;
        salary_mode: 'separate' | 'combined';
        moved_records: boolean;
      };
    }
  | {
      // S-12 ‘다시 연결하기’(32 4-x)
      name: 'rejoin_requested';
      props: { days_since_unlink: number };
    }
  | {
      // S-12g ‘다시 연결할게요’ / ‘괜찮아요’
      name: 'rejoin_responded';
      props: { response: 'accept' | 'decline'; hours_since_request: number };
    }
  | {
      // S-12c 요청. exported_data = 요청 전 24시간 안에 이 기기에서 S-18 내보내기를 끝냈는지(2026-11-12 QA 11구간 S11-06)
      name: 'unlink_requested';
      props: { linked_months: number; exported_data: boolean };
    }
  | {
      // S-18b 삭제 요청이 받아들여짐(32 4-7, 2026-11-12 QA 11구간 S11-06). exported_before = 24시간 안 이 기기 내보내기
      name: 'account_delete_requested';
      props: {
        couple_state: 'unjoined' | 'linked' | 'unlink_pending' | 'solo';
        exported_before: boolean;
      };
    }
  | {
      name: 'living_check_answered';
      props: {
        answer: 'enough' | 'just' | 'over';
        cover_from?: 'goal' | 'allowance' | 'next_month';
        over_band?: AmountBand;
      };
    }
  | {
      name: 'data_exported';
      props: {
        format: 'csv' | 'pdf';
        scope: 'mine' | 'joint';
        result: 'done' | 'failed' | 'async';
      };
    }
  | {
      name: 'rank_banner_tapped';
      props: { state: 'empty' | 'unseen' | 'seen' | 'stale'; entry: 'assets' };
    }
  | {
      name: 'rank_ad_result';
      // platform: 브리지 플랫폼, 없으면 web(개발 브라우저, 2026-11-12 S8-07)
      props: {
        result: 'rewarded' | 'closed' | 'failed' | 'none';
        platform: 'ios' | 'android' | 'web';
      };
    }
  | {
      // F-03 저장(32 4-5, 2026-11-12 QA 8구간 S8-07). kind = 통장류(현금성, 예금·적금, 청약) account, 부채 debt, 그 밖은 묶음 이름
      name: 'asset_added';
      props: {
        kind: 'account' | 'invest' | 'pension' | 'insurance' | 'real_estate' | 'other' | 'debt';
        entry: 'home' | 'assets' | 'palette';
        is_first: boolean;
      };
    }
  | {
      // 자산·부채 금액을 바꿈(32 4-5, F-04 금액 고치기·시세 바꾸기 저장, 2026-11-12 S8-07)
      name: 'fact_value_changed';
      props: {
        field: 'income' | 'payday' | 'asset' | 'debt';
        change_band: '<5' | '5-20' | '20+';
        source_screen: string;
      };
    }
  | {
      // 되살리기(32 4-7). 지금은 F-04 삭제 Toast ‘되돌리기’(2026-11-12 S8-07)
      name: 'trash_restored';
      props: {
        item_type: 'asset' | 'goal' | 'care_day';
        days_in_trash: number;
        relinked: boolean;
        entry: 'trash' | 'toast';
      };
    }
  | {
      name: 'rank_viewed';
      props: { top_band: number; basis: 'public_2025'; age_band: string | null };
    }
  | {
      // 저금 항목(32 4-5, 2026-11-08 ADR 0007)
      name: 'saving_item_created';
      props: {
        // 2026-11-12 S7-16 salary_row(W-02 ‘+ 저금 추가’ 줄)·salary_wide(W-02 넓은 창 제목 줄)·add_menu·shortcut·direct
        entry:
          | 'home'
          | 'salary'
          | 'salary_row'
          | 'salary_wide'
          | 'split'
          | 'palette'
          | 'list'
          | 'add_menu'
          | 'shortcut'
          | 'direct';
        monthly_band: AmountBand;
        has_target: boolean;
        has_deadline: boolean;
        /** W-11c 이미 모은 금액을 넣었는지(2026-11-09) */
        has_start: boolean;
        target_band?: AmountBand;
      };
    }
  | {
      name: 'saving_item_target_set';
      props: { had_target: boolean; has_deadline: boolean; target_band: AmountBand };
    }
  | {
      // 월급 관리 방식 바꿈(32 4-4). S-11f 저장, P-04 다른 방식으로 ‘바꿀게요’(2026-11-09 round 3 entry)
      name: 'salary_mode_changed';
      props: {
        from: 'separate' | 'combined';
        to: 'separate' | 'combined';
        entry: 's11f' | 'p04';
      };
    }
  | {
      // W-02 묶음 ‘모두 보냈어요’(2026-11-09 round 3). all = 남은 줄을 모두 체크했는지(상대가 먼저 체크한 줄은 빠짐)
      name: 'checklist_group_checked';
      props: { group: 'saving' | 'spend'; lines_count: number; all: boolean };
    }
  | {
      // W-13 저금 목록 열림(2026-11-09 round 3)
      name: 'saving_list_viewed';
      props: { entry: 'checklist' | 'split' | 'home' | 'direct'; items_count: number };
    }
  | { name: 'saving_item_achieved'; props: { months_taken: number } }
  | { name: 'saving_item_after_achieve'; props: { choice: 'keep' | 'stop' | 'retarget' } }
  | {
      // W-10 매달 금액 바로 바꾸기(2026-11-09 round 3, W-10a monthly)
      name: 'saving_monthly_changed';
      props: { monthly_band: AmountBand; direction: 'up' | 'down' };
    }
  | {
      // W-01 영수증(32 4-4, 2026-11-09)
      name: 'split_saved';
      props: {
        changed_lines_count: number;
        editor: 'self';
        left_band: AmountBand | 'short';
        reset_to_recommended: true;
        entry: 'split';
      };
    }
  | {
      name: 'plan_line_changed';
      props: {
        line_kind: 'saving' | 'fixed' | 'living' | 'allowance' | 'custom';
        field: 'amount' | 'name' | 'both';
        direction: 'up' | 'down' | 'same';
        left_band: AmountBand | 'short';
        joint: boolean;
        entry: 'receipt' | 'edit' | 'saving_detail';
      };
    }
  | {
      // Y-08 경조사 기록(32 4-5, 2026-11-12 QA 9구간 S9-05). 서프라이즈(옛 행)면 event_type을 보내지 않음.
      // vs_budget은 금액 메모와 비교, 금액 메모가 없으면 null [확인 필요]
      name: 'event_recorded';
      props: {
        event_type?: 'birthday' | 'holiday' | 'anniversary' | 'family_event' | 'etc';
        amount_band: AmountBand;
        vs_budget: 'under' | 'on' | 'over' | null;
        is_secret: boolean;
      };
    }
  | {
      // 32 4-6 둘이 같이 고치기(2026-11-12 QA 5구간 S5-07). W-01 합쳐서 공동 월급 계획(연결된 커플)에서 보냄
      name: 'shared_item_changed';
      props: {
        item_type: 'split' | 'goal' | 'goal_priority' | 'salary_mode' | 'care_day';
        linked: boolean;
      };
    }
  | {
      name: 'change_reverted';
      props: {
        // asset: F-04 저장 Toast ‘되돌리기’(2026-11-12 S8-05)
        item_type: 'split' | 'goal' | 'goal_priority' | 'salary_mode' | 'care_day' | 'asset';
        entry: 'toast' | 'history';
        reverted_whose: 'self' | 'partner';
        hours_since_change: number;
      };
    }
  | {
      name: 'plan_line_added';
      props: {
        source: 'chip' | 'text';
        chip: string | null;
        amount_band: AmountBand;
        joint: boolean;
      };
    }
  | {
      name: 'plan_line_deleted';
      props: {
        line_kind: 'saving' | 'fixed' | 'living' | 'allowance' | 'custom';
        default_line: boolean;
        entry: 'sheet' | 'edit';
        joint: boolean;
      };
    }
  | {
      name: 'plan_reordered';
      props: { sections: 'saving' | 'spend' | 'both'; lines_count: number; joint: boolean };
    }
  | {
      name: 'plan_shared';
      props: {
        result: 'shared' | 'downloaded' | 'cancelled' | 'failed';
        masked: boolean;
        whose: 'self' | 'partner' | 'joint';
      };
    }
  | {
      name: 'month_result_shared';
      props: {
        result: 'shared' | 'downloaded' | 'cancelled' | 'failed';
        masked: boolean;
        whose: 'self' | 'partner' | 'joint';
        // 2026-11-12 W-02 끝 화면을 없애 ‘done’ 없음(W-02 다 끝난 달 한 줄 = checklist, 지난 달 = past)
        screen: 'checklist' | 'past';
        skipped: number;
      };
    }
  | {
      // 월급 체크리스트 줄(32 4-4, 2026-11-12 QA 6구간 S6-02). 금액은 구간만
      name: 'checklist_line_checked';
      props: {
        line_kind: 'saving' | 'fixed' | 'living' | 'allowance' | 'custom';
        result: 'as_planned' | 'different';
        diff_band: AmountBand | null;
        checked_by: 'self' | 'joint';
        entry: 'w02' | 'w05' | 'w10';
        days_from_payday: number | null;
      };
    }
  | {
      name: 'checklist_line_unchecked';
      props: {
        line_kind: 'saving' | 'fixed' | 'living' | 'allowance' | 'custom';
        minutes_since_checked: number | null;
        entry: 'checkbox' | 'toast';
      };
    }
  | {
      name: 'checklist_line_skipped';
      props: { line_kind: 'saving' | 'fixed' | 'living' | 'allowance' | 'custom' };
    }
  | {
      name: 'checklist_completed';
      props: { hours_since_generated: number; checked_by_partner_count: number };
    }
  | {
      // 홈 허브 상자를 누름(19, 2026-11-09). todo = 할 일 띠 종류(band일 때만, core HomeTodo kind)
      name: 'home_box_tapped';
      props: {
        box: 'hero' | 'band' | 'plan' | 'calendar' | 'saving' | 'assets' | 'savings' | 'retry';
        todo?: HomeTodo['kind'];
      };
    }
  | {
      // 홈 맨 위 띠의 버튼을 누름(2026-11-11 QA 4구간 S4-08). action: open = ‘확인하기’·‘보기’, close = 공지 ‘닫기’
      name: 'home_banner_tapped';
      props: {
        banner: 'unlink' | 'must_notice' | 'mail_bounced' | 'notice';
        action: 'open' | 'close';
      };
    }
  | {
      // W-05 월급 전 확인 열림(32 4-4). entry: home = 홈 할 일 띠, notification = 알림, other = 그 밖(월급 탭 등)
      name: 'month_check_viewed';
      props: { entry: 'notification' | 'home' | 'other'; open_lines_count: number };
    }
  | {
      // 알림을 눌러 들어옴(32 4-7, 2026-11-12 QA 10구간 S10-03). type = 알림 종류(kind), channel inapp = 알림 센터, os = 푸시.
      // minutes_to_open = 알림이 생긴 뒤 분(모르면 null), landing_screen = 간 화면 ID(대상이 없어 Toast면 none)
      name: 'notification_opened';
      props: {
        type: string;
        channel: 'inapp' | 'os';
        minutes_to_open: number | null;
        landing_screen: string;
      };
    }
  | {
      // 좁은 창 메뉴 서랍 줄을 누름(19 앱 기본 틀 11번, 2026-11-09)
      name: 'menu_item_tapped';
      props: { item: string };
    }
  | {
      name: 'plan_link_tapped';
      props: { whose: 'self' | 'partner' | 'joint'; checked: number; total: number };
    }
  | {
      name: 'unlink_resolved';
      // 상대 확인(S-12d) acknowledged, 요청자 취소 canceled(32 4-7, 2026-11-12 S11-06 ‘agreed’에서 맞춤).
      // timeout(요청 + 14일 확정)은 서버가 보냄
      props: {
        path: 'acknowledged' | 'canceled';
        days_pending: number;
        exported_data: boolean;
      };
    };

/** 값이 바뀐 정도(32 fact_value_changed change_band): 변동률 <5 / 5-20 / 20+ %. F-04 금액, S-11c 월급·월급날 */
export const changeBand = (from: number, to: number): '<5' | '5-20' | '20+' => {
  if (from === 0) return to === 0 ? '<5' : '20+';
  const pct = (Math.abs(to - from) * 100) / Math.abs(from);
  return pct < 5 ? '<5' : pct < 20 ? '5-20' : '20+';
};

type Sink = (e: AnalyticsEvent) => void;
let sink: Sink | null = null;

/** PostHog 등 실제 전송기를 붙인다(분석 단계에서). */
export const setAnalyticsSink = (s: Sink) => {
  sink = s;
};

export function track<E extends AnalyticsEvent>(name: E['name'], props: E['props']) {
  const e = { name, props } as AnalyticsEvent;
  if (sink) sink(e);
  else if (import.meta.env.DEV) console.debug('[analytics]', e.name, e.props);
}
