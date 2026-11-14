import type { AmountBand } from '@sweetwo/core';

// v2.2 같이 모으기와 돈 기록 이벤트(docs/spec/32-success-metrics.md ‘0-4 이벤트 추가·변경’, PR 10).
// analytics.ts AnalyticsEvent에 묶임. 금액은 _band만
type Sign = 'plus' | 'minus';
export type SavingTogetherEvent =
  | {
      name: 'saving_adjusted';
      props: {
        sign: Sign;
        amount_band: AmountBand;
        reason_code: 'fix' | 'used' | 'interest' | 'custom' | 'note_paid';
        from: 'w10b' | 'note_paid';
      };
    }
  | { name: 'adjust_summary_hidden'; props: { on: boolean } }
  | {
      name: 'savings_reconciled';
      props: { count: number; diff_sign: Sign | 'zero'; diff_band: AmountBand | null };
    }
  | {
      name: 'money_in_logged' | 'money_in_distributed';
      props: {
        kind: 'salary' | 'bonus' | 'family' | 'work' | 'refund' | 'etc';
        amount_band: AmountBand;
        saving_count: number;
        payday_none: boolean;
      };
    }
  | {
      name:
        | 'bundle_created'
        | 'bundle_joined'
        | 'bundle_left'
        | 'bundle_achieved'
        | 'bundle_show_each_toggled';
      props: {
        /**
         * 들어온 곳: band(홈 띠 13번) / saving(W-10 ⋯·W-11 끝) / direct / notification(알림·홈 H-10 들어가기) / w15a /
         * celebrate / s13(설정 S-13 묶음 줄) / money_in(W-20a ‘같이 모으기에 들어가기’, 2026-11-14) / exist(W-15 ‘같이 모을게요’, 2026-11-14)
         */
        entry:
          | 'band'
          | 'saving'
          | 'direct'
          | 'notification'
          | 'w15a'
          | 'celebrate'
          | 's13'
          | 'money_in'
          | 'exist';
        has_target: boolean;
        on: boolean;
        /** 열린 묶음이 있는데 ‘따로 새로 모을게요’로 만듦(2026-11-14 H1) */
        separate?: boolean;
      };
    }
  /** W-15 열린 묶음 질문 답(2026-11-14 H1): 들어가기 / 따로 / 나중에 */
  | { name: 'bundle_open_answered'; props: { choice: 'join' | 'separate' | 'later' } }
  /** W-20 돈 들어온 기록 지우기·고치기(2026-11-14 M6) */
  | { name: 'money_in_deleted' | 'money_in_edited'; props: { distributed: boolean } }
  | { name: 'bundle_percent_only_toggled'; props: { on: boolean } }
  | {
      name: 'saving_note_saved' | 'saving_note_paid';
      props: { has_due: boolean; subtracted: boolean };
    }
  | {
      name: 'next_saving_prompt_viewed' | 'next_saving_prompt_chosen';
      props: { from: 'achieved' | 'deadline'; chip_code: string | null };
    };
