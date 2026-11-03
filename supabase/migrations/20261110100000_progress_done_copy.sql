-- 2026-11-03 진행 문구 ‘5개 중 2개 했어요’ → ‘5개 중 2개 완료’(앱 카드, 위젯과 같게). 함수 본문은 20261101120000과 같고 문구만 바꿈.
create or replace function public.weekly_mail_body(p_receiver uuid, p_actor uuid, p_today date)
returns table (body_text text, body_html text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.app_user;
  who text := coalesce((select nickname from public.app_user where id = p_actor), '');
  lines text[];
  checks text[];
  todo text;
  open_url text := 'https://sweetwo.kr/n';
  settings_url text := 'https://sweetwo.kr/n/settings';
begin
  select * into me from public.app_user where id = p_receiver;
  with w as (
    select c.* from public.partner_change c
    where c.receiver_id = p_receiver and c.actor_id = p_actor
      and (c.created_at at time zone 'Asia/Seoul')::date between p_today - 7 and p_today - 1
  ),
  m as (
    select w.topic, w.ref_id, w.field, min(w.id) as first_id,
      (array_agg(w.noun order by w.id desc))[1] as noun,
      (array_agg(w.before_v order by w.id))[1] as b, (array_agg(w.after_v order by w.id desc))[1] as a
    from w group by w.topic, w.ref_id, w.field
  )
  select array_agg(public.partner_change_line(m.topic, m.field, m.noun, m.b, m.a) order by m.first_id)
    into lines
  from (select * from m where m.b is distinct from m.a order by m.first_id limit 20) m;

  -- 이번 달 월급: 지금 사이클 체크리스트마다 “10월 월급(찬우) 5개 중 2개 완료” [확인 필요]
  select array_agg(
      c.label || case when c.owner_user_id is not null
        then '(' || coalesce((select nickname from public.app_user where id = c.owner_user_id), '') || ')' else '' end
      || ' ' || (select count(*) from public.pay_check_line l where l.checklist_id = c.id) || '개 중 '
      || (select count(*) from public.pay_check_line l where l.checklist_id = c.id and l.state = 'checked') || '개 완료'
      order by c.owner_user_id nulls first)
    into checks
  from public.pay_checklist c
  where c.space_id = me.space_id and c.state <> 'closed' and c.cycle_start <= p_today and c.cycle_end >= p_today;

  -- 남은 할 일: 내 월말 확인(다음 월급날 3일 전부터, 체크 안 한 줄이 있을 때)
  select c.label || '에서 체크 안 한 게 ' || count(l.id) || '개 있어요'
    into todo
  from public.pay_checklist c
  join public.pay_check_line l on l.checklist_id = c.id and l.state = 'wait'
  where c.space_id = me.space_id and c.state = 'open' and c.cycle_end >= p_today and c.cycle_end - 2 <= p_today
    and (c.owner_user_id is null or c.owner_user_id = p_receiver)
  group by c.id, c.label
  limit 1;

  body_text := concat_ws(E'\n',
    who || '님이 바꾼 것',
    array_to_string(array(select '- ' || x from unnest(lines) x), E'\n'),
    case when checks is not null then E'\n이번 달 월급\n' || array_to_string(array(select '- ' || x from unnest(checks) x), E'\n') end,
    case when todo is not null then E'\n남은 할 일\n- ' || todo end,
    E'\n앱에서 보기: ' || open_url,
    '알림 설정: ' || settings_url);
  body_html := concat(
    '<p><b>', public.html_esc(who), '님이 바꾼 것</b></p><ul>',
    (select string_agg('<li>' || public.html_esc(x) || '</li>', '') from unnest(lines) x),
    '</ul>',
    case when checks is not null then '<p><b>이번 달 월급</b></p><ul>'
      || (select string_agg('<li>' || public.html_esc(x) || '</li>', '') from unnest(checks) x) || '</ul>' end,
    case when todo is not null then '<p><b>남은 할 일</b></p><ul><li>' || public.html_esc(todo) || '</li></ul>' end,
    '<p><a href="', open_url, '">앱에서 보기</a></p>',
    '<p><a href="', settings_url, '">알림 설정</a></p>');
  return next;
end;
$$;
