import type { AmountBand, AuthProvider } from '@sweetwo/core';

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
      name: 'profile_photo_changed';
      props: { action: 'set' | 'remove' | 'imported' };
    }
  | {
      name: 'onboarding_resumed';
      props: { screen_id: string; hours_since_last: number };
    }
  | {
      name: 'unlink_requested';
      props: { linked_months: number };
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
      props: { state: 'empty' | 'unseen' | 'seen' | 'stale'; entry: 'home' | 'assets' };
    }
  | {
      name: 'rank_ad_result';
      props: { result: 'rewarded' | 'closed' | 'failed' | 'none' };
    }
  | {
      name: 'rank_viewed';
      props: { top_band: number; basis: 'public_2025'; age_band: string | null };
    }
  | {
      // 저금 항목(32 4-5, 2026-11-08 ADR 0007)
      name: 'saving_item_created';
      props: {
        entry: 'home' | 'salary' | 'split' | 'palette' | 'list';
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
        result: 'shared' | 'saved' | 'downloaded' | 'cancelled' | 'failed';
        masked: boolean;
        whose: 'self' | 'partner' | 'joint';
      };
    }
  | {
      name: 'month_result_shared';
      props: {
        result: 'shared' | 'saved' | 'downloaded' | 'cancelled' | 'failed';
        masked: boolean;
        whose: 'self' | 'partner' | 'joint';
        screen: 'done' | 'checklist' | 'past';
        skipped: number;
      };
    }
  | {
      // 홈 허브 상자를 누름(19, 2026-11-09). todo = 할 일 띠 종류(band일 때만)
      name: 'home_box_tapped';
      props: {
        box: 'hero' | 'band' | 'plan' | 'calendar' | 'saving' | 'assets' | 'savings';
        todo?: string;
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
      // deadline(요청 + 14일 확정)은 서버가 보냄
      props: {
        path: 'agreed' | 'canceled';
        days_pending: number;
        exported_data: boolean;
      };
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
