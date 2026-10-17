-- 공휴일(09 데이터 항목 64줄, 29 기술·운영 ‘holiday’). 앱은 읽기만, 쓰기는 서버 작업과 어드민(AD-19).
-- 특일 정보 API 받기(매년 12월 다음 해, 매주 1회 다시)는 API 키를 서버 비밀 값에 넣은 뒤 Edge Function으로 붙임.
-- 그 전까지 2026, 2027년은 여기서 넣음(source admin). 2026년부터 제헌절·노동절 공휴일, 2026-06-03 지방선거 임시공휴일.
-- 쓰임: 캘린더 공휴일 표시(빨간 숫자 + 이름), 설·추석 연휴 띠, 월급날이 주말·공휴일이면 직전 영업일로 앞당겨 표시.

create type public.holiday_kind as enum ('holiday', 'substitute', 'temporary');
create type public.holiday_source as enum ('api', 'admin');

create table public.holiday (
  date date primary key,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  kind public.holiday_kind not null default 'holiday',
  source public.holiday_source not null default 'admin',
  fetched_at timestamptz not null default now()
);
alter table public.holiday enable row level security;
create policy holiday_select on public.holiday for select to anon, authenticated using (true);
revoke insert, update, delete on public.holiday from anon, authenticated;

-- 월급날이 주말·공휴일이면 직전 영업일로 앞당겨 표시(S-11d, 기본 켜짐, 부부 공통). 기준일·사이클은 그대로
alter table public.couple_space add column holiday_shift boolean not null default true;

insert into public.holiday (date, name, kind) values
  ('2026-01-01', '신정', 'holiday'),
  ('2026-02-16', '설날 연휴', 'holiday'),
  ('2026-02-17', '설날', 'holiday'),
  ('2026-02-18', '설날 연휴', 'holiday'),
  ('2026-03-01', '삼일절', 'holiday'),
  ('2026-03-02', '대체공휴일(삼일절)', 'substitute'),
  ('2026-05-01', '노동절', 'holiday'),
  ('2026-05-05', '어린이날', 'holiday'),
  ('2026-05-24', '부처님오신날', 'holiday'),
  ('2026-05-25', '대체공휴일(부처님오신날)', 'substitute'),
  ('2026-06-03', '지방선거', 'temporary'),
  ('2026-06-06', '현충일', 'holiday'),
  ('2026-07-17', '제헌절', 'holiday'),
  ('2026-08-15', '광복절', 'holiday'),
  ('2026-08-17', '대체공휴일(광복절)', 'substitute'),
  ('2026-09-24', '추석 연휴', 'holiday'),
  ('2026-09-25', '추석', 'holiday'),
  ('2026-09-26', '추석 연휴', 'holiday'),
  ('2026-10-03', '개천절', 'holiday'),
  ('2026-10-05', '대체공휴일(개천절)', 'substitute'),
  ('2026-10-09', '한글날', 'holiday'),
  ('2026-12-25', '성탄절', 'holiday'),
  ('2027-01-01', '신정', 'holiday'),
  ('2027-02-06', '설날 연휴', 'holiday'),
  ('2027-02-07', '설날', 'holiday'),
  ('2027-02-08', '설날 연휴', 'holiday'),
  ('2027-02-09', '대체공휴일(설날)', 'substitute'),
  ('2027-03-01', '삼일절', 'holiday'),
  ('2027-05-01', '노동절', 'holiday'),
  ('2027-05-03', '대체공휴일(노동절)', 'substitute'),
  ('2027-05-05', '어린이날', 'holiday'),
  ('2027-05-13', '부처님오신날', 'holiday'),
  ('2027-06-06', '현충일', 'holiday'),
  ('2027-07-17', '제헌절', 'holiday'),
  ('2027-07-19', '대체공휴일(제헌절)', 'substitute'),
  ('2027-08-15', '광복절', 'holiday'),
  ('2027-08-16', '대체공휴일(광복절)', 'substitute'),
  ('2027-09-14', '추석 연휴', 'holiday'),
  ('2027-09-15', '추석', 'holiday'),
  ('2027-09-16', '추석 연휴', 'holiday'),
  ('2027-10-03', '개천절', 'holiday'),
  ('2027-10-04', '대체공휴일(개천절)', 'substitute'),
  ('2027-10-09', '한글날', 'holiday'),
  ('2027-10-11', '대체공휴일(한글날)', 'substitute'),
  ('2027-12-25', '성탄절', 'holiday'),
  ('2027-12-27', '대체공휴일(성탄절)', 'substitute');
