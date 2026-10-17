-- 대출 금리 ‘잘 모르겠어요’(17 O-46): 유형별 평균 금리(06 4장)를 넣고 ‘추정’ 표시
alter table public.asset add column rate_estimated boolean not null default false;
