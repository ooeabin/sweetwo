import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding, mockV22Settings } from './mocks';
import { setWheel } from './wheel';

// 설정(docs/spec/25-settings.md S-10, S-11, S-11a, S-14, S-14a). 찬우(시작, 25일)와 합류한 예빈(10일), 웹

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-09-20T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'connected',
    salary_mode: 'separate',
    joint_cycle_day: null,
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 2_500_000,
    fixed_total: 1_000_000,
    living_budget: 550_000,
    loan_repayment: 300_000,
    split_mode: 'half',
    account_mode: 'roles',
    base_day: 25,
    base_day_last: false,
  };
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_500_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
  };
  db.assets.push({
    id: 'a-sav',
    side: 'asset',
    grp: 'deposit',
    kind: 'saving',
    name: '청년 적금',
    amount: 3_000_000,
    principal: null,
    maturity_date: '2026-10-30',
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  });
  db.incomeEvents.push({
    id: 'ev',
    owner_user_id: db.me.id,
    name: '상여금',
    amount: 2_000_000,
    month: 11,
    yearly: true,
    created_at: '2026-09-21T00:00:00Z',
    deleted_at: null,
  });
}

// 좁은 창은 홈 머리 ☰ 메뉴 서랍 ‘설정’(2026-11-09 머리 톱니 없앰), 넓은 창은 사이드바 아바타 줄
const open = async (page: Page, narrow: boolean) => {
  if (narrow) {
    await page.goto('/');
    await expect(page.locator('.hg-together, .hg-hub .hg-card--fill').first()).toBeVisible();
    await page.getByRole('button', { name: '메뉴', exact: true }).click();
    await page
      .getByRole('dialog', { name: '메뉴' })
      .getByRole('button', { name: '설정', exact: true })
      .click();
  } else {
    await page.goto('/calendar/list');
    await page
      .locator('.hg-appside')
      .getByRole('button', { name: '설정 열기', exact: true })
      .click();
  }
  await expect(page).toHaveURL(/\/settings$/);
};

test('설정 홈(S-10) → 내 정보(S-11): 이름, 알림 이메일, 결혼·출생연도, 월급 묶음, 앞당기기, 로그아웃', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { split_mode: 'income', holiday_shift: true });
  db.me.notify_email = 'chanwoo@example.com';
  await open(page, info.project.name === 'narrow');

  const me = page.getByRole('button', { name: /찬우와 예빈/ });
  await expect(me).toContainText('카카오로 로그인했어요');
  await expect(page.locator('main').getByRole('button', { name: /^알림/ })).toContainText(
    '푸시 알림 켜짐',
  );
  await expect(page.getByText('예빈님과 연결됨')).toBeVisible();
  await axe(page);
  await me.click();

  await expect(page).toHaveURL(/\/settings\/me$/);
  await expect(page.getByRole('button', { name: /이름/ })).toContainText('찬우');
  await expect(page.getByRole('button', { name: /결혼 상태/ })).toContainText('했어요');
  // 내 월급 + 예빈 값 보기만, 관리 방식(각자면 체크리스트 만드는 날 없음)
  const salary = page.getByRole('button', { name: /내 월급/ });
  await expect(salary).toContainText('350만 원, 25일');
  await expect(salary).toContainText('예빈 250만 원, 10일');
  await expect(page.getByRole('button', { name: /월급 관리 방식/ })).toContainText(
    '각자 따로 해요',
  );
  await expect(page.getByRole('button', { name: /체크리스트 만드는 날/ })).toHaveCount(0);
  // 알림 이메일(S-11b, 2026-11-04 줄 → 화면): 형식 오류면 저장 안 됨
  await page.getByRole('button', { name: /알림 이메일/ }).click();
  await expect(page).toHaveURL(/\/settings\/me\/email$/);
  await expect(page.getByRole('heading', { name: '알림 받을 이메일을 알려 주세요' })).toBeVisible();
  const email = page.getByLabel('알림 이메일');
  await email.fill('chanwoo@');
  await expect(page.getByText('이메일 주소를 다시 확인해 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await email.fill(' New@Example.com ');
  await page.getByRole('button', { name: '저장' }).click();
  await expect.poll(() => db.me.notify_email).toBe('new@example.com');
  await expect(page).toHaveURL(/\/settings\/me$/);
  await expect(page.getByRole('button', { name: /알림 이메일/ })).toContainText('new@example.com');
  await expect(page.getByRole('button', { name: '월급 계획 열기' })).toBeVisible();
  // 앞당기기 끄기(두 사람 공통)
  const shift = page.getByRole('switch', { name: '월급날이 쉬는 날이면 앞당겨 보여줘요' });
  await expect(shift).toHaveAttribute('aria-checked', 'true');
  await shift.click();
  await expect.poll(() => db.space?.holiday_shift).toBe(false);
  await axe(page);

  // 이름(S-11a)
  await page.getByRole('button', { name: /이름/ }).click();
  await expect(page.getByRole('heading', { name: '내 이름이나 애칭을 알려 주세요' })).toBeVisible();
  await page.getByLabel('이름').fill('찬우씨');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.me.nickname).toBe('찬우씨');

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('알림 설정(S-14, S-14a): 푸시 하나, 묶음 토글, 경조사 체크 목록, 푸시 끄면 줄도 꺼짐, 방해 금지 시간', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await open(page, info.project.name === 'narrow');
  await page.locator('main').getByRole('button', { name: /^알림/ }).click();

  await expect(page).toHaveURL(/\/settings\/notifications$/);
  // 2026-11-04 이메일은 자동 예비로만: 이메일 설정 없음
  await expect(page.getByText('이메일은 한 달에 6번까지만 보내요')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: '이메일' })).toHaveCount(0);
  const card = page.getByRole('region', { name: '알림 종류' });
  const d14 = card
    .getByRole('group', { name: '경조사 미리 알림' })
    .getByRole('checkbox', { name: '14일 전' });
  await expect(d14).toHaveAttribute('aria-checked', 'false');
  await d14.click();
  await expect
    .poll(
      () =>
        (db.me.noti_prefs as { topics?: { care_14?: { push?: boolean } } })?.topics?.care_14?.push,
    )
    .toBe(true);
  // v2.2: P-11과 같은 종류 목록(push_kinds). 각자 계열이면 ‘같이 쓰는 걸 바꿨을 때’ 없음, 손 줄이 없으면 월급날 줄 없음
  await expect(card.getByRole('switch', { name: '경조사가 다가올 때' })).toBeVisible();
  await expect(card.getByRole('switch', { name: '진행 소식' })).toBeVisible();
  await expect(card.getByRole('switch', { name: /같이 쓰는 걸 바꿨을 때/ })).toHaveCount(0);
  await expect(card.getByRole('switch', { name: '월급날 확인할 게 있을 때' })).toHaveCount(0);
  await expect(card).toContainText('잠금 화면에서는 금액을 늘 가려요');
  await card.getByRole('switch', { name: '진행 소식' }).click();
  await expect
    .poll(() => (db.me.push_kinds as Record<string, boolean> | undefined)?.progress_news)
    .toBe(false);
  await expect(page.getByText('계정 보안처럼 꼭 알아야 할 안내는 이메일로도 보내요')).toBeVisible();
  await expect(page.getByText('제안')).toHaveCount(0);
  await axe(page);

  // 푸시를 끄면 확인 없이 끄고, 아래 줄도 꺼짐
  await page
    .getByRole('region', { name: '푸시 알림' })
    .getByRole('switch', { name: /푸시 알림/ })
    .click();
  await expect.poll(() => (db.me.noti_prefs as { push?: boolean })?.push).toBe(false);
  await expect(page.getByText('알림 센터에서만 볼 수 있어요')).toBeVisible();
  await expect(d14).toBeDisabled();

  // 방해 금지 시간
  await expect(page.getByRole('button', { name: /방해 금지 시간/ })).toContainText(
    '밤 10시 ~ 아침 8시',
  );
  await page.getByRole('button', { name: /방해 금지 시간/ }).click();
  await expect(
    page.getByRole('heading', { name: '알림을 받지 않을 시간을 정해 주세요' }),
  ).toBeVisible();
  // 시작·끝 휠(2026-11-03 기본 드롭다운 대신)
  const start = page.getByRole('spinbutton', { name: '시작' });
  await expect(start).toHaveAttribute('aria-valuetext', '밤 10시');
  await start.focus();
  await start.press('ArrowDown');
  await expect(start).toHaveAttribute('aria-valuenow', '23');
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/notifications$/);
  // 마케팅 정보 받기(기본 꺼짐) → 켜면 동의 기록 + “{날짜} 동의”
  const mk = page.getByRole('switch', { name: '마케팅 정보 받기' });
  await expect(mk).toHaveAttribute('aria-checked', 'false');
  await mk.click();
  await expect(mk).toHaveAttribute('aria-checked', 'true');
  expect(db.consents.at(-1)).toMatchObject({ kind: 'marketing', agreed: true, source: 'settings' });
  await expect(page.getByText(/동의$/)).toBeVisible();
  expect(db.me).toMatchObject({ quiet_start: 23 });
});

test('월급(S-11c 언제부터), 관리 형태(S-11f 세 질문 → 요청), 체크리스트 만드는 날(S-11d), 결혼 상태·날짜(S-11g·h), 출생연도(S-11i)', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const v = await mockV22Settings(page, db, NOW);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /찬우와 예빈/ }).click();

  // 내 월급
  await page.getByRole('button', { name: /내 월급/ }).click();
  await expect(page.getByRole('heading', { name: '한 달 실수령액은 얼마예요?' })).toBeVisible();
  await page.getByLabel('한 달 실수령액은 얼마예요?').fill('3800000');
  await axe(page);
  // 금액이 바뀌면 “언제부터 이 금액이에요?”(v2.2 S-11c). 이번 달(10월)부터면 월급날(25일) 전이어도 바로 적용
  // (2026-11-13 P2 = A, 07 5장)
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '언제부터 이 금액이에요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('월급을 바꿨어요')).toBeVisible();
  expect(db.me.monthly_income).toBe(3_800_000);
  expect(v.calls.find((c) => c.fn === 'schedule_salary_change')?.body).toMatchObject({
    p_amount: 3_800_000,
    p_from: '2026-10-01',
  });
  await expect(page.getByText(/2026년 10월부터 380만 원/)).toHaveCount(0);

  // 관리 형태(S-11f): 세 질문, 각자 → 합쳐서는 예빈 ‘좋아요’가 필요(요청)
  await expect(page.getByRole('button', { name: /월급 관리 방식/ })).toContainText(
    '각자 따로 해요',
  );
  await page.getByRole('button', { name: /월급 관리 방식/ }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/style$/);
  await expect(page.getByRole('heading', { name: '같이 쓰는 생활비가 있어요?' })).toBeVisible();
  await page.getByRole('radio', { name: '네' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '같이 모으는 저금이 있어요?' })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '누가 주로 관리해요?' })).toBeVisible();
  await page.getByRole('radio', { name: '둘이 같이 해요' }).click();
  await expect(page.getByText('예빈님이 ‘좋아요’를 누르면 바뀌어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  // 앞 Toast(월급 변경)가 끝난 뒤에 보일 수 있어 넉넉히
  await expect(page.getByText('예빈님에게 물어봤어요')).toBeVisible({ timeout: 15_000 });
  expect(v.modeRequests[0]).toMatchObject({
    status: 'open',
    to_mode: 'joint',
    phrase: 's11f_combine',
  });
  expect(db.space?.salary_mode).toBe('separate');
  // 예빈이 ‘좋아요’ 했다고 치고 합쳐서로(아래 체크리스트 만드는 날)
  Object.assign(db.space ?? {}, {
    salary_mode: 'joint',
    shared_living: true,
    manager_user_id: null,
  });
  await page.reload();

  // 체크리스트 만드는 날(합쳐서 + 합류): 늦은 월급날이 기본
  await page.goto('/settings/me');
  await expect(page.getByRole('button', { name: /체크리스트 만드는 날/ })).toContainText(
    '늦은 월급날',
  );
  await page.getByRole('button', { name: /체크리스트 만드는 날/ }).click();
  await expect(page.getByRole('heading', { name: '체크리스트를 언제 만들까요?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '찬우 월급날 25일' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: '예빈 월급날 10일' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.space?.joint_cycle_day).toBe(10);

  // 결혼 상태 준비 중 → 예정일
  await page.getByRole('button', { name: /결혼 상태/ }).click();
  await page.getByRole('radio', { name: '결혼 준비 중이에요' }).click();
  await expect(page.getByRole('heading', { name: '결혼 예정일은 언제예요?' })).toBeVisible();
  await setWheel(page, '결혼 예정일은 언제예요?', 2027, 5, 15);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.space).toMatchObject({ marriage_status: 'engaged', wedding_date: '2027-05-15' });
  await expect(page.getByRole('button', { name: /결혼 예정일/ })).toContainText('2027년 5월 15일');

  // 출생연도
  await page.getByRole('button', { name: /출생연도/ }).click();
  await setWheel(page, '찬우님은 몇 년생이에요?', 1993);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.me.birth_year).toBe(1993);
});

test('우리 둘 정보(S-12): 연결됨 예비부부 결혼 예정일 D-day', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { marriage_status: 'engaged', wedding_date: '2027-01-09' });
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /우리 둘 정보/ }).click();
  await expect(page).toHaveURL(/\/settings\/couple$/);
  await expect(page.getByText('찬우 예빈')).toBeVisible();
  await expect(page.getByText('연결됨', { exact: true })).toBeVisible();
  await expect(page.getByText('결혼 예정일')).toBeVisible();
  await expect(page.getByText('2027년 1월 9일')).toBeVisible();
  await expect(page.getByText('D-94')).toBeVisible();
  await expect(page.getByText('초대 코드')).toHaveCount(0);
  await axe(page);
});

test('우리 둘 정보(S-12): 미합류 초대하기(코드 상자, 링크 복사, 카톡), 새 코드 받기, 만료', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'not_joined' });
  db.partner = null;
  await open(page, info.project.name === 'narrow');
  // 미합류 상태 나눔(S3-18): 코드가 없으면 ‘초대 전’
  await expect(page.getByRole('button', { name: /우리 둘 정보/ })).toContainText('초대 전');
  await page.getByRole('button', { name: /우리 둘 정보/ }).click();

  // 초대 전: 기획 문장 그대로 + ‘초대하기’ = 바로 코드 상자(D6, D9)
  await expect(page.getByText('함께할 사람을 초대해 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '받은 초대 코드가 있어요' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '초대하기' }).click();
  const box = page.getByRole('button', { name: /초대 코드 K 7 M 2 Q X/ });
  await expect(box).toContainText('K7M2QX');
  await expect(page.getByText('10월 22일까지')).toBeVisible();
  await expect(page.getByRole('button', { name: '링크 복사' })).toBeVisible();
  await expect(page.getByRole('button', { name: '카톡으로 보내기' })).toBeVisible();
  await axe(page);

  // 새 코드 받기: 이전 코드는 바로 만료
  await page.getByRole('button', { name: '새 코드 받기' }).click();
  await expect(page.getByText('새 코드를 받았어요. 이전 코드는 이제 못 써요')).toBeVisible();
  await expect(page.getByRole('button', { name: /초대 코드 K 7 M/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /초대 코드 R 1 N E W X/ })).toBeVisible();
  expect(db.invites.map((i) => i.code)).toEqual(['R1NEWX', 'K7M2QX']);
  expect(db.invites[1]?.expires_at).toBe('2026-10-01T00:00:00Z');

  // 만료
  const last = db.invites[0];
  if (last) last.expires_at = '2026-10-05T00:00:00Z';
  await page.reload();
  await expect(page.getByText('초대가 만료됐어요')).toBeVisible();
  await page.getByRole('button', { name: '새 코드 받기' }).click();
  await expect(page.getByText('초대가 만료됐어요')).toHaveCount(0);
  await expect(page.getByText('10월 22일까지')).toBeVisible();
  await axe(page);
});

test('우리 둘 정보(S-12): 합류하는 중 → 초대 취소(확인 Modal), 받은 코드 입구(D1, D4)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'not_joined' });
  db.partner = null;
  db.invites.push({
    code: 'K7M2QX',
    expires_at: '2026-10-22T00:00:00Z',
    used_at: null,
    reserved_by: 'yebin',
    reserved_until: '2026-10-09T00:00:00Z',
  });
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /우리 둘 정보/ })).toContainText('합류하는 중');
  await page.goto('/settings/couple');
  await expect(page.getByText('파트너가 합류하는 중이에요')).toBeVisible();
  // 합류하는 중에는 코드 상자도, 받은 코드 입구도 없음
  await expect(page.getByRole('button', { name: /초대 코드 K/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '받은 초대 코드가 있어요' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '초대 취소' }).click();
  const dialog = page.getByRole('alertdialog', { name: '초대를 취소할까요?' });
  await expect(dialog).toContainText('지금 코드는 더 못 써요');
  await axe(page);
  await dialog.getByRole('button', { name: '취소할게요' }).click();
  await expect(page.getByText('초대를 취소했어요')).toBeVisible();
  await expect(page.getByText('초대가 만료됐어요')).toBeVisible();
  expect(db.invites[0]?.reserved_by).toBeNull();

  // 받은 코드가 있어요 → P-01 코드 입력, 뒤로 = S-12
  await page.getByRole('button', { name: '받은 초대 코드가 있어요' }).click();
  await expect(page).toHaveURL(/\/i$/);
  await expect(page.getByRole('heading', { name: '받은 초대 코드를 넣어 주세요' })).toBeVisible();
  await page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/couple$/);
});

test('연결 해제 요청(S-12a·c): 지워지는 것, “연결 해제” 입력, 대기(월급 계획 멈춤), 요청 취소', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /우리 둘 정보/ }).click();
  await page.getByRole('button', { name: '연결 해제' }).click();

  // S-12a 안내(v2.2): 남는 것 / 지워지는 것, 30일 복구 안내 없음
  await expect(page.getByRole('heading', { name: '연결을 해제할까요?' })).toBeVisible();
  await expect(page.getByText('내 명의 자산과 대출, 내 저금과 저금 내역')).toBeVisible();
  await expect(page.getByText('같이 쓰던 월급 계획과 저금, 공동 명의, 경조사')).toBeVisible();
  await expect(page.getByText('예빈님이 확인하거나 14일이 지나면 해제돼요')).toBeVisible();
  await expect(page.getByText(/30일 안에는 다시 연결/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '먼저 내보내기' })).toBeVisible();
  // 먼저 내보내기 → S-18, 뒤로 = 이 화면(S3-07)
  await page.getByRole('button', { name: '먼저 내보내기' }).click();
  await expect(page).toHaveURL(/\/settings\/data$/);
  await page
    .getByRole('button', { name: /연결 해제|뒤로/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/couple\/unlink$/);
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  // S-12c 입력 후 요청
  const send = page.getByRole('button', { name: '연결 해제 요청하기' });
  await expect(
    page.getByRole('heading', { name: '확인을 위해 ‘연결 해제’라고 적어 주세요' }),
  ).toBeVisible();
  await expect(send).toBeDisabled();
  await page.getByLabel('연결 해제').fill('연결해제');
  await expect(send).toBeDisabled();
  await page.getByLabel('연결 해제').fill('연결 해제');
  await axe(page);
  await send.click();
  await expect(page.getByText('예빈님에게 연결 해제를 요청했어요')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/couple$/);
  // 요청한 사람 제목은 “연결 해제 대기 중”(2026-11-12 QA 11구간 D3)
  await expect(page.getByRole('strong').filter({ hasText: /^연결 해제 대기 중$/ })).toBeVisible();
  await expect(page.getByText('예빈님이 확인하거나 10월 21일이 되면 해제돼요')).toBeVisible();
  await expect(page.getByText('해제 전까지 월급 계획을 고칠 수 없어요')).toBeVisible();
  await axe(page);

  // 요청 취소 → 연결
  await page.getByRole('button', { name: '요청 취소' }).click();
  await expect(page.getByText('연결 해제 요청을 취소했어요')).toBeVisible();
  await expect(page.getByText('연결됨', { exact: true })).toBeVisible();
  expect(db.unlinks[0]?.status).toBe('cancelled');
});

test('연결 해제 요청 받음(S-12, S-12d) → 해제할게요 → 해제 안내(S-12h) → 시작하기(O-30)', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 합쳐서 엔진: 해제하면 같이 쓰던 월급 계획·저금이 모두 지워져 S-12h ‘시작하기’ = O-30(각자 엔진은 main-loop.spec)
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending', salary_mode: 'joint' });
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-1',
    requested_by: 'yebin',
    requested_at: '2026-10-05T01:00:00Z',
    deadline: '2026-10-19',
    ratio: 50,
    plan: [],
    status: 'pending',
    cancelled_at: null,
    confirmed_at: null,
  });
  await open(page, info.project.name === 'narrow');
  await expect(page.getByRole('button', { name: /우리 둘 정보/ })).toContainText(
    '연결 해제 대기 중',
  );
  await page.getByRole('button', { name: /우리 둘 정보/ }).click();
  await expect(page.getByText('예빈님이 연결 해제를 요청했어요')).toBeVisible();
  // 받은 사람에게는 날짜만(S3-03: “예빈님이 확인하거나 …”이던 것)
  await expect(page.getByText('10월 19일에 해제돼요')).toBeVisible();
  await expect(page.getByText(/확인하거나/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '요청 취소' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(
    page.getByRole('heading', { name: '예빈님이 연결 해제를 요청했어요' }),
  ).toBeVisible();
  await expect(page.getByText('10월 19일에 해제돼요')).toBeVisible();
  await expect(page.getByText('내 명의 자산과 대출, 내 저금과 저금 내역')).toBeVisible();
  await expect(page.getByRole('button', { name: '다르게 정리하기' })).toHaveCount(0);
  // v2.2(R-09): 주 버튼 ‘먼저 내보내기’, 보조 ‘해제할게요’
  await expect(page.getByRole('button', { name: '먼저 내보내기' })).toBeVisible();
  await axe(page);

  await page.getByRole('button', { name: '해제할게요' }).click();
  const dialog = page.getByRole('alertdialog', { name: '지금 연결을 해제할까요?' });
  await expect(dialog).toContainText('10월 19일을 기다리지 않고 바로 해제돼요');
  await axe(page);
  await dialog.getByRole('button', { name: '다시 생각할게요' }).click();
  expect(db.unlinks[0]?.status).toBe('pending');
  await page.getByRole('button', { name: '해제할게요' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '해제할게요' }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/unlinked$/);
  await expect(page.getByRole('heading', { name: '연결이 해제됐어요' })).toBeVisible();
  await expect(
    page.getByText('같이 쓰던 것만 지웠어요. 내 저금과 자산은 그대로예요'),
  ).toBeVisible();
  await expect(page.getByText(/30일 안에/)).toHaveCount(0);
  await expect(page.getByText('설정 › 우리 둘 정보에서 다시 연결할 수 있어요')).toBeVisible();
  expect(db.unlinks[0]?.status).toBe('confirmed');
  expect(db.goals).toHaveLength(0);
  await axe(page);
  // 내 월급 계획이 남지 않았으면(합쳐서 엔진은 같이 쓰던 것을 모두 지움) 온보딩 O-30부터
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page).toHaveURL(/\/onboarding\/o-30$/);
});

const soloAfterUnlink = (db: MemDb, reconnectBy: string | null = null) => {
  Object.assign(db.space ?? {}, { couple_state: 'solo', partner_nickname: null });
  db.partner = null;
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-old',
    requested_by: db.me.id,
    partner_id: 'yebin',
    requested_at: '2026-09-20T01:00:00Z',
    deadline: '2026-10-04',
    ratio: 50,
    plan: [],
    status: 'confirmed',
    how: 'agreed',
    confirmed_at: '2026-10-01T01:00:00Z',
    reconnect_until: '2026-10-31T01:00:00Z',
    reconnect_by: reconnectBy,
    reconnect_answer: null,
  });
};

test('혼자 쓰기(S-12): 다시 연결하기(복구 없는 새 요청, 7일 1번), 새로 초대하기', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  soloAfterUnlink(db);
  const v = await mockV22Settings(page, db, NOW);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /우리 둘 정보/ }).click();
  await expect(page.getByText('혼자 쓰는 중')).toBeVisible();
  await expect(page.getByText(/까지 다시 연결할 수 있어요/)).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '다시 연결하기' }).click();
  await expect(page.getByText('예빈님에게 다시 연결하자고 했어요')).toBeVisible();
  await expect(page.getByText('예빈님 답을 기다리고 있어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 연결하기' })).toHaveCount(0);
  expect(v.reconnects[0]).toMatchObject({ from_user: db.me.id, status: 'open' });
  // 예빈이 ‘괜찮아요’ 한 뒤 7일 안에 다시 보내면 막힘
  Object.assign(v.reconnects[0] ?? {}, { status: 'declined' });
  await page.reload();
  await page.getByRole('button', { name: '다시 연결하기' }).click();
  await expect(page.getByText('다시 연결 요청은 7일에 한 번 보낼 수 있어요')).toBeVisible();

  await page.getByRole('button', { name: '새로 초대하기' }).click();
  await expect(page.getByText('함께할 사람을 초대해 주세요')).toBeVisible();
  expect(db.space?.couple_state).toBe('not_joined');
  await axe(page);
});

test('다시 연결 요청 받음(S-12 → S-12g): 연결할게요 → 합류 흐름, 다시 받지 않을게요', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  soloAfterUnlink(db);
  const v = await mockV22Settings(page, db, NOW);
  const ask = () =>
    v.reconnects.push({
      id: `rc-${v.reconnects.length + 1}`,
      from_user: 'yebin',
      to_user: db.me.id,
      created_at: '2026-10-06T01:00:00Z',
      status: 'open',
      blocked: false,
      answered_at: null,
      invite_code: null,
    });
  ask();
  // 홈 띠 2번(19): 받은 열린 요청(reconnect_request)을 봄(옛 couple_unlink.reconnect_by는 비어 있음)
  await page.goto('/');
  await expect(page.locator('.hg-hubband')).toContainText('예빈님이 다시 연결하자고 했어요');
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /우리 둘 정보/ }).click();
  await expect(page.getByText('예빈님이 다시 연결하자고 해요')).toBeVisible();
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/reconnect$/);
  await expect(page.getByRole('heading', { name: '예빈님이 다시 연결하자고 해요' })).toBeVisible();
  await expect(page.getByText('연결하면 새로 같이 시작해요')).toBeVisible();
  // 복구 안내 없음(D10)
  await expect(page.getByText(/돌아와요|되살/)).toHaveCount(0);
  await axe(page);
  // 다시 받지 않을게요 → 그 뒤 요청은 조용히 거절
  await page.getByRole('button', { name: '다시 받지 않을게요' }).click();
  await expect(page).toHaveURL(/\/settings\/couple$/);
  expect(v.reconnects[0]).toMatchObject({ status: 'declined', blocked: true });
  // 다시 요청이 오면 ‘연결할게요’ → 받은 초대 코드로 합류 흐름
  ask();
  await page.goto('/settings/couple/reconnect');
  await expect(page.getByRole('heading', { name: '예빈님이 다시 연결하자고 해요' })).toBeVisible();
  await page.getByRole('button', { name: '연결할게요' }).click();
  await expect(page).toHaveURL(/\/(i\/K7M2QX|join\/)/);
  expect(v.reconnects[1]).toMatchObject({ status: 'accepted' });
});

const myStock = (db: MemDb, extra: Record<string, unknown> = {}) =>
  db.assets.push({
    id: 'a-stock',
    side: 'asset',
    grp: 'invest',
    kind: 'stock',
    name: '찬우 주식',
    amount: 2_000_000,
    principal: null,
    maturity_date: null,
    owner: 'person',
    owner_user_id: db.me.id,
    visibility: 'sum',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
    ...extra,
  });

test('공개 범위(S-13 한 목록): 내 월급 계획 단계, 새 항목 기본값, 이미 있는 항목도 바꾸기, 항목별, 순위 같이 보기', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db);
  const v = await mockV22Settings(page, db, NOW);
  (db.me as Record<string, unknown>).asset_share_default = 'sum';
  await open(page, info.project.name === 'narrow');
  const row = page.getByRole('button', { name: /공개 범위/ });
  await expect(row).toContainText('저금만 보여 주기');
  await row.click();
  await expect(page).toHaveURL(/\/settings\/visibility$/);
  await expect(page.getByRole('button', { name: '예빈님에게 보이는 모습 보기 ›' })).toBeVisible();
  // 저금마다 공개는 없앰
  await expect(page.getByText('개인 저금')).toHaveCount(0);
  await axe(page);

  // ① 내 월급 계획: 했어요만으로 좁힘
  await page.getByRole('button', { name: /^내 월급 계획/ }).click();
  await page
    .getByRole('dialog', { name: '내 월급 계획' })
    .getByRole('radio', { name: '했어요만 보여 주기' })
    .click();
  await expect.poll(() => (db.me as Record<string, unknown>).plan_share).toBe('done_only');

  // ③ 새 항목 기본값: 줄 + 시트(2026-11-03 기본 드롭다운 대신)
  await page.getByRole('button', { name: /^새 항목 기본값/ }).click();
  await page
    .getByRole('dialog', { name: '새 항목 기본값' })
    .getByRole('radio', { name: '숨기기' })
    .click();
  await expect(page.getByText('이미 있는 항목 1개도 바꿀까요?')).toBeVisible();
  await page.getByRole('button', { name: '모두 바꾸기' }).click();
  await expect.poll(() => (db.me as Record<string, unknown>).asset_share_default).toBe('private');
  await expect.poll(() => db.assets.find((a) => a.id === 'a-stock')?.visibility).toBe('private');

  await page.getByRole('button', { name: /찬우 주식/ }).click();
  await page
    .getByRole('dialog', { name: '찬우 주식 공개 범위' })
    .getByRole('radio', { name: '모두 보여 주기' })
    .click();
  await expect.poll(() => db.assets.find((a) => a.id === 'a-stock')?.visibility).toBe('all');

  await axe(page);
  // ④ 자산 순위 같이 보기: 켜져 있으면 끄기는 바로, 켜기는 F-08c(동의 보내기)로
  (db.me as Record<string, unknown>).rank_consent = true;
  await page.reload();
  await page.getByRole('switch', { name: '자산 순위 같이 보기' }).click();
  await expect.poll(() => v.calls.some((c) => c.fn === 'set_rank_consent')).toBe(true);
  await page.getByRole('switch', { name: '자산 순위 같이 보기' }).click();
  await expect(page).toHaveURL(/\/assets\/rank\/consent$/);
});

test('휴지통(S-21): 되살리기(연결된 두 사람 저금 항목도 바로), 영구 삭제', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db, { deleted_at: '2026-10-03T01:00:00Z' });
  db.assets.push({
    id: 'a-old',
    side: 'debt',
    grp: 'loan',
    kind: 'credit',
    name: '옛 대출',
    amount: 1_000_000,
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-08-01T00:00:00Z',
    deleted_at: '2026-10-01T01:00:00Z',
  });
  db.goals.push({
    id: 'g-trip',
    space_id: 'space-1',
    template: 'travel',
    name: '여행',
    kind: 'once',
    priority: 2,
    status: 'active',
    target_amount: 3_000_000,
    deleted_at: '2026-10-05T01:00:00Z',
    unlinked: true,
  });
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /데이터/ }).click();
  await expect(page).toHaveURL(/\/settings\/data$/);
  await page.getByRole('button', { name: /휴지통/ }).click();
  await expect(page).toHaveURL(/\/settings\/trash$/);
  await expect(page.getByText('지운 항목은 30일 뒤 완전히 지워져요')).toBeVisible();
  await expect(page.getByText('10월 3일에 지웠어요')).toBeVisible();
  await expect(page.getByText('26일 남음')).toBeVisible();
  await axe(page);

  const rowOf = (name: string) => page.locator('.hg-listrow').filter({ hasText: name });
  await rowOf('찬우 주식').getByRole('button', { name: '되살리기' }).click();
  await expect(page.getByText('되살렸어요')).toBeVisible();
  await expect.poll(() => db.assets.find((a) => a.id === 'a-stock')?.deleted_at).toBeNull();

  await rowOf('여행').getByRole('button', { name: '되살리기' }).click();
  await expect.poll(() => db.goals.find((g) => g.id === 'g-trip')?.deleted_at).toBeNull();
  // 넣을 월급 계획이 없으면 연결 없이 되살리고 안내(25 S-21 3번, S11-10)
  await expect(page.getByText('연결된 항목이 없어 따로 되살렸어요')).toBeVisible();

  // 오프라인: 영구 삭제·비우기 비활성(S11-10)
  await page.context().setOffline(true);
  await expect(page.getByRole('button', { name: '휴지통 비우기' })).toBeDisabled();
  await expect(rowOf('옛 대출').getByRole('button', { name: '옛 대출 더보기' })).toBeDisabled();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  await page.context().setOffline(false);

  await rowOf('옛 대출').getByRole('button', { name: '옛 대출 더보기' }).click();
  await page.getByRole('menuitem', { name: '영구 삭제' }).click();
  await expect(page.getByRole('alertdialog', { name: '완전히 지울까요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '지울게요' }).click();
  await expect(page.getByText('완전히 지웠어요')).toBeVisible();
  expect(db.assets.some((a) => a.id === 'a-old')).toBe(false);
});

test('데이터(S-18): 내보내기 zip, 사용 기록 보내기, 휴지통 개수', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db, { visibility: 'all' });
  await page.goto('/settings/data');
  await expect(page.getByRole('button', { name: /휴지통/ })).toContainText('0개');
  await expect(page.getByText(/사진은 내보내기에 들어가지 않아요/)).toBeVisible();
  await axe(page);
  const toggle = page.getByRole('switch', { name: '사용 기록 보내기' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect.poll(() => db.me.analytics_off).toBe(true);

  // 웹 본인 확인(다시 로그인) 뒤 돌아온 것처럼 ?export=mine
  const dl = page.waitForEvent('download');
  await page.goto('/settings/data?export=mine');
  const file = await dl;
  expect(file.suggestedFilename()).toBe('sweetwo-mine-20261007.zip');
  const path = await file.path();
  const bytes = (await import('node:fs')).readFileSync(path);
  const text = bytes.toString('utf8');
  expect(text).toContain('자산.csv');
  expect(text).toContain('찬우 주식');
  expect(text).not.toContain('청년 적금'); // 공동 항목은 ‘공동 데이터’에
});

test('데이터(S-18): PDF 요약(자산 요약 + 연간 요약)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db, { visibility: 'all' });
  await page.goto('/settings/data');
  await page.getByRole('radio', { name: 'PDF 요약' }).click();
  await expect(page.getByRole('radio', { name: 'PDF 요약' })).toBeChecked();
  await axe(page);
  // 웹 본인 확인(다시 로그인) 뒤 돌아온 것처럼
  const dl = page.waitForEvent('download');
  await page.goto('/settings/data?export=joint&format=pdf');
  const file = await dl;
  expect(file.suggestedFilename()).toBe('sweetwo-joint-20261007.pdf');
  const bytes = (await import('node:fs')).readFileSync(await file.path());
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(100_000); // 글꼴 포함
  if (process.env.E2E_PDF_OUT)
    (await import('node:fs')).writeFileSync(process.env.E2E_PDF_OUT, bytes);
  await expect(page.getByText('파일을 저장했어요')).toBeVisible();
});

test('계정 삭제(S-18b) → 로그아웃, 다시 로그인하면 삭제 취소', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db);
  await page.goto('/settings/data');
  await page.getByRole('button', { name: /계정 삭제/ }).click();
  await expect(page).toHaveURL(/\/settings\/data\/delete$/);
  await expect(page.getByText('내 명의 항목 1개는 지워져요')).toBeVisible();
  await expect(page.getByText('같이 쓰던 데이터도 모두 지워져요')).toBeVisible();
  await expect(page.getByText('30일 안에 다시 로그인하면 복구돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '카카오로 확인하고 삭제' }).click();
  const dialog = page.getByRole('alertdialog', { name: '계정을 삭제할까요?' });
  await expect(dialog).toBeVisible();
  await axe(page);
  await dialog.getByRole('button', { name: '계정을 삭제할게요' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText('계정 삭제 요청을 받았어요. 11월 6일까지 다시 로그인하면 취소할 수 있어요'),
  ).toBeVisible();
  expect(db.me.status).toBe('deletion_requested');
});

test('삭제 요청한 계정으로 다시 로그인: 계정 삭제를 취소할까요?', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.me.status = 'deletion_requested';
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '계정 삭제를 취소할까요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '취소하고 계속 쓰기' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(db.me.status).toBe('active');
});

test('도움말(S-20) 검색 → 문의하기(S-19a) → 내 문의, 열람 동의(S-19b)', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /도움말/ }).click();
  await expect(page).toHaveURL(/\/settings\/help$/);
  await expect(page.getByRole('heading', { name: '시작하기' })).toBeVisible();
  await page.getByRole('button', { name: '계좌를 연결하지 않나요?' }).click();
  await expect(page.getByText(/계좌·카드 연동 없이 직접 입력해요/)).toBeVisible();
  await axe(page);
  const search = page.getByRole('searchbox', { name: '자주 묻는 질문에서 찾기' });
  await search.fill('초대 코드');
  await expect(page.getByRole('button', { name: '파트너는 어떻게 초대하나요?' })).toBeVisible();
  await search.fill('우주선');
  await expect(page.getByText('찾는 답이 없어요')).toBeVisible();
  await page.getByRole('button', { name: '문의하기' }).first().click();

  // 문의하기
  await expect(page).toHaveURL(/\/settings\/help\/inquiry$/);
  await page.getByRole('button', { name: /분류/ }).click();
  await page
    .getByRole('dialog', { name: '분류' })
    .getByRole('radio', { name: '우리 둘 연결' })
    .click();
  await page.getByLabel('내용').fill('예빈이 합류 코드를 넣었는데 연결이 안 돼요');
  await axe(page);
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByText('문의 #A-10001를 받았어요')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/help\/inquiries$/);
  expect(db.inquiries[0]?.attach).toMatchObject({ couple_state: 'connected', platform: 'web' });

  // 운영자 답변과 열람 요청이 왔다고 치고
  Object.assign(db.inquiries[0] ?? {}, {
    status: 'waiting_user',
    access_request: [
      {
        id: 'ar-1',
        status: 'requested',
        scope: ['income_spend'],
        raw_amount: false,
        expires_at: null,
      },
    ],
  });
  (db.inquiries[0]?.inquiry_message as unknown[]).push({
    id: 'm-admin',
    author: 'admin',
    body: '확인해 볼게요',
    created_at: '2026-10-07T03:00:00Z',
  });
  await page.reload();
  await page.getByRole('button', { name: /문의 #A-10001/ }).click();
  await expect(page.getByText('확인해 볼게요')).toBeVisible();
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByText('동의하면 24시간만 봐요')).toBeVisible();
  await expect(page.getByText('월 수입·지출 화면')).toBeVisible();
  await expect(page.getByText('금액은 구간으로')).toBeVisible();
  // 보지 않아요 칩은 기획서 그대로(25 S-19b 3번, S11-09)
  for (const chip of ['메모', '가족 정보', '사진', '숨긴 항목'])
    await expect(page.locator('.hg-badge', { hasText: chip }).first()).toBeVisible();
  await expect(page.getByText('용돈 내역')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '동의해요' }).click();
  await expect(page.getByText('상담원이 확인 중이에요')).toBeVisible();
  await page.getByRole('button', { name: '지금 그만 보게 하기' }).click();
  await expect(page.getByText('이제 운영자는 볼 수 없어요')).toBeVisible();
});

test('보안(S-15, 웹): 로그인된 기기, 기기별 로그아웃, 모든 기기에서 로그아웃', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.sessions.push({
    id: 's-win',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537',
    created_at: '2026-09-01T00:00:00Z',
    last_used_at: '2026-10-03T00:00:00Z',
    current: false,
  });
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /보안/ }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(page.getByText('지금 이 기기')).toBeVisible();
  await expect(page.getByText('Chrome(Windows)')).toBeVisible();
  await expect(page.getByText('10월 3일에 마지막으로 썼어요')).toBeVisible();
  // 웹은 기기 목록만(앱 잠금 없음)
  await expect(page.getByRole('switch', { name: '앱 잠금' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByText('그 기기에서 로그아웃했어요')).toBeVisible();
  await expect(page.getByText('Chrome(Windows)')).toHaveCount(0);
  await page.getByRole('button', { name: '모든 기기에서 로그아웃' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('새 기기 알림(A-08): 나예요 → 홈, 내가 아니에요 → 그 기기 로그아웃 → S-15', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.sessions.push({
    id: 's-new',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537',
    created_at: '2026-10-07T01:00:00Z',
    last_used_at: '2026-10-07T01:00:00Z',
    current: false,
  });
  await page.goto('/new-device/s-new');
  await expect(page.getByRole('heading', { name: '새 기기에서 로그인했어요' })).toBeVisible();
  await expect(page.getByText(/Chrome\(Windows\)/)).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '나예요' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/new-device/s-new');
  await page.getByRole('button', { name: '내가 아니에요' }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(page.getByText(/보안도 확인해 주세요/)).toBeVisible();
  await expect(page.getByText('Chrome(Windows)')).toHaveCount(0);
});

test('약관 개정 재동의(A-05r): 바뀐 필수 항목만 → 들어오려던 화면으로, 마케팅 2년 재확인', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.pendingTerms = [
    { kind: 'terms', version: 'v2' },
    { kind: 'marketing', version: '' },
  ];
  await page.goto('/settings/security');
  await expect(page).toHaveURL(/\/terms\/update$/);
  await expect(page.getByRole('heading', { name: '바뀐 약관을 확인해 주세요' })).toBeVisible();
  await expect(page.getByText('[필수] 개인정보 수집·이용')).toHaveCount(0);
  await axe(page);
  const go = page.getByRole('button', { name: '동의하고 계속하기' });
  await expect(go).toBeDisabled();
  await page
    .getByRole('checkbox', { name: /이용약관/ })
    .first()
    .click();
  await go.click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  expect(db.pendingTerms).toEqual([]);

  // 마케팅만 남은 경우
  db.pendingTerms = [{ kind: 'marketing', version: '' }];
  await page.goto('/calendar/list');
  await expect(page.getByRole('heading', { name: '마케팅 정보를 계속 받을까요?' })).toBeVisible();
  await page.getByRole('button', { name: '그만 받을게요' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
});

test('연결 해제 요청 받음(S-12d) 오프라인: ‘해제할게요’ 비활성 + 이유 한 줄(S3-08)', async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending' });
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-1',
    requested_by: 'yebin',
    requested_at: '2026-10-05T01:00:00Z',
    deadline: '2026-10-19',
    ratio: 50,
    plan: [],
    status: 'pending',
    cancelled_at: null,
    confirmed_at: null,
  });
  await page.goto('/settings/couple/unlink/review');
  const go = page.getByRole('button', { name: '해제할게요' });
  await expect(go).toBeEnabled();
  await context.setOffline(true);
  await expect(go).toBeDisabled();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  await axe(page);
  await context.setOffline(false);
  await expect(go).toBeEnabled();
});

// QA 11구간(2026-11-12)
test('가이드(S-01·S-03): 대화 카드 줄 없음, 돈 합치기 적용은 월급 계획, 끝 고지(S11-01, S11-12)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.checklistDone = [];
  await page.goto('/settings/guides');
  const topic = page.getByRole('button', { name: '돈 합치기 돈 합치기, 어디까지 할까요' });
  await expect(topic).toBeVisible();
  await expect(page.getByText('우리 둘 대화 카드 다시 보기')).toHaveCount(0);
  await axe(page);
  await topic.click();
  await expect(
    page.getByText(
      'sweeTwo는 입력한 숫자로 계산한 참고 정보를 보여드려요. 투자·금융 자문이 아니에요',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: /우리에게 적용하기/ }).click();
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
});

test('계정 삭제(S-18b) ‘먼저 내보내기’ → 내보내면 S-18b로 돌아옴(S11-13)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/settings/data/delete');
  await page.getByRole('button', { name: '먼저 내보내기' }).click();
  await expect(page).toHaveURL(/\/settings\/data\?from=delete$/);
  await expect(page.getByRole('button', { name: '계정 삭제', exact: true }).first()).toBeVisible();
  // 웹 본인 확인(다시 로그인) 뒤 돌아온 것처럼
  const dl = page.waitForEvent('download');
  await page.goto('/settings/data?export=joint&format=csv&from=delete');
  await dl;
  await expect(page).toHaveURL(/\/settings\/data\/delete$/);
  await expect(page.getByText('파일을 저장했어요')).toBeVisible();
});

test('내 정보(S-11): 로그인 줄은 제공자 배지 + 소셜 계정 이메일, ‘사진 바꾸기’ 글자 버튼(S11-11)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/settings/me');
  await expect(page.getByText('chanwoo@kakao.example')).toBeVisible();
  await expect(page.locator('.hg-badge', { hasText: '카카오' })).toBeVisible();
  await expect(page.getByRole('button', { name: '사진 바꾸기' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '사진 바꾸기' }).click();
  await expect(page).toHaveURL(/\/settings\/me\/photo$/);
});
