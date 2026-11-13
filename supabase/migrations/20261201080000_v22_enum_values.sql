-- v2.2 PR 1: enum 값 추가만(ADR 0009, plan v2.2 9-2 PR 1). 스키마 규칙: 추가만.
-- `ALTER TYPE … ADD VALUE`로 더한 값은 같은 트랜잭션에서 쓸 수 없어서 이 파일에만 두고,
-- 값을 쓰는 표·함수는 다음 마이그레이션(v22_check_loop 이후)에서 만든다.
--
-- 계약(core가 똑같이 따라 씀, packages/core/src/db.types.ts Enums):
--   split_line_kind  + 'send'            한 사람 관리형(합쳐서 + manager_user_id)에서 관리하지 않는 쪽 ‘보내기’ 줄.
--                                         금액 = 그 사람 월급 − 용돈(1만 원 단위 내림, 0 아래면 0). 서버가 계산하고 앱은 직접 저장 못 함.
--                    + 'shared_account'  각자 계열 ‘같이 쓰는 통장’ 줄(분담 도우미 결과, shared_account 표와 연결).
--   marriage_status  + 'dating'           O-11 ‘연애 중이에요’
--                    + 'living_together'  O-11 ‘같이 살아요’(결혼하지 않고 같이 사는 커플)
--                    (옛 'undecided'는 그대로 둠. 새 코드는 O-11 4지선다만 씀: married/engaged/dating/living_together.
--                     옛 값 옮기기는 Q8: undecided → dating + 다음 접속 때 다시 물음, 앱 단계에서)
--   plan_share       새: 'all' | 'saving_only' | 'done_only'  각자 계열 내 월급 계획 공개 단계(S-13). 기본 saving_only(Q1).
--   money_in_kind    새: 'salary' | 'bonus' | 'family' | 'work' | 'refund' | 'etc'  “돈 들어왔어요”(W-20) 종류.
--   goal_move_reason 새: 'fix' | 'used' | 'interest' | 'reconcile' | 'note_paid' | 'custom' | 'auto'
--                    모은 금액 바로잡기(W-10b) 사유 코드. goal_move.kind는 기존 in/out 그대로.
-- care_day 종류(`dating_anniversary` 등)는 text 열이라 enum 변경 없음.

alter type public.split_line_kind add value if not exists 'send';
alter type public.split_line_kind add value if not exists 'shared_account';

alter type public.marriage_status add value if not exists 'dating';
alter type public.marriage_status add value if not exists 'living_together';

create type public.plan_share as enum ('all', 'saving_only', 'done_only');
create type public.money_in_kind as enum ('salary', 'bonus', 'family', 'work', 'refund', 'etc');
create type public.goal_move_reason as enum
  ('fix', 'used', 'interest', 'reconcile', 'note_paid', 'custom', 'auto');
