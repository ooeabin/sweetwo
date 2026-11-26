import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { fakeBridge } from './fake-bridge';
import { type MemDb, mockOnboarding, mockV22Settings, seed, YEBIN } from './mocks';
import { fillAmount } from './form';

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
  await expect(page.getByText('예빈님 항목은 보내기와 용돈이 돼요')).toBeVisible();
  await expect(page.getByText('같이 모으기는 공동 저축·투자가 돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '좋아요' }).click();
  await expect(page).toHaveURL(/\/salary\/plan$/);
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
    page.getByRole('heading', { name: '예빈님이 월급을 합쳐서 쓰자고 해요' }),
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
  await expect(page).toHaveURL(/\/salary\/plan$/);
  expect(db.space?.salary_mode).toBe('separate');
});

test('분담 도우미(W-01b): 생활비 통장 → 1,000,000원 → 반반 → 예빈님께 알리기, 월급 비율은 흐린 선택지', async ({
  page,
}) => {
  const { v } = await connected(page);
  await page.goto('/salary/split/new');
  await expect(page.getByRole('heading', { name: '같이 쓰는 통장 이름이 뭐예요?' })).toBeVisible();
  await page.getByRole('radio', { name: '생활비 통장' }).click();
  await axe(page);
  await fillAmount(page, '둘이 한 달에 얼마 넣을까요?', 1_000_000);
  await expect(page.getByRole('heading', { name: '어떻게 나눌까요?' })).toBeVisible();
  // 두 사람 모두 ‘모두 보여 주기’가 아니라 월급 비율은 이유 문구 없이 흐림
  await expect(page.getByRole('radio', { name: '월급 비율' })).toBeDisabled();
  await expect(page.getByText(/공개|보여 주기/)).toHaveCount(0);
  await page.getByRole('radio', { name: '반반' }).click();
  await expect(page.getByText('찬우 500,000원, 예빈 500,000원 (5 : 5)')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '예빈님께 알리기' }).click();
  await expect(page.getByText('예빈님께 알렸어요')).toBeVisible();
  expect(v.shared[0]).toMatchObject({ name: '생활비 통장', rule: 'half', share_a: 500_000 });
  // W-01: 내가 연 제안이 열려 있으면 그 통장(내 몫, 잠김) 아래 회색 “예빈님 답을 기다려요”(20 W-01b, PR 14)
  await page.goto('/salary/plan');
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
  await fillAmount(page, '둘이 한 달에 얼마 넣을까요?', 600_000);
  await page.getByRole('radio', { name: '월급 비율' }).click();
  // 350만 : 250만 → 60만 × 350/600 = 35만
  await expect(page.getByText('찬우 350,000원, 예빈 250,000원 (6 : 4)')).toBeVisible();
  await expect(page.getByText(/250만|350만/)).toHaveCount(0);
  await page.getByRole('button', { name: '예빈님께 알리기' }).click();
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
    page.getByRole('heading', { name: '예빈님이 ‘생활비 통장’ 나누기를 알렸어요' }),
  ).toBeVisible();
  await expect(page.getByText('한 달 1,000,000원, 찬우 400,000원, 예빈 600,000원')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '좋아요' }).click();
  await expect(page).toHaveURL(/\/salary\/plan$/);
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
  // 서버 필터를 ‘상대로서’ 부름
  expect(v.calls.find((c) => c.fn === 'partner_plan_view')?.body).toMatchObject({
    p_viewer: YEBIN,
  });
  await expect(page.getByText('찬우님은 저축·투자만 보여 줘요')).toBeVisible();
  // 저금만: 저금 줄 금액은 보이고, 월급·고정지출은 안 보임
  await expect(page.getByText('950,000원', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('고정지출')).toHaveCount(0);
  await expect(page.getByText(/월급 350만/)).toHaveCount(0);
  // 상대 홈 H-10과 같게(2026-11-13 실구동): 묶이지 않은 내 개인 저금은 ‘같이 모으기’가 아니라 ‘저금’(상대 W-10·H-09)에
  const together = page.getByRole('region', { name: '같이 모으기' });
  await expect(together.getByText('보이는 게 없어요')).toBeVisible();
  await expect(together.getByText('950,000원 / 150,000,000원')).toHaveCount(0);
  const mySaving = page.getByRole('region', { name: '저축·투자', exact: true });
  await expect(mySaving.getByText('950,000원 / 150,000,000원')).toBeVisible();
  // 같이 모으기 묶음: 합계 / 목표 금액, 둘 다 ‘각자 모은 금액 보여 주기’면 내 몫 한 줄(상대 H-10 카드와 같은 값)
  v.bundles.push({
    id: 'b-1',
    name: '신혼여행',
    status: 'active',
    deadline: null,
    paused: false,
    percent_only: false,
    show_each: true,
    my_show_each: true,
    my_percent_only: false,
    pct: 30,
    total: 1_500_000,
    target: 5_000_000,
    mine: 900_000,
    partner: 600_000,
    goals: [],
  });
  await page.reload();
  await expect(together.getByText('신혼여행')).toBeVisible();
  await expect(together.getByText('1,500,000원 / 5,000,000원')).toBeVisible();
  await expect(together.getByText('찬우님 몫 900,000원')).toBeVisible();
  // 자산 총액만: 종류별 합계만
  await expect(page.getByText('예금·적금 1개')).toBeVisible();
  await expect(page.getByText('청년 적금')).toHaveCount(0);
  await axe(page);

  // 했어요만(2026-11-13 P1 = A): 서버가 저금 이름·목표 금액·모은 금액을 주지 않아 “개인 저금” + 이번 달 확인 여부만
  (db.me as Record<string, unknown>).plan_share = 'done_only';
  await page.reload();
  await expect(page.getByText('찬우님은 이번 달 했는지만 보여 줘요')).toBeVisible();
  await expect(page.getByText('이번 달 했어요').first()).toBeVisible();
  await expect(page.getByText('개인 저축·투자').first()).toBeVisible();
  await expect(mySaving.getByText('개인 저축·투자').first()).toBeVisible();
  await expect(page.getByText('950,000원 / 150,000,000원')).toHaveCount(0);
  await expect(page.getByText('내 집 마련')).toHaveCount(0);
  await axe(page);
});

test('내 월급(S-11c): 다음 달부터 + 언제까지 → 예약 표시(S-11) → 취소', async ({ page }) => {
  const { db, v } = await connected(page);
  await page.goto('/settings/me/salary');
  // 공개 고지 한 줄(O-31과 같음)
  await expect(page.getByText('파트너에게는 저축·투자만 보여요')).toBeVisible();
  await fillAmount(page, '한 달 실수령액은 얼마예요?', 1_600_000);
  await page.getByRole('button', { name: '다음 달부터' }).click();
  await page.getByRole('switch', { name: '언제까지예요?' }).click();
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('2026년 11월부터 바꿀게요')).toBeVisible();
  expect(db.me.monthly_income).toBe(3_500_000);
  expect(v.salaryChanges[0]).toMatchObject({ effective_from: '2026-11-01', amount: 1_600_000 });
  await expect(page.getByText(/2026년 11월부터 1,600,000원/)).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('월급 변경을 취소했어요')).toBeVisible();
  expect(v.salaryChanges[0]?.cancelled_at).toBeTruthy();
});

test('내 월급(S-11c): 이번 달부터면 월급날(25일) 전이어도 바로 적용 → “월급을 바꿨어요” + 되돌리기', async ({
  page,
}) => {
  const { db, v } = await connected(page);
  await page.goto('/settings/me/salary');
  await fillAmount(page, '한 달 실수령액은 얼마예요?', 3_000_000);
  await page.getByRole('button', { name: '이번 달부터' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('월급을 바꿨어요')).toBeVisible();
  expect(v.salaryChanges[0]).toMatchObject({ effective_from: '2026-10-01', amount: 3_000_000 });
  expect(v.salaryChanges[0]?.applied_at).toBeTruthy();
  expect(db.me.monthly_income).toBe(3_000_000);
  await expect(page.getByText(/2026년 10월부터/)).toHaveCount(0);
});

test('내 월급(S-11c) 월급날 고르기(A안): 저장된 25일은 칩, 직접 입력한 날은 저장되고 다시 열면 직접 입력하기 칸, 말일 칩, 범위 오류는 저장 막음', async ({
  page,
}) => {
  const { db } = await connected(page);
  await page.goto('/settings/me/salary');
  await expect(page.locator('.hg-wheel')).toHaveCount(0);
  const chips = page.getByRole('radiogroup', { name: '월급날' });
  const custom = page.getByRole('textbox', { name: '다른 날 직접 입력하기' });
  await expect(chips.getByRole('radio', { name: '25일' })).toBeChecked();
  await expect(custom).toHaveValue('');
  await custom.fill('45');
  await expect(page.getByText('1~31 사이로 입력해 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await custom.fill('12');
  await expect(chips.getByRole('radio', { name: '25일' })).not.toBeChecked();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('월급을 바꿨어요')).toBeVisible();
  expect(db.me.payday).toBe(12);
  await page.goto('/settings/me/salary');
  await expect(page.getByRole('textbox', { name: '다른 날 직접 입력하기' })).toHaveValue('12');
  await page.getByRole('radio', { name: '말일' }).click();
  await expect(page.getByRole('textbox', { name: '다른 날 직접 입력하기' })).toHaveValue('');
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('월급을 바꿨어요')).toBeVisible();
  expect(db.me.payday_last).toBe(true);
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

test('보안(S-15): 꺼져 있으면 ‘앱 잠금’ 스위치 + 아래 보조 한 줄, 켜면 A-06', async ({ page }) => {
  await connected(page);
  await fakeBridge(page, { signedIn: true, pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  await page.goto('/settings/security');
  await expect(page.getByText('열 때 PIN 6자리를 물어요')).toHaveCount(1);
  // 맨 위 권장 줄과 ‘켜기’ 버튼은 없음(2026-11-24 구역 5)
  await expect(page.getByRole('button', { name: '켜기', exact: true })).toHaveCount(0);
  await axe(page);
  await page.getByRole('switch', { name: '앱 잠금' }).click();
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
  await page.goto(`/salary/plan?who=${YEBIN}`);
  await expect(page.getByText('예빈님은 저축·투자만 보여 주기로 정했어요')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /예빈 여행/ }).or(page.getByText('예빈 여행')),
  ).toBeVisible();
  await expect(page.getByText('300,000원', { exact: true })).toBeVisible();
  await expect(page.getByText('고정지출')).toHaveCount(0);
  await axe(page);

  v.partnerShare = 'done_only';
  await page.reload();
  await expect(page.getByText('예빈님은 ‘했어요’만 보여 주기로 정했어요')).toBeVisible();
  await expect(page.getByText('개인 저축·투자')).toBeVisible();
  await expect(page.getByText('예빈 여행')).toHaveCount(0);
  await expect(page.getByText('아직이에요')).toBeVisible();
  await expect(page.getByText('300,000원', { exact: true })).toHaveCount(0);
  await axe(page);
});

test('S-11 월급 관리 방식 값: 관리자가 나면 “내가 관리해요”, 상대면 “{이름}님이 관리해요”(2026-11-24)', async ({
  page,
}) => {
  const { db } = await connected(page);
  Object.assign(db.space ?? {}, {
    salary_mode: 'joint',
    shared_living: true,
    manager_user_id: db.me.id,
  });
  await page.goto('/settings/me');
  const row = page.getByRole('button', { name: /월급 관리 방식/ });
  await expect(row).toContainText('내가 관리해요');
  await expect(row).not.toContainText('찬우님이 관리해요');
  Object.assign(db.space ?? {}, { manager_user_id: YEBIN });
  await page.reload();
  await expect(page.getByRole('button', { name: /월급 관리 방식/ })).toContainText(
    '예빈님이 관리해요',
  );
});

test('빠른 금액 칩(S-11c): 3,500,000에서 +100만은 4,500,000(지금 값에 더함, 2026-11-24)', async ({
  page,
}) => {
  await connected(page);
  await page.goto('/settings/me/salary');
  const label = '한 달 실수령액은 얼마예요?';
  const narrow = (page.viewportSize()?.width ?? 1280) < 768;
  await fillAmount(page, label, 3_500_000);
  const chip = page.getByRole('button', { name: '+100만', exact: true });
  // 좁은 창은 칩이 금액 버튼 아래에 있고 이름에 지금 금액이 들어감, 넓은 창은 입력 칸 값
  const value = () =>
    narrow
      ? page.getByRole('button', { name: new RegExp(`^${label.replace('?', '\\?')},`) })
      : page.getByLabel(label, { exact: true });
  const has = async (text: RegExp) =>
    narrow ? expect(value()).toHaveAccessibleName(text) : expect(value()).toHaveValue(text);
  await has(/3,?500,?000/);
  await chip.click();
  await has(/4,?500,?000/);
  await chip.click();
  await has(/5,?500,?000/);
});

test('위젯 설정(S-22): 금액 보이기는 기기에 저장(기본 꺼짐), 저축·투자는 대표 또는 고른 항목, 브리지가 없으면 줄이 없음', async ({
  page,
}, info) => {
  const { db } = await connected(page);
  await fakeBridge(page, { signedIn: true, widgetSettings: true });
  await page.goto('/settings');
  await page.getByRole('button', { name: /^위젯/ }).click();
  await expect(page).toHaveURL(/\/settings\/widgets$/);
  const sw = page.getByRole('switch', { name: '위젯에 금액 보이기' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await axe(page);
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __fb: { widgetSettings: { showAmounts: boolean } } }).__fb
            .widgetSettings.showAmounts,
      ),
    )
    .toBe(true);
  // 저축·투자: 기본은 대표
  await expect(page.getByRole('radio', { name: /대표 저축·투자/ })).toBeChecked();
  const target = db.goals.find((g) => g.target_amount && !g.bundle_id);
  if (target) {
    await page.getByRole('radio', { name: new RegExp(String(target.name)) }).click();
    await expect.poll(() => db.me.widget_goal_id).toBe(target.id);
    await page.getByRole('radio', { name: /대표 저축·투자/ }).click();
    await expect.poll(() => db.me.widget_goal_id).toBeNull();
  }
  if (info.project.name === 'light') await axe(page);
});

test('위젯 설정(S-22): 브리지가 없으면 S-10에 위젯 줄이 없고 주소로 들어가도 설정으로 돌아감', async ({
  page,
}) => {
  await connected(page);
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /^위젯/ })).toHaveCount(0);
  await page.goto('/settings/widgets');
  await expect(page).toHaveURL(/\/settings$/);
});
