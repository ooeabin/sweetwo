// 알림을 눌러 간 화면 ID(분석 notification_opened landing_screen, 32 4-7). 서버 target 경로 → 기획서 화면 ID
const RULES: [RegExp, string][] = [
  [/^\/$/, 'H-01'],
  [/^\/notifications$/, 'N-02'],
  [/^\/salary\/review(?:\?|$)/, 'W-05'],
  [/^\/salary\/items\/[^/?]+\/achieved/, 'W-12'],
  [/^\/(?:salary\/items|goals)\/[^/?]+/, 'W-10'],
  [/^\/salary\/split\/new/, 'W-01b'],
  [/^\/salary\/split\/[^/?]+/, 'W-01c'],
  [/^\/salary\?(?:.*&)?view=plan/, 'W-01'],
  [/^\/salary(?:\/split)?(?:\?|$)/, 'W-02'],
  [/^\/assets\/[^/?]+\/matured/, 'F-04a'],
  [/^\/assets\/[^/?]+/, 'F-04'],
  [/^\/assets(?:\?|$)/, 'F-02'],
  [/^\/calendar\/day\//, 'Y-05'],
  [/^\/settings\/notifications/, 'S-14'],
  [/^\/settings\/me\/email/, 'S-11b'],
  [/^\/settings\/me\/salary/, 'S-11c'],
  [/^\/settings\/couple\/style\/request\//, 'S-11j'],
  [/^\/settings\/couple\/style/, 'S-11f'],
  [/^\/settings\/visibility\/preview/, 'S-13p'],
  [/^\/settings\/visibility/, 'S-13'],
  [/^\/settings\/couple\/unlink\/review/, 'S-12d'],
  [/^\/settings\/couple\/reconnect/, 'S-12g'],
  [/^\/settings\/couple\/unlinked/, 'S-12h'],
  [/^\/settings\/couple/, 'S-12'],
  [/^\/settings\/help\/access\//, 'S-19b'],
  [/^\/settings\/help\/inquiries\//, 'S-19a'],
  [/^\/settings\/help/, 'S-20'],
  [/^\/settings\/guides/, 'S-02'],
  [/^\/new-device\//, 'A-08'],
  [/^\/join\/p-04/, 'P-04'],
];

export function landingScreen(target: string): string {
  return RULES.find(([re]) => re.test(target))?.[1] ?? 'other';
}
