-- pgTAP: v2.2 PR 1 enum 값(20261201080000). 값이 있고 순서가 core와 같은지.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select enum_has_labels('public', 'split_line_kind',
  array['saving', 'fixed', 'living', 'allowance', 'custom', 'send', 'shared_account'],
  'split_line_kind에 send, shared_account');
select enum_has_labels('public', 'marriage_status',
  array['married', 'engaged', 'undecided', 'dating', 'living_together'],
  'marriage_status에 dating, living_together(옛 undecided는 그대로)');
select enum_has_labels('public', 'plan_share', array['all', 'saving_only', 'done_only'],
  '새 plan_share');
select enum_has_labels('public', 'money_in_kind',
  array['salary', 'bonus', 'family', 'work', 'refund', 'etc'], '새 money_in_kind');
select enum_has_labels('public', 'goal_move_reason',
  array['fix', 'used', 'interest', 'reconcile', 'note_paid', 'custom', 'auto'],
  '새 goal_move_reason');

select * from finish();
rollback;
