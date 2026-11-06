-- O-11 세 번째 답 ‘아직 안 정했어요’(결혼 없이 같이 사는 사람, 결혼 미정). 추가만(스키마 규칙).
-- 결혼한 날·예정일(O-12)은 묻지 않고, 결혼 단계 계산에서는 빠짐(null).
alter type public.marriage_status add value if not exists 'undecided';
