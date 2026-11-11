/** S-10·S-12 미합류 상태 이름(S3-18: 만료돼도 ‘초대 중’이던 것) */
export function inviteStateOf(
  inv: { usedAt: string | null; expiresAt: string; reservedUntil: string | null } | null,
): 'before' | 'inviting' | 'joining' | 'expired' {
  if (!inv) return 'before';
  if (!inv.usedAt && inv.reservedUntil) return 'joining';
  return new Date(inv.expiresAt).getTime() > Date.now() ? 'inviting' : 'expired';
}
