-- pgTAP: 특일 API 공휴일 저장(어드민 날은 그대로, 빠진 API 날은 지움, 빈 응답이면 지우지 않음)
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

delete from public.holiday where extract(year from date) = 2030;
insert into public.holiday (date, name, kind, source) values
  ('2030-05-05', '어린이날(어드민)', 'holiday', 'admin'),
  ('2030-10-10', '옛 임시공휴일', 'temporary', 'api');

select is(public.save_api_holidays(
  '[{"date":"2030-01-01","name":"1월1일","kind":"holiday"},
    {"date":"2030-05-05","name":"어린이날","kind":"holiday"},
    {"date":"2030-05-06","name":"대체공휴일","kind":"substitute"}]'::jsonb, array[2030]), 2, '새 날 2개(어드민 날은 안 덮음)');
select results_eq($$ select date::text, name, source::text from public.holiday where extract(year from date) = 2030 order by date $$,
  $$ values ('2030-01-01', '1월1일', 'api'), ('2030-05-05', '어린이날(어드민)', 'admin'), ('2030-05-06', '대체공휴일', 'api') $$,
  '어드민 날은 그대로, API가 빼면 지움');
select is(public.save_api_holidays('[]'::jsonb, array[2030]), 0, '빈 응답');
select is((select count(*)::int from public.holiday where extract(year from date) = 2030), 3, '빈 응답이면 지우지 않음');

select * from finish();
rollback;
