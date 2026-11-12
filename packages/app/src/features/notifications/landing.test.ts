import { describe, expect, it } from 'vitest';
import { landingScreen } from './landing';

describe('알림 → 화면 ID(notification_opened landing_screen)', () => {
  it.each([
    ['/', 'H-01'],
    ['/salary', 'W-02'],
    ['/salary?who=u-1', 'W-02'],
    ['/salary?view=plan', 'W-01'],
    ['/salary/review?checklist=c-1', 'W-05'],
    ['/salary/items/g-1', 'W-10'],
    ['/salary/items/g-1/achieved', 'W-12'],
    ['/assets/a-1', 'F-04'],
    ['/assets/a-1/matured', 'F-04a'],
    ['/assets', 'F-02'],
    ['/calendar/day/c-1', 'Y-05'],
    ['/settings/me/email', 'S-11b'],
    ['/settings/couple/unlink/review', 'S-12d'],
    ['/settings/couple', 'S-12'],
    ['/settings/help', 'S-20'],
    ['/settings/help/access/r-1', 'S-19b'],
    ['/new-device/s-1', 'A-08'],
    ['/notifications', 'N-02'],
    ['/somewhere', 'other'],
  ])('%s → %s', (t, id) => expect(landingScreen(t)).toBe(id));
});
