-- 2026-11-06 호칭: 결혼하지 않은 커플도 쓰므로 사용자에게 보이는 ‘배우자’, ‘부부’를 바꿈(CLAUDE.md 문구).
-- 파트너는 애칭, 애칭이 없으면 ‘파트너가 …’(‘파트너님이’가 아님). 운영자에게 가는 문구는 ‘커플’.
-- 함수 본문은 각 최신 정의와 같고 문구만 바꿈. 권한은 그대로(트리거는 다시 만들지 않음).

-- 합류 알림(14). 최신 정의 20261030090000_join_replan.sql
create or replace function public.notify_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  joiner public.app_user;
begin
  if old.couple_state = 'not_joined' and new.couple_state = 'connected' then
    select * into joiner from public.app_user
      where space_id = new.id and status = 'active' and id <> new.created_by limit 1;
    if joiner.id is null or new.created_by is null then return new; end if;
    perform public.notify(
      new.created_by, new.id, 'partner_joined',
      coalesce(coalesce(joiner.nickname, new.partner_nickname) || '님이', '파트너가') || ' 합류했어요',
      '이제 목표와 월급을 같이 봐요', '/', null, joiner.id, 'joined:' || new.id || ':' || joiner.id);
  end if;
  return new;
end;
$$;

-- P-04 합류 중 관리 방식 바꾸기(18). 최신 정의 20261030090000_join_replan.sql
create or replace function public.set_join_salary_mode(p_mode public.salary_mode)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
  sp public.couple_space;
  starter public.app_user;
  me public.app_user;
begin
  select * into sp from public.couple_space where id = sid for update;
  if sp.salary_mode = p_mode then
    return;
  end if;
  select * into starter from public.app_user where id = sp.created_by;
  select * into me from public.app_user where id = uid;
  if p_mode = 'joint' then
    update public.salary_split set owner_user_id = null where space_id = sid and owner_user_id = starter.id;
    update public.pay_checklist set owner_user_id = null where space_id = sid and owner_user_id = starter.id;
    -- 기준일은 joint_cycle_day가 비어 있으면 두 사람 월급날 중 늦은 날(cycle_day)
    update public.couple_space set salary_mode = 'joint' where id = sid;
  else
    update public.salary_split set owner_user_id = starter.id where space_id = sid and owner_user_id is null;
    update public.pay_checklist set owner_user_id = starter.id where space_id = sid and owner_user_id is null;
    update public.couple_space set salary_mode = 'separate' where id = sid;
  end if;
  if starter.id is not null then
    perform public.notify(
      starter.id, sid, 'salary_mode',
      coalesce(me.nickname || '님이', '파트너가') || ' 월급 관리 방식을 바꿨어요',
      case when p_mode = 'joint' then '합쳐서 같이 관리해요' else '각자 월급을 따로 관리해요' end,
      '/salary/split', null, uid, 'join_mode:' || sid || ':' || uid || ':' || p_mode);
  end if;
end;
$$;
revoke all on function public.set_join_salary_mode(public.salary_mode) from public, anon;
grant execute on function public.set_join_salary_mode(public.salary_mode) to authenticated;

-- 첫 목표 알림(14). 최신 정의 20261110110000_wolgeup_plan_copy.sql
create or replace function public.notify_first_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting public.app_user;
begin
  if old.onboarding_done_at is null and new.onboarding_done_at is not null and new.space_id is not null then
    select * into waiting from public.app_user
      where space_id = new.space_id and id <> new.id and status = 'active' and onboarding_step = 'P-WAIT' limit 1;
    if waiting.id is not null then
      perform public.notify(
        waiting.id, new.space_id, 'first_goal',
        coalesce(new.nickname || '님이', '파트너가') || ' 첫 목표를 정했어요',
        '이어서 내 월급 계획을 만들어요', '/join/p-04', null, new.id, 'first_goal:' || new.space_id);
    end if;
  end if;
  return new;
end;
$$;

-- 월급 관리 방식 바꾸기(25 S-11f). 최신 정의 20261030120000_salary_mode_switch.sql
create or replace function public.set_salary_mode(p_mode public.salary_mode)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  sp public.couple_space;
  me public.app_user;
  other public.app_user;
  joint_id uuid;
  a_id uuid;
  b_id uuid;
  cd uuid; -- 기준일 사람(남는 차이를 받는 쪽)
  share numeric; -- 기준일이 아닌 사람 몫 비율
  l record;
  n integer := 0;
  na integer := 0;
  nb integer := 0;
  part bigint;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = sid for update;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if sp.salary_mode = p_mode then
    return;
  end if;
  select * into me from public.app_user where id = uid;
  select * into other from public.app_user where space_id = sid and id <> uid and status = 'active' limit 1;

  if p_mode = 'joint' then
    insert into public.salary_split (space_id, owner_user_id, updated_by) values (sid, null, uid) returning id into joint_id;
    -- 저금: 비상금 → 우리 목표 → 내 목표(우선순위), 같은 목표는 합침
    for l in
      select x.goal_id, sum(x.amount)::bigint as amount
      from public.split_line x join public.salary_split s on s.id = x.split_id
      join public.goal g on g.id = x.goal_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'saving'
      group by x.goal_id, g.template, g.owner_user_id, g.priority
      order by (g.template = 'emergency') desc, (g.owner_user_id is null) desc, g.priority
    loop
      insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (joint_id, sid, 'saving', l.goal_id, l.amount, n);
      n := n + 1;
    end loop;
    for l in
      select x.kind, sum(x.amount)::bigint as amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind in ('fixed', 'living')
      group by x.kind order by x.kind
    loop
      insert into public.split_line (split_id, space_id, kind, amount, sort) values (joint_id, sid, l.kind, l.amount, n);
      n := n + 1;
    end loop;
    for l in
      select x.kind, x.user_id, x.name, x.amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind in ('allowance', 'custom')
      order by x.kind, s.owner_user_id, x.sort
    loop
      insert into public.split_line (split_id, space_id, kind, user_id, name, amount, sort)
        values (joint_id, sid, l.kind, l.user_id, l.name, l.amount, n);
      n := n + 1;
    end loop;
    delete from public.salary_split where space_id = sid and owner_user_id is not null;
  else
    select id into joint_id from public.salary_split where space_id = sid and owner_user_id is null;
    if other.id is null then
      update public.salary_split set owner_user_id = uid where id = joint_id;
    elsif joint_id is not null then
      -- 기준일 사람 = 공동 기준일과 월급날이 같은 사람(없으면 시작한 사람)
      cd := coalesce(
        (select u.id from public.app_user u where u.space_id = sid and u.status = 'active'
           and (case when u.payday_last then 31 else u.payday end) = public.cycle_day(sid, null)
         order by (u.id = sp.created_by) desc limit 1),
        sp.created_by);
      share := case when coalesce(me.monthly_income, 0) + coalesce(other.monthly_income, 0) = 0 then 0.5
        else (case when cd = uid then coalesce(other.monthly_income, 0) else coalesce(me.monthly_income, 0) end)::numeric
             / (coalesce(me.monthly_income, 0) + coalesce(other.monthly_income, 0)) end;
      insert into public.salary_split (space_id, owner_user_id, updated_by) values (sid, cd, uid) returning id into a_id;
      insert into public.salary_split (space_id, owner_user_id, updated_by)
        values (sid, case when cd = uid then other.id else uid end, uid) returning id into b_id;
      for l in
        select x.*, g.owner_user_id as goal_owner from public.split_line x left join public.goal g on g.id = x.goal_id
        where x.split_id = joint_id order by x.sort
      loop
        if l.kind = 'allowance' and l.user_id is not null then
          if l.user_id = cd then
            insert into public.split_line (split_id, space_id, kind, user_id, amount, sort) values (a_id, sid, 'allowance', l.user_id, l.amount, na);
            na := na + 1;
          else
            insert into public.split_line (split_id, space_id, kind, user_id, amount, sort) values (b_id, sid, 'allowance', l.user_id, l.amount, nb);
            nb := nb + 1;
          end if;
        elsif l.kind = 'saving' and l.goal_owner is not null then
          if l.goal_owner = cd then
            insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (a_id, sid, 'saving', l.goal_id, l.amount, na);
            na := na + 1;
          else
            insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (b_id, sid, 'saving', l.goal_id, l.amount, nb);
            nb := nb + 1;
          end if;
        else
          part := (round(l.amount * share / 10000) * 10000)::bigint;
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort)
            values (a_id, sid, l.kind, l.goal_id, l.name, l.amount - part, na);
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort)
            values (b_id, sid, l.kind, l.goal_id, l.name, part, nb);
          na := na + 1;
          nb := nb + 1;
        end if;
      end loop;
      delete from public.salary_split where id = joint_id;
    end if;
  end if;
  update public.couple_space set salary_mode = p_mode where id = sid;
  if other.id is not null and sp.couple_state = 'connected' then
    perform public.notify(
      other.id, sid, 'salary_mode',
      coalesce(me.nickname || '님이', '파트너가') || ' 월급 관리 방식을 바꿨어요',
      case when p_mode = 'joint' then '합쳐서 같이 관리해요' else '각자 월급을 따로 관리해요' end,
      '/salary/split', null, uid, 'mode:' || sid || ':' || now()::text);
  end if;
end;
$$;
revoke all on function public.set_salary_mode(public.salary_mode) from public, anon;
grant execute on function public.set_salary_mode(public.salary_mode) to authenticated;

-- 앱 문의 사본 메일(help@, 운영자가 읽음 → 어드민 말 ‘커플 연결’). 최신 정의 20261111180000_email_inquiry.sql
create or replace function public.inquiry_copy_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.inquiry;
  first boolean;
  label text;
  link text;
  t text;
begin
  if new.author <> 'user' then
    return new;
  end if;
  select * into q from public.inquiry where id = new.inquiry_id;
  if q.id is null or q.channel <> 'app' then
    return new;
  end if;
  first := not exists (select 1 from public.inquiry_message m where m.inquiry_id = q.id and m.id <> new.id);
  label := case q.category
    when 'account' then '계정·로그인' when 'couple' then '커플 연결' when 'calc' then '목표·월급 체크리스트'
    when 'sync' then '동기화' when 'billing' then '결제·환불' when 'privacy' then '개인정보' else '기타' end;
  link := 'https://ops.sweetwo.kr/inquiries/' || q.id;
  t := concat_ws(E'\n', '앱에서 온 문의예요. 답변은 어드민에서 써 주세요.', '문의 번호: ' || q.no, '분류: ' || label,
    '', new.body, '', '어드민에서 보기: ' || link);
  insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe, headers)
  values (q.user_id, 'help@sweetwo.kr', 'inquiry_copy',
    '[' || q.no || '] ' || case when first then '앱 문의 사본' else '앱 문의 덧붙임' end,
    t,
    concat('<p>앱에서 온 문의예요. 답변은 어드민에서 써 주세요.</p><p>문의 번호: ', public.html_esc(q.no),
      '<br>분류: ', public.html_esc(label), '</p><p>', replace(public.html_esc(new.body), E'\n', '<br>'),
      '</p><p><a href="', link, '">어드민에서 보기</a></p>'),
    false, 'inquiry_copy:' || new.id, jsonb_build_object('X-Sweetwo-Copy', q.no))
  on conflict (dedupe) do nothing;
  update public.inquiry set mail_copied_at = now() where id = q.id;
  return new;
end;
$$;
