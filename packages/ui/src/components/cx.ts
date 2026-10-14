/** 클래스 이름 합치기 (false, null 무시) */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
