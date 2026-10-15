// 앱 버전 비교(A-01 최소 지원 버전). 'x.y.z'만, 모르는 형식은 0으로 본다.
const parts = (v: string) =>
  (v.split('-')[0] ?? '').split('.').map((n) => (/^\d+$/.test(n) ? Number(n) : 0));

/** a < b면 음수, 같으면 0, a > b면 양수 */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export const isBelowMin = (current: string, min: string) => compareVersions(current, min) < 0;
