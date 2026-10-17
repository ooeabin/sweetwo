-- 생활비 신용카드 주사용(17 O-38b, 09 사용자 ‘신용카드 주사용 여부’). 네 → 생활비 실제에 ‘지난달 카드 사용분’ 라벨
alter table public.app_user add column card_main boolean;
grant update (card_main) on public.app_user to authenticated;
