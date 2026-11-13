import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { fakeBridge } from './fake-bridge';
import { type MemDb, mockOnboarding, mockV22Settings, seed, YEBIN } from './mocks';

// v2.2 PR 11 공개·관계·설정(25 ‘설정 v2.2’, 20 W-01b·W-01c, 08 2·4·6장). 찬우(시작한 사람, 이 기기)와 합류한 예빈.
// 예빈이 보낸 요청·제안은 흉내 서버에 넣어 두고 찬우가 답함.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

/** 찬우(각자, 350만, 25일) + 예빈 합류(10일). 내 집 마련 저금 줄은 이번 달 확인함 */
async function connected(page: Page) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    shared_living: false,
    shared_saving: false,
    manager_user_id: null,
  });
  db.partner = {
    id: YEBIN,
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: null,
    payday: 10,
    payday_last: false,
    allowance: null,
  };
  const line = (db.checklists[0]?.pay_check_line as Record<string, unknown>[]).find(
    (l) => l.goal_id === 'goal-h',
  );
  if (line) Object.assign(line, { state: 'checked', checked_by: db.me.id });
  const v = await mockV22Settings(page, db, NOW);
  return { db, v };
}
const modeRequest = (db: MemDb, o: Record<string, unknown>) => ({
  id: 'mr-1',
  space_id: db.space?.id,
  from_user: YEBIN,
  to_mode: 'joint',
  to_manager: null,
  to_shared_living: true,
  to_shared_saving: true,
  phrase: 's11f_combine',
  status: 'open',
  created_at: '2026-10-06T01:00:00Z',
  expires_at: '2026-10-13T01:00:00Z',
  answered_at: null,
  ...o,
});

test('관리 형태 요청 받음(S-11j): P-04 ‘보내요’ 문구 그대로 → 좋아요 → 한 사람 관리형 → W-01', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  v.modeRequests.push(modeRequest(db, { phrase: 'p04_send', to_manager: db.me.id }));
  await page.goto('/settings/couple/style/request/mr-1');
  await expect(
    page.getByRole('heading', { name: '예빈님이 월급은 대부분 찬우님에게 보낸다고 했어요' }),
  ).toBeVisible();
  await expect(page.getByText('찬우님이 관리하는 걸로 바꿀까요?')).toBeVisible();
  await expect(page.getByText('월급 계획이 하나로 합쳐져요')).toBeVisible();
  await expect(page.getByText('예빈님 줄은 보내기와 용돈이 돼요')).toBeVisible();
  await expect(page.getByText('같이 모으기 묶음은 공동 저금이 돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '좋아요' }).click();
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  expect(v.modeRequests[0]?.status).toBe('accepted');
  expect(db.space).toMatchObject({ salary_mode: 'joint', manager_user_id: db.me.id });
});

test('관리 형태 요청 받음(S-11j): 지금처럼 할게요 → 각자 그대로, 7일 지난 요청은 그대로', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  v.modeRequests.push(modeRequest(db, {}));
  await page.goto('/settings/couple/style/request/mr-1');
  await expect(
    page.getByRole('heading', { name: '예빈님이 월급을 합쳐서 관리하자고 해요' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '지금처럼 할게요' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(v.modeRequests[0]?.status).toBe('declined');
  expect(db.space?.salary_mode).toBe('separate');

  // 만료된 요청: 답 없이 안내만
  v.modeRequests.push(
    modeRequest(db, {
      id: 'mr-2',
      expires_at: '2026-10-01T01:00:00Z',
      created_at: '2026-09-24T01:00:00Z',
    }),
  );
  await page.goto('/settings/couple/style/request/mr-2');
  await expect(page.getByRole('heading', { name: '요청 기한이 지났어요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '좋아요' })).toHaveCount(0);
  await axe(page);
});

test('관리 형태(S-11f): 진행 중인 내 요청 표시와 요청 취소, 합쳐서 → 각자는 바로 적용', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  v.modeRequests.push(modeRequest(db, { from_user: db.me.id }));
  await page.goto('/settings/couple/style');
  await expect(page.getByText('예빈님 답을 기다려요')).toBeVisible();
  await page.getByRole('button', { name: '요청 취소' }).click();
  await expect(page.getByText('요청을 취소했어요')).toBeVisible();
  expect(v.modeRequests[0]?.status).toBe('cancelled');

  // 합쳐서(둘이 같이)에서 각자로: 상대 답 없이 바로
  Object.assign(db.space ?? {}, { salary_mode: 'joint', shared_living: true, shared_saving: null });
  await page.reload();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '각자 자기 월급으로 해요' }).click();
  await expect(page.getByText(/‘좋아요’를 누르면/)).toHaveCount(0);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  expect(db.space?.salary_mode).toBe('separate');
});

test('분담 도우미(W-01b): 생활비 통장 → 100만 원 → 반반 → 예빈님에게 제안하기, 월급 비율은 흐린 선택지', async ({
  page,
}) => {
  const { v } = await connected(page);
  await page.goto('/salary/split/new');
  await expect(page.getByRole('heading', { name: '어떤 통장을 나눌까요?' })).toBeVisible();
  await page.getByRole('radio', { name: '생활비 통장' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('한 달에 얼마 넣을까요?').fill('1000000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '어떻게 나눌까요?' })).toBeVisible();
  // 두 사람 모두 ‘모두 보여 주기’가 아니라 월급 비율은 이유 문구 없이 흐림
  await expect(page.getByRole('radio', { name: '월급 비율' })).toBeDisabled();
  await expect(page.getByText(/공개|보여 주기/)).toHaveCount(0);
  await page.getByRole('radio', { name: '반반' }).click();
  await expect(page.getByText('찬우 50만 원, 예빈 50만 원 (5 : 5)')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '예빈님에게 제안하기' }).click();
  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  expect(v.shared[0]).toMatchObject({ name: '생활비 통장', rule: 'half', share_a: 500_000 });
  // W-01: 내가 연 제안이 열려 있으면 그 통장(내 몫, 잠김) 아래 회색 “예빈님 답을 기다려요”(20 W-01b, PR 14)
  await page.goto('/salary?view=plan');
  await expect(page.getByText('예빈님 답을 기다려요')).toBeVisible();
  await expect(page.getByText('생활비 통장')).toBeVisible();
  await axe(page);
  // 예빈이 답하면 사라짐
  Object.assign(v.shared[0] ?? {}, { status: 'declined' });
  await page.reload();
  await expect(page.getByText('내 집 마련').first()).toBeVisible();
  await expect(page.getByText('생활비 통장')).toHaveCount(0);
  await expect(page.getByText('예빈님 답을 기다려요')).toHaveCount(0);
});

test('분담 도우미(W-01b): 두 사람 모두 ‘모두 보여 주기’면 월급 비율, 결과 비율만', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  (db.me as Record<string, unknown>).plan_share = 'all';
  v.partnerShare = 'all';
  await page.goto('/salary/split/new');
  await page.getByRole('radio', { name: '데이트 통장' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('한 달에 얼마 넣을까요?').fill('600000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '월급 비율' }).click();
  // 350만 : 250만 → 60만 × 350/600 = 35만
  await expect(page.getByText('찬우 35만 원, 예빈 25만 원 (6 : 4)')).toBeVisible();
  await expect(page.getByText(/250만|350만/)).toHaveCount(0);
  await page.getByRole('button', { name: '예빈님에게 제안하기' }).click();
  await expect.poll(() => v.shared[0]?.share_a).toBe(350_000);
});

test('분담 제안 받음(W-01c): 좋아요 → 내 월급 계획에 같이 쓰는 통장 줄 / 지금처럼 할게요', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  const proposal = (id: string) => ({
    id,
    space_id: db.space?.id,
    name: '생활비 통장',
    monthly_total: 1_000_000,
    rule: 'custom',
    member_a: YEBIN,
    member_b: db.me.id,
    share_a: 600_000,
    share_b: 400_000,
    ratio_a: 60,
    status: 'proposed',
    proposed_by: YEBIN,
    expires_at: '2026-10-13T01:00:00Z',
    answered_at: null,
    created_at: '2026-10-06T01:00:00Z',
  });
  v.shared.push(proposal('sa-1'));
  await page.goto('/salary/split/sa-1');
  await expect(
    page.getByRole('heading', { name: '예빈님이 ‘생활비 통장’ 나누기를 제안했어요' }),
  ).toBeVisible();
  await expect(page.getByText('한 달 100만 원, 찬우 40만 원, 예빈 60만 원')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '좋아요' }).click();
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  expect(v.shared[0]?.status).toBe('accepted');
  expect(db.splits[0]?.split_line.find((l) => l.kind === 'shared_account')?.amount).toBe(400_000);

  v.shared.push(proposal('sa-2'));
  await page.goto('/salary/split/sa-2');
  await page.getByRole('button', { name: '지금처럼 할게요' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(v.shared[1]?.status).toBe('declined');
});

test('상대에게 보이는 모습(S-13p): 저금만이면 저금 줄 금액, 했어요만이면 “개인 저금” + 이번 달 확인 여부만', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  db.assets.push({
    id: 'a-1',
    side: 'asset',
    grp: 'deposit',
    kind: 'saving',
    name: '청년 적금',
    amount: 3_000_000,
    principal: null,
    owner: 'person',
    owner_user_id: db.me.id,
    visibility: 'sum',
    status: 'held',
    deleted_at: null,
    created_at: '2026-09-01T00:00:00Z',
  });
  await page.goto('/settings/visibility');
  await page.getByRole('button', { name: '예빈님에게 보이는 모습 보기 ›' }).click();
  await expect(page).toHaveURL(/\/settings\/visibility\/preview$/);
  await expect(page.getByRole('heading', { name: '예빈님에게 보이는 모습' })).toBeVisible();
  await expect(page.getByText('예빈님 화면에서는 이렇게 보여요')).toBeVisible();
  // 서버 필터를 ‘상대로서’ 부름
  expect(v.calls.find((c) => c.fn === 'partner_plan_view')?.body).toMatchObject({
    p_viewer: YEBIN,
  });
  await expect(page.getByText('찬우님은 저금만 보여 줘요')).toBeVisible();
  // 저금만: 저금 줄 금액은 보이고, 월급·고정지출은 안 보임
  await expect(page.getByText('95만 원', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('고정지출')).toHaveCount(0);
  await expect(page.getByText(/월급 350만/)).toHaveCount(0);
  // 같이 모으기: 목표 금액이 있는 저금은 모은 금액 / 목표 금액
  await expect(page.getByText('95만 원 / 1억 5,000만 원')).toBeVisible();
  // 자산 총액만: 종류별 합계만
  await expect(page.getByText('예금·적금 1개')).toBeVisible();
  await expect(page.getByText('청년 적금')).toHaveCount(0);
  await axe(page);

  // 했어요만(2026-11-13 P1 = A): 서버가 저금 이름·목표 금액·모은 금액을 주지 않아 “개인 저금” + 이번 달 확인 여부만
  (db.me as Record<string, unknown>).plan_share = 'done_only';
  await page.reload();
  await expect(page.getByText('찬우님은 했어요만 보여 줘요')).toBeVisible();
  await expect(page.getByText('이번 달 했어요').first()).toBeVisible();
  await expect(page.getByText('개인 저금').first()).toBeVisible();
  await expect(page.getByText('95만 원 / 1억 5,000만 원')).toHaveCount(0);
  await expect(page.getByText('내 집 마련')).toHaveCount(0);
  await axe(page);
});

test('내 월급(S-11c): 다음 달부터 + 언제까지 → 예약 표시(S-11) → 취소', async ({ page }) => {
  const { db, v } = await connected(page);
  await page.goto('/settings/me/salary');
  // 공개 고지 한 줄(O-31과 같음)
  await expect(page.getByText('파트너에게는 저금만 보여요')).toBeVisible();
  await page.getByLabel('한 달 실수령액은 얼마예요?').fill('1600000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음 달부터' }).click();
  await page.getByRole('switch', { name: '언제까지예요?' }).click();
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('2026년 11월부터 바꿀게요')).toBeVisible();
  expect(db.me.monthly_income).toBe(3_500_000);
  expect(v.salaryChanges[0]).toMatchObject({ effective_from: '2026-11-01', amount: 1_600_000 });
  await expect(page.getByText(/2026년 11월부터 160만 원/)).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('월급 변경을 취소했어요')).toBeVisible();
  expect(v.salaryChanges[0]?.cancelled_at).toBeTruthy();
});

test('내 월급(S-11c): 이번 달부터면 월급날(25일) 전이어도 바로 적용 → “월급을 바꿨어요” + 되돌리기', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  await page.goto('/settings/me/salary');
  await page.getByLabel('한 달 실수령액은 얼마예요?').fill('3000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '이번 달부터' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('월급을 바꿨어요')).toBeVisible();
  expect(v.salaryChanges[0]).toMatchObject({ effective_from: '2026-10-01', amount: 3_000_000 });
  expect(v.salaryChanges[0]?.applied_at).toBeTruthy();
  expect(db.me.monthly_income).toBe(3_000_000);
  await expect(page.getByText(/2026년 10월부터/)).toHaveCount(0);
});

test('알림 종류(S-14): 한 사람 관리형 관리하지 않는 쪽은 ‘같이 쓰는 걸 바꿨을 때’ 기본 끔, ‘내 용돈’ 줄', async ({
  page,
}) => {
  const { db } = await connected(page);
  Object.assign(db.space ?? {}, {
    salary_mode: 'joint',
    shared_living: true,
    manager_user_id: YEBIN,
  });
  await page.goto('/settings/notifications');
  const card = page.getByRole('region', { name: '알림 종류' });
  await expect(card.getByRole('switch', { name: '내 용돈이 바뀌었을 때' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect
    .poll(() => (db.me.push_kinds as Record<string, boolean> | undefined)?.shared_change)
    .toBe(false);
  await expect(
    card.getByRole('switch', { name: '예빈님이 같이 쓰는 걸 바꿨을 때' }),
  ).toHaveAttribute('aria-checked', 'false');
  await axe(page);
});

test('보안(S-15): PIN을 건너뛰었으면 맨 위 권장 한 줄 + 켜기 → A-06', async ({ page }) => {
  await connected(page);
  await fakeBridge(page, { signedIn: true, pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  await page.goto('/settings/security');
  await expect(page.getByText('앱 잠금을 켜면 한 번 더 지켜 줘요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '켜기', exact: true }).click();
  await expect(page).toHaveURL(/next=\/settings\/security/);
});

test('W-01 파트너 탭(3b): 예빈이 ‘저금만’이면 저금 줄만, ‘했어요만’이면 “개인 저금” + 이번 달 확인 여부만', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  const base = db.goals.find((g) => g.id === 'goal-h') as Record<string, unknown>;
  db.goals.push({
    ...base,
    id: 'goal-y',
    name: '예빈 여행',
    owner_user_id: YEBIN,
    created_by: YEBIN,
  });
  db.splits.push({
    id: 'split-y',
    owner_user_id: YEBIN,
    split_line: [
      {
        id: 'y-1',
        split_id: 'split-y',
        kind: 'saving',
        goal_id: 'goal-y',
        amount: 300_000,
        sort: 0,
      },
      { id: 'y-2', split_id: 'split-y', kind: 'fixed', goal_id: null, amount: 700_000, sort: 1 },
    ],
  });
  await page.goto(`/salary?view=plan&who=${YEBIN}`);
  await expect(page.getByText('예빈님은 저금만 보여 줘요')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /예빈 여행/ }).or(page.getByText('예빈 여행')),
  ).toBeVisible();
  await expect(page.getByText('30만 원', { exact: true })).toBeVisible();
  await expect(page.getByText('고정지출')).toHaveCount(0);
  await axe(page);

  v.partnerShare = 'done_only';
  await page.reload();
  await expect(page.getByText('예빈님은 했어요만 보여 줘요')).toBeVisible();
  await expect(page.getByText('개인 저금')).toBeVisible();
  await expect(page.getByText('예빈 여행')).toHaveCount(0);
  await expect(page.getByText('아직이에요')).toBeVisible();
  await expect(page.getByText('30만 원', { exact: true })).toHaveCount(0);
  await axe(page);

  // W-13 저금 목록: 서버(space_goals)가 “개인 저금”으로, 금액 없이 줌 → 이번 달 확인 여부만, 열지 않음
  Object.assign(db.goals.find((g) => g.id === 'goal-y') ?? {}, {
    name: '개인 저금',
    target_amount: null,
    start_saved: 0,
  });
  await page.goto('/salary/items');
  const row = page.locator('.hg-goalrow', { hasText: '개인 저금' });
  await expect(row).toContainText('아직이에요');
  await expect(row.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /개인 저금/ })).toHaveCount(0);
  await axe(page);
});
