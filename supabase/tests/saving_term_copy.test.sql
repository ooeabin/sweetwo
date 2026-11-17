-- pgTAP: 2026-11-17 사용자 결정 ‘저금’ → ‘저축·투자’ 서버 문구(partner_change_title·line, pay_line_noun 대체값)
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(public.partner_change_title('goal', '카메라', '예빈'), '예빈님이 카메라 저축·투자를 바꿨어요', '변경 알림 제목');
select is(public.partner_change_line('goal', 'deleted', '카메라', null, null), '저축·투자를 지웠어요', '지움');
select is(public.partner_change_line('goal', 'restored', '카메라', null, null), '저축·투자를 되살렸어요', '되살림');
select is(public.partner_change_line('goal_meta', 'added', '카메라', null, null), '저축·투자를 추가했어요', '추가');
select is(public.pay_line_noun('saving', null, null), '저축·투자', '이름이 없을 때 대체값');

select * from finish();
rollback;
