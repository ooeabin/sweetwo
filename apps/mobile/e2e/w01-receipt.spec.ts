import { goOffline, goOnline } from './offline';
import { test, expect, type Page, type Route } from '@playwright/test';
import { fillAmount } from './form';
import { axe as runAxe } from './axe';
import { chanwoo, type MemDb, mockOnboarding, seed } from './mocks';

// W-01 월급 계획 영수증(20 W-01, 2026-11-09): 별도 화면(/salary/plan, 2026-11-18 구간 탭 없앰), 줄마다 바로 저장 + 되돌리기,
// 지출 추가 칩, 기본 줄 지우기, 편집 모드 순서(키보드), 파트너 탭 보기만, 합쳐서(두 Avatar, 합), 모자람, 공유(브라우저 = 내려받기),
// 금액 가리기. 찬우(시작) 350만 원 25일, 저금 청약 44만·내 집 마련 95만, 지출 고정지출 88만·생활비 88만·용돈 35만.
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const lineOf = (db: MemDb, kind: string, name?: string) =>
  db.splits[0]?.split_line.find((l) => l.kind === kind && (!name || l.name === name));
const waitLine = (db: MemDb, kind: string) =>
  (db.checklists[0]?.pay_check_line as Record<string, unknown>[]).find(
    (l) => l.kind === kind && l.state === 'wait',
  );
const listNames = (page: Page, group: string) =>
  page
    .getByRole('list', { name: group })
    .locator('.hg-receipt__name')
    .evaluateAll((els) => els.map((e) => e.firstChild?.textContent ?? ''));
// 지출 묶음은 맨 위 용돈 줄 목록(‘용돈’) + 나머지 지출(‘지출’)(2026-11-16 R4-3)
const names = async (page: Page, group: string) =>
  group === '지출'
    ? [...(await listNames(page, '용돈')), ...(await listNames(page, '지출'))]
    : listNames(page, group);

/** ‘+ 지출 추가’ → 작은 선택 시트에서 “지출”(같이 쓰는 통장을 쓸 수 있을 때, 2026-11-19) */
async function addSpend(page: Page) {
  await page.getByRole('button', { name: '+ 지출 추가' }).click();
  await page
    .getByRole('dialog', { name: '무엇을 추가할까요?' })
    .getByRole('button', { name: '지출' })
    .click();
  // 2026-11-23: 지출 추가는 한 화면 입력(W-01e)
  await expect(page.getByRole('heading', { name: '지출 추가', level: 1 })).toBeVisible();
}

async function open(page: Page, url = '/salary/plan') {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  return { db, go: () => page.goto(url) };
}

/** 예빈 합류(각자): 예빈 월급 계획 생활비 68만 + 용돈 27만 */
function joinYebin(db: MemDb) {
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 270_000,
  };
  const line = (id: string, kind: string, amount: number, sort: number) => ({
    id,
    split_id: 'split-y',
    kind,
    goal_id: null,
    user_id: kind === 'allowance' ? 'yebin' : null,
    name: null,
    amount,
    sort,
  });
  db.splits.push({
    id: 'split-y',
    owner_user_id: 'yebin',
    split_line: [line('y1', 'living', 680_000, 0), line('y2', 'allowance', 270_000, 1)],
  });
}

test('보기: 머리 제목 ‘월급 계획 템플릿’, 요약 카드(문장·막대·범례), 묶음 카드, + 버튼 없음', async ({
  page,
}) => {
  const { go } = await open(page);
  await go();
  await expect(page.getByRole('heading', { name: '월급 계획 템플릿', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: '계획' })).toHaveCount(0); // 구간 탭 없음(2026-11-18)
  // 2026-11-24: 흰 바탕 + 영역 셋(요약, 저축·투자, 지출, 사이는 8px 회색 띠), 예전 영수증 카드·합계 줄·사람 원은 없음
  await expect(page.locator('.hg-frame--alt')).toHaveCount(0);
  await expect(page.locator('.hg-plancard')).toHaveCount(3);
  await expect(page.locator('.hg-receipt, .hg-receipt__row--strong')).toHaveCount(0);
  const sum = page.locator('.hg-plansum');
  await expect(sum.locator('.hg-plansum__amt')).toHaveText('350만 원');
  await expect(sum.locator('.hg-plansum__title')).toHaveText('월급의 40%를 모으고 있어요');
  await expect(sum.locator('.hg-plansum__title em')).toHaveText('40%');
  // 06 3-5: 139만 / 211만 / 0 → 40% / 60% / 0%
  await expect(page.getByRole('img', { name: '저축·투자 40%, 지출 60%, 미계획 0%' })).toBeVisible();
  await expect(sum.locator('.hg-plansum__bar > i')).toHaveCount(2); // 0%인 미계획 칸은 그리지 않음
  const legend = sum.locator('.hg-plansum__legend li');
  await expect(legend).toHaveText(['저축·투자139만 원', '지출211만 원', '미계획0원']);
  expect(await names(page, '저축·투자')).toEqual(['청약', '내 집 마련']);
  expect(await names(page, '지출')).toEqual(['용돈', '고정지출', '생활비']);
  await expect(page.locator('.hg-plancard__sum')).toHaveText(['139만 원', '211만 원']);
  await expect(page.locator('.hg-fab')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '공유하기' })).toBeVisible();
  // 카드 끝 블록 추가 버튼(회색 52px)
  await expect(page.getByRole('button', { name: '+ 저축·투자 추가' })).toHaveClass(
    /hg-plan__block/,
  );
  await expect(page.getByRole('button', { name: '+ 지출 추가' })).toHaveClass(/hg-plan__block/);
  await axe(page);
  // 큰 금액(연필) → 월급 금액 시트(설정 내 월급으로 가지 않음)
  await page.getByRole('button', { name: '월급 350만 원, 금액 고치기' }).click();
  const incomeSheet = page.getByRole('dialog', { name: '월급 금액' });
  await expect(incomeSheet).toBeVisible();
  // 옛 주소 /salary/split → 계획, ‘이번 달’ → W-02
  await page.goto('/salary/split');
  await expect(page).toHaveURL(/\/salary\/plan$/);
  // 2026-11-19: W-01에는 ‘이번 달 월급 체크 ›’ 링크가 없음. W-02는 주소로
  await expect(page.getByRole('link', { name: '이번 달 월급 체크' })).toHaveCount(0);
  await page.goto('/salary');
  await expect(page.locator('.hg-datepill')).toHaveText('9월 25일 월급');
  // W-02에는 머리 링크도 저축·투자 묶음 머리도 없음
  await expect(page.getByRole('link', { name: '월급 계획 템플릿' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '저축·투자 목록 보기' })).toHaveCount(0);
});

test('월급 0원: 요약 카드는 “월급을 적으면 / 나눌 수 있어요” + 월급 적기, 막대·범례 없음, 빈 칩 카드', async ({
  page,
}) => {
  const { db, go } = await open(page);
  Object.assign(db.me, { monthly_income: 0 });
  const sp0 = db.splits[0];
  if (sp0) sp0.split_line.length = 0;
  db.goals.length = 0;
  await go();
  const sum = page.locator('.hg-plansum');
  await expect(sum.locator('.hg-plansum__amt')).toHaveText('0원');
  await expect(sum.locator('.hg-plansum__title')).toHaveText('월급을 적으면나눌 수 있어요');
  await expect(sum.locator('.hg-plansum__bar, .hg-plansum__legend')).toHaveCount(0);
  await expect(sum.getByRole('button', { name: '월급 적기' })).toHaveClass(/hg-plan__block--soft/);
  // 빈 카드: 저축·투자 = 이름 칩 + 직접 정하기, 지출 = 지출 칩 + 직접 정하기, 블록 추가 버튼은 없음
  const saving = page.getByRole('region', { name: '저축·투자', exact: true });
  await expect(saving.getByText('무엇을 모을지 골라 보세요')).toBeVisible();
  await expect(saving.getByRole('button', { name: '직접 정하기' })).toBeVisible();
  const spend = page.getByRole('region', { name: '지출', exact: true });
  await expect(spend.getByText('매달 나가는 지출을 골라 보세요')).toBeVisible();
  for (const n of ['월세', '관리비', '통신비', '보험료', '대출 상환', '생활비', '직접 정하기'])
    await expect(spend.getByRole('button', { name: n, exact: true })).toBeVisible();
  await expect(page.locator('.hg-plan__block:not(.hg-plan__block--soft)')).toHaveCount(0);
  await expect(page.getByText('매달 나가는 지출이 있어요?')).toHaveCount(0); // 맨 위 칩 카드 없음
  await sum.getByRole('button', { name: '월급 적기' }).click();
  await expect(page.getByRole('dialog', { name: '월급 금액' })).toBeVisible();
  await axe(page);
});

test('금액 바꾸기: 시트(미계획 금액 미리보기) → 바로 저장 + 되돌리기, 이번 달 체크 안 한 줄도', async ({
  page,
}) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '생활비 88만 원' }).click();
  const sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await expect(sheet.getByText('미계획 금액 0원')).toBeVisible();
  await sheet.getByRole('textbox', { name: '생활비 금액' }).fill('800000');
  await expect(sheet.getByText('미계획 금액 8만 원')).toBeVisible();
  // 기본 줄은 이름을 바꾸지 않음
  await expect(sheet.getByLabel('항목 이름')).toHaveCount(0);
  await axe(page);
  await sheet.getByRole('button', { name: '확인' }).click();
  // 이번 달 체크 안 한 줄도 바뀌어 Toast가 그 말로(2026-11-09)
  await expect(page.getByText('이번 달 아직 확인하지 않은 것도 바꿨어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '생활비 80만 원' })).toBeVisible();
  expect(lineOf(db, 'living')?.amount).toBe(800_000);
  expect(waitLine(db, 'living')?.planned).toBe(800_000);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('button', { name: '생활비 88만 원' })).toBeVisible();
  expect(lineOf(db, 'living')?.amount).toBe(880_000);
});

test('지출 추가: 이름 칩 → 금액 → 추가하기, 직접 추가 줄은 이름 바꾸기', async ({ page }) => {
  const { db, go } = await open(page);
  await go();
  await addSpend(page);
  const chips = page.getByRole('group', { name: '지출 이름' });
  for (const n of ['관리비', '통신비', '보험료', '구독료', '교통비', '부모님 용돈'])
    await expect(chips.getByRole('button', { name: n })).toBeVisible();
  await chips.getByRole('button', { name: '관리비' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('관리비에 매달 얼마씩 쓸까요?');
  // 어떻게 챙겨요?: 지출은 세 칸, 처음 값 월급날 확인
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.getByRole('radio', { name: '월급날 확인' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('button', { name: '추가하기' })).toBeDisabled();
  await fillAmount(page, '매달 얼마씩?', 100000);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    '관리비에 매달 10만 원씩 쓸까요?',
  );
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByText('관리비를 추가했어요')).toBeVisible();
  expect(await names(page, '지출')).toEqual(['용돈', '고정지출', '생활비', '관리비']);
  expect(lineOf(db, 'custom', '관리비')?.amount).toBe(100_000);
  expect(waitLine(db, 'custom')?.planned).toBe(100_000);
  // 이미 있는 이름은 칩에서 숨김, 글자로 넣으면 막음
  await addSpend(page);
  await expect(chips.getByRole('button', { name: '관리비' })).toHaveCount(0);
  await chips.getByRole('button', { name: '직접 정하기' }).click();
  await page.getByRole('textbox', { name: '항목 이름' }).fill('관리비');
  await fillAmount(page, '매달 얼마씩?', 0);
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByText('이미 있는 이름이에요')).toBeVisible();
  await page.getByRole('button', { name: '뒤로' }).click();
  // 직접 추가 줄: 시트에서 이름 바꾸기
  await page.getByRole('button', { name: '관리비 10만 원' }).click();
  const s2 = page.getByRole('dialog', { name: '관리비 금액' });
  await s2.getByLabel('항목 이름').fill('아파트 관리비');
  await s2.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('이름을 바꿨어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '아파트 관리비 10만 원' })).toBeVisible();
});

test('기본 줄 지우기 + 되돌리기(같은 자리), 저금 줄 지우기는 확인 뒤 그만 모음', async ({
  page,
}) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '고정지출 88만 원' }).click();
  await page
    .getByRole('dialog', { name: '고정지출 금액' })
    .getByRole('button', { name: '고정지출 항목 지우기' })
    .click();
  await expect(page.getByText('고정지출을 지웠어요')).toBeVisible();
  expect(await names(page, '지출')).toEqual(['용돈', '생활비']);
  expect(lineOf(db, 'fixed')).toBeUndefined();
  expect(waitLine(db, 'fixed')).toBeUndefined();
  await expect(
    page.getByRole('img', { name: '저축·투자 40%, 지출 35%, 미계획 25%' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => names(page, '지출')).toEqual(['용돈', '고정지출', '생활비']);
  // 저금 줄: 확인 Modal → 그만 모음
  // 저축·투자 줄을 누르면 W-10 상세로 가고(2026-11-18), 줄 시트는 W-10 ‘매달 금액 바꾸기’(?line=)나 편집하기에서
  await page.goto('/salary/plan?line=goal-e');
  await page
    .getByRole('dialog', { name: '청약 금액' })
    .getByRole('button', { name: '청약 항목 지우기' })
    .click();
  const modal = page.getByRole('alertdialog', { name: '청약을 그만 모을까요?' });
  await expect(modal.getByText('월급 계획에서는 빠지지만 모은 내역은 남아요')).toBeVisible();
  await modal.getByRole('button', { name: '그만할게요' }).click();
  await expect(page.getByText('그만 모으기로 했어요')).toBeVisible();
  expect(await names(page, '저축·투자')).toEqual(['내 집 마련']);
  expect(db.goals.find((g) => g.id === 'goal-e')?.closed_at).toBeTruthy();
  await expect(page.getByRole('button', { name: '그만 모은 것 1개' })).toBeVisible();
});

test('편집 모드: 키보드 위·아래로 순서 → ‘완료’에서 한 번에 저장 + 되돌리기, 줄마다 지우기', async ({
  page,
}) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '편집하기' }).click();
  await expect(page.getByRole('heading', { name: '월급 계획 편집' })).toBeVisible();
  await expect(page.getByRole('link', { name: '이번 달 월급 체크' })).toHaveCount(0);
  // 기본 줄도 지우기(마우스 기기는 늘 보임)
  await expect(page.getByRole('button', { name: '고정지출 지우기' })).toBeVisible();
  await axe(page);
  // 용돈 줄은 지출 맨 위에 고정(2026-11-16 R4-3), 나머지 지출끼리 순서를 바꿈
  await expect(page.getByRole('button', { name: '용돈 위로' })).toHaveCount(0);
  const up = page.getByRole('button', { name: '생활비 위로' });
  await up.focus();
  await expect(up).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('생활비, 1번째')).toBeAttached();
  expect(await names(page, '지출')).toEqual(['용돈', '생활비', '고정지출']);
  // 아직 저장 전
  expect(db.rpc.includes('split_reorder')).toBe(false);
  await page.getByRole('button', { name: '완료' }).click();
  await expect(page.getByText('순서를 바꿨어요')).toBeVisible();
  expect(db.rpc.filter((x) => x === 'split_reorder')).toHaveLength(1);
  expect(
    [...(db.splits[0]?.split_line ?? [])]
      .sort((a, b) => Number(a.sort) - Number(b.sort))
      .map((l) => l.kind),
  ).toEqual(['saving', 'saving', 'allowance', 'living', 'fixed']);
  // 이번 달 체크리스트도 같은 순서
  await page.goto('/salary'); // 2026-11-19 W-01 머리 링크 없앰
  await expect(page.locator('.hg-transfer__label').nth(2)).toHaveText('용돈');
  await page.goto('/salary/plan');
  await page.getByRole('button', { name: '편집하기' }).click();
  await page.getByRole('button', { name: '완료' }).click();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
});

test('파트너 탭(각자): 보기만(자물쇠), 편집·추가·추천값 없음, 공유는 있음', async ({ page }) => {
  const { db, go } = await open(page, '/salary/plan?who=yebin');
  joinYebin(db);
  await go();
  await expect(page.getByText('예빈님 월급 계획이에요. 보기만 할 수 있어요')).toBeVisible();
  const cards = page.locator('.hg-plancard');
  await expect(page.locator('.hg-plansum__amt')).toHaveText('270만 원');
  await expect(page.locator('.hg-receipt__lock')).toHaveCount(2);
  // 카드 안에는 누를 수 있는 것이 없음(연필·블록 버튼·⋯ 없음, 머리 이동 링크 ‘이번 달 월급 체크 ›’는 2026-11-19 없앰)
  await expect(cards.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '이번 달 월급 체크' })).toHaveCount(0);
  for (const n of ['편집하기', '추천값으로 다시 채우기', '+ 지출 추가', '+ 저축·투자 추가'])
    await expect(page.getByRole('button', { name: n })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '공유하기' })).toBeVisible();
  await axe(page);
  // 내 탭으로
  await page.getByRole('tab', { name: '찬우' }).click();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
});

test('합쳐서: 두 사람 Avatar 겹침, 수입 합, 월급날 둘, 용돈 줄은 지울 수 없음', async ({
  page,
}) => {
  const { db, go } = await open(page);
  joinYebin(db);
  Object.assign(db.space ?? {}, { salary_mode: 'joint' });
  db.splits = [
    {
      id: 'split-j',
      owner_user_id: null,
      split_line: [
        ['saving', 'goal-h', null, 950_000],
        ['fixed', null, null, 1_560_000],
        ['allowance', null, chanwoo.id, 350_000],
        ['allowance', null, 'yebin', 270_000],
      ].map(([kind, goal_id, user_id, amount], i) => ({
        id: `j${i}`,
        split_id: 'split-j',
        kind,
        goal_id,
        user_id,
        name: null,
        amount,
        sort: i,
      })),
    },
  ];
  db.checklists = [];
  await go();
  // 2026-11-19: 큰 금액은 합계(누르지 않음), 아래 사람마다 한 줄(내 것만 연필), 사람 원은 없음
  await expect(page.locator('.hg-plancard .hg-avatar')).toHaveCount(0);
  await expect(page.locator('p.hg-plansum__amt')).toHaveText('620만 원');
  await expect(page.getByRole('button', { name: '찬우 월급 350만 원, 금액 고치기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /예빈 월급/ })).toHaveCount(0);
  await expect(page.locator('.hg-plansum__person').nth(1)).toContainText('예빈 월급270만 원');
  expect(await names(page, '지출')).toEqual(['찬우 용돈', '예빈 용돈', '고정지출']);
  await page.getByRole('button', { name: '편집하기' }).click();
  await expect(page.getByRole('button', { name: '고정지출 지우기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '찬우 용돈 지우기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '예빈 용돈 지우기' })).toHaveCount(0);
  await axe(page);
});

test('모자람: 막대는 저축·투자·지출로 꽉, 범례 “미계획 −32만 원”(금액만 danger)', async ({
  page,
}) => {
  const { db, go } = await open(page);
  Object.assign(lineOf(db, 'living') ?? {}, { amount: 1_200_000 });
  await go();
  // 139만 / 243만(기준 382만) → 36.39 / 63.61 → 36 / 64
  await expect(
    page.getByRole('img', { name: '저축·투자 36%, 지출 64%, 미계획 −32만 원' }),
  ).toBeVisible();
  // 막대는 저축·투자·지출로 꽉(미계획 칸 없음), 범례 셋째 줄 금액만 −와 빨강
  await expect(page.locator('.hg-plansum__bar > i')).toHaveCount(2);
  const short = page.locator('.hg-plansum__legend li.is-short');
  await expect(short).toHaveText('미계획−32만 원');
  // 금액만 danger 토큰(라이트·다크 값이 달라 토큰으로 비교), 이름은 ink-2
  const colors = await short.evaluate((li) => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--danger)';
    document.body.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    return {
      danger,
      amt: getComputedStyle(li.querySelector('.hg-plansum__lamt') as Element).color,
      name: getComputedStyle(li.querySelector('.hg-plansum__lname') as Element).color,
    };
  });
  expect(colors.amt).toBe(colors.danger);
  expect(colors.name).not.toBe(colors.danger);
  // 계획이 월급보다 많으면 굵은 문장이 바뀜(2026-11-19)
  await expect(page.locator('.hg-plansum__title')).toHaveText('계획이 월급보다 32만 원 많아요');
  await axe(page);
});

test('공유하기: 브라우저는 PNG 내려받기 + Toast', async ({ page }) => {
  const { go } = await open(page);
  await go();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유하기' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('sweetwo-plan-2026-10-07.png');
  await expect(page.getByText('이미지를 저장했어요')).toBeVisible();
});

test('금액 가리기: 영수증 금액은 •••, 공유 이미지도 가린 금액으로', async ({ page }) => {
  const { go } = await open(page);
  await page.addInitScript(() => localStorage.setItem('sweetwo.masked', '1'));
  // 이미지에 그린 글자를 모음(가린 금액인지 확인)
  await page.addInitScript(() => {
    const w = window as unknown as { __drawn: string[] };
    w.__drawn = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t: string, x: number, y: number) {
      w.__drawn.push(t);
      return fill.call(this, t, x, y);
    };
  });
  await go();
  await expect(page.locator('.hg-plansum__amt')).toContainText('•••');
  await expect(page.locator('.hg-receipt__amt').first()).toHaveText('•••');
  await expect(page.locator('.hg-plansum__title')).toHaveText('월급의 40%를 모으고 있어요'); // %는 가리지 않음
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유하기' }).click();
  await dl;
  const drawn = await page.evaluate(() => (window as unknown as { __drawn: string[] }).__drawn);
  expect(drawn).toContain('•••');
  expect(drawn.some((t) => /만 원/.test(t))).toBe(false);
  expect(drawn).toContain('내 집 마련');
});

test('W-10 ‘매달 금액 바꾸기’ 주소(?line=): 그 저금 줄 시트를 열고 시작, ‘저금 보기’', async ({
  page,
}) => {
  const { go } = await open(page, '/salary/plan?line=goal-h');
  await go();
  const sheet = page.getByRole('dialog', { name: '내 집 마련 금액' });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/salary\/plan$/);
  await sheet.getByRole('button', { name: '저축·투자 보기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
});

test('오프라인: 줄을 눌러도 시트 없이 “인터넷에 연결되면 할 수 있어요”', async ({ page }) => {
  const { go } = await open(page);
  await go();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
  await goOffline(page);
  await page.getByRole('button', { name: '생활비 88만 원' }).click();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await goOnline(page);
});

// ── QA 5구간(2026-11-12) ────────────────────────────────────────────

test('추천값으로 다시 채우기(D1): 직접 추가 줄과 이미 있는 고정지출·생활비는 금액 그대로, 확인 창은 바뀌는 것을', async ({
  page,
}) => {
  const { db, go } = await open(page);
  const sp = db.splits[0];
  sp?.split_line.push({
    id: 'c-m',
    split_id: sp.id,
    kind: 'custom',
    goal_id: null,
    user_id: null,
    name: '관리비',
    amount: 150_000,
    sort: sp.split_line.length,
  });
  await go();
  await page.getByRole('button', { name: '추천값으로 다시 채우기' }).click();
  const modal = page.getByRole('alertdialog', { name: '추천값으로 다시 채울까요?' });
  await expect(
    modal.getByText(
      '용돈과 기한 있는 저축·투자가 추천값으로 바뀌어요. 이미 적은 지출은 그대로예요',
    ),
  ).toBeVisible();
  await modal.getByRole('button', { name: '다시 채우기' }).click();
  await expect(page.getByText('월급 계획을 바꿨어요')).toBeVisible();
  // 06 3-2(2026-11-15): 추천 고정지출·생활비 줄은 새로 만들지 않고, 이미 있던 줄은 금액 그대로
  await expect.poll(() => lineOf(db, 'custom', '관리비')?.amount).toBe(150_000);
  expect(lineOf(db, 'fixed')?.amount).toBe(880_000);
  expect(lineOf(db, 'living')?.amount).toBe(880_000);
  expect(await names(page, '지출')).toEqual(['용돈', '고정지출', '생활비', '관리비']);
});

test('Toast ‘되돌리기’를 누르면 토스트가 닫힘(S5-03)', async ({ page }) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '생활비 88만 원' }).click();
  const sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await sheet.getByRole('textbox', { name: '생활비 금액' }).fill('800000');
  await sheet.getByRole('button', { name: '확인' }).click();
  const undo = page.getByRole('button', { name: '되돌리기' });
  await undo.click();
  await expect(page.locator('.hg-toast')).toHaveCount(0);
  await expect.poll(() => lineOf(db, 'living')?.amount).toBe(880_000);
});

test('파트너 탭(각자)인데 파트너 월급 계획이 없으면 빈 카드(D3)', async ({ page }) => {
  const { db, go } = await open(page, '/salary/plan?who=yebin');
  joinYebin(db);
  db.splits = db.splits.filter((s) => s.owner_user_id !== 'yebin');
  await go();
  await expect(page.getByText('예빈님은 아직 월급 계획이 없어요')).toBeVisible();
  await expect(page.locator('.hg-plancard')).toHaveCount(0);
  await expect(page.getByText('예빈님 월급 계획이에요. 보기만 할 수 있어요')).toHaveCount(0);
});

test('못 불러오면 오류 카드 + 다시 시도, 구간 탭은 그대로(S5-02)', async ({ page }) => {
  const { go } = await open(page);
  let fail = true;
  await page.route('**/rest/v1/salary_split*', (r) =>
    fail
      ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' })
      : r.fallback(),
  );
  await go();
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: '월급 계획 템플릿', level: 1 })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('.hg-plansum')).toBeVisible();
});

test('오프라인: ‘+ 저금 추가’도 W-11로 가지 않음(S5-08)', async ({ page }) => {
  const { go } = await open(page);
  await go();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
  await goOffline(page);
  await page.getByRole('button', { name: '+ 저축·투자 추가' }).click();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  await expect(page).toHaveURL(/\/salary\/plan$/);
  await goOnline(page);
});

test('저금 그만 모음 되돌리기는 원래 자리(S5-09)', async ({ page }) => {
  const { go } = await open(page);
  await go();
  // 저축·투자 줄을 누르면 W-10 상세로 가고(2026-11-18), 줄 시트는 W-10 ‘매달 금액 바꾸기’(?line=)나 편집하기에서
  await page.goto('/salary/plan?line=goal-e');
  await page
    .getByRole('dialog', { name: '청약 금액' })
    .getByRole('button', { name: '청약 항목 지우기' })
    .click();
  await page
    .getByRole('alertdialog', { name: '청약을 그만 모을까요?' })
    .getByRole('button', { name: '그만할게요' })
    .click();
  await expect.poll(() => names(page, '저축·투자')).toEqual(['내 집 마련']);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => names(page, '저축·투자')).toEqual(['청약', '내 집 마련']);
});

test('금액 가리기: 화면 읽기는 “가려진 금액”, 시트 미리보기도 가림(S5-12)', async ({ page }) => {
  const { go } = await open(page);
  await page.addInitScript(() => localStorage.setItem('sweetwo.masked', '1'));
  await go();
  await page.getByRole('button', { name: '생활비 가려진 금액' }).click();
  const sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await expect(sheet.locator('.hg-help', { hasText: '미계획 금액' })).toHaveText(
    '미계획 금액 •••가려진 금액',
  );
});

test('W-02 ‘이번 달’도 못 불러오면 오류 카드(‘월급 없음’ 카드가 아님, S5-02)', async ({ page }) => {
  const { go } = await open(page, '/salary');
  const fail = (r: Route) =>
    r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' });
  await page.route('**/rest/v1/pay_checklist*', fail);
  await page.route('**/rest/v1/rpc/ensure*', fail);
  await go();
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(page.getByText('월급을 넣으면 월급 계획을 만들어 드려요')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '이번 달 월급 체크', level: 1 })).toBeVisible();
});

/** 첫 달: 지출 줄(고정지출·생활비·직접 추가)이 없는 월급 계획 */
function noSpend(db: MemDb) {
  const sp = db.splits[0];
  if (sp)
    sp.split_line = sp.split_line.filter(
      (l) => !['fixed', 'living', 'custom'].includes(String(l.kind)),
    );
}

test('빈 지출 카드(2026-11-19, 예전 첫 달 묻기): 칩 → 금액 직접 → 지출 줄, 이어서 생활비 칩, 다시 열면 칩 없음', async ({
  page,
}) => {
  const { db, go } = await open(page);
  noSpend(db);
  await go();
  const card = page.getByRole('region', { name: '지출', exact: true });
  await expect(card.getByText('매달 나가는 지출을 골라 보세요')).toBeVisible();
  // 맨 위 칩 카드와 ‘다 넣었어요’ ‘건너뛸게요’는 없음
  await expect(page.getByRole('region', { name: '매달 나가는 지출이 있어요?' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다 넣었어요' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '건너뛸게요' })).toHaveCount(0);
  // 가짜 추천 금액 없음: 칩만, 금액은 시트에서 직접
  await card.getByRole('button', { name: '월세', exact: true }).click();
  await fillAmount(page, '매달 얼마씩?', 500000);
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByText('월세를 추가했어요')).toBeVisible();
  expect(lineOf(db, 'custom', '월세')?.amount).toBe(500_000);
  // 생활비 칩은 기본 생활비 줄(kind living), 넣은 칩은 숨김
  await card.getByRole('button', { name: '생활비', exact: true }).click();
  // 생활비 칩만 처음 값이 ‘확인 안 해요’(생활비 줄 기본)
  await expect(page.getByRole('radio', { name: '확인 안 해요' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await fillAmount(page, '매달 얼마씩?', 600000);
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect.poll(() => lineOf(db, 'living')?.amount).toBe(600_000);
  await expect(card.getByRole('button', { name: '월세', exact: true })).toHaveCount(0);
  await expect.poll(() => names(page, '지출')).toEqual(['용돈', '월세', '생활비']);
  await axe(page);
  await page.reload();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
  await expect(page.getByText('매달 나가는 지출을 골라 보세요')).toHaveCount(0);
});

test('빈 지출 카드: “직접 정하기” → 이름 칸', async ({ page }) => {
  const { db, go } = await open(page);
  noSpend(db);
  await go();
  await page.getByRole('button', { name: '직접 정하기' }).last().click();
  await expect(page.getByRole('textbox', { name: '항목 이름' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '항목 이름' })).toHaveValue('');
});

test('지출 줄이 있으면 빈 지출 카드 없음, 같이 쓰는 생활비 ‘아니요’면 “+ 같이 쓰는 통장” 대신 칩(R4)', async ({
  page,
}) => {
  const { db, go } = await open(page);
  Object.assign(db.space ?? {}, { shared_living: false });
  await go();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
  await expect(page.getByText('매달 나가는 지출을 골라 보세요')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ 같이 쓰는 통장 추가' })).toHaveCount(0);
  await page.getByRole('button', { name: '+ 지출 추가' }).click();
  // 같이 쓰는 통장을 쓸 수 없으면 시트 없이 바로 지출 추가(칩 끝에 ‘같이 쓰는 통장’)
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('group', { name: '지출 이름' })
    .getByRole('button', { name: '같이 쓰는 통장' })
    .click();
  await expect(page).toHaveURL(/\/salary\/split\/new/);
});

test('‘+ 지출 추가’: 같이 쓰는 통장을 쓸 수 있으면 작은 선택 시트(지출 / 같이 쓰는 통장), 블록 버튼 하나', async ({
  page,
}) => {
  const { go } = await open(page);
  await go();
  await expect(page.getByRole('button', { name: '+ 같이 쓰는 통장 추가' })).toHaveCount(0);
  await page.getByRole('button', { name: '+ 지출 추가' }).click();
  const sheet = page.getByRole('dialog', { name: '무엇을 추가할까요?' });
  await expect(sheet.getByRole('button', { name: '지출' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '같이 쓰는 통장' })).toBeVisible();
  await axe(page);
  await sheet.getByRole('button', { name: '같이 쓰는 통장' }).click();
  await expect(page).toHaveURL(/\/salary\/split\/new/);
});

test('빈 상태(저축·투자도 지출도 0줄): 아래 편집하기·공유하기·추천값 숨김, 줄이 생기면 다시 보임', async ({
  page,
}) => {
  const { db, go } = await open(page);
  const sp = db.splits[0];
  if (sp) sp.split_line = [];
  await go();
  await expect(page.getByText('무엇을 모을지 골라 보세요')).toBeVisible();
  await expect(page.getByText('매달 나가는 지출을 골라 보세요')).toBeVisible();
  for (const n of ['편집하기', '공유하기', '추천값으로 다시 채우기'])
    await expect(page.getByRole('button', { name: n })).toHaveCount(0);
  await axe(page);
  // 줄 하나(칩 → 금액)가 생기면 셋 다 보임
  await page
    .getByRole('region', { name: '지출', exact: true })
    .getByRole('button', { name: '월세', exact: true })
    .click();
  await fillAmount(page, '매달 얼마씩?', 500000);
  await page.getByRole('button', { name: '추가하기' }).click();
  for (const n of ['편집하기', '공유하기', '추천값으로 다시 채우기'])
    await expect(page.getByRole('button', { name: n })).toBeVisible();
});

test('월급 0원이어도 줄이 0개면 아래 버튼 숨김', async ({ page }) => {
  const { db, go } = await open(page);
  Object.assign(db.me, { monthly_income: 0 });
  const sp = db.splits[0];
  if (sp) sp.split_line = [];
  await go();
  await expect(page.getByRole('button', { name: '월급 적기' })).toBeVisible();
  for (const n of ['편집하기', '공유하기', '추천값으로 다시 채우기'])
    await expect(page.getByRole('button', { name: n })).toHaveCount(0);
});

test('공유 이미지: 저축·투자 줄 보조 줄이 화면과 같은 글(모은 금액 + 목표 금액의 %), 가리기면 금액만 •••', async ({
  page,
}) => {
  const { db, go } = await open(page);
  const g = db.goals.find((x) => x.id === 'goal-h');
  if (g) g.start_saved = 33_000_000;
  await page.addInitScript(() => {
    const w = window as unknown as { __drawn: string[] };
    w.__drawn = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t: string, x: number, y: number) {
      w.__drawn.push(t);
      return fill.call(this, t, x, y);
    };
  });
  await go();
  const note = '목표 금액의 22%'; // 2026-11-23: “모은 금액 …, ”를 지움
  await expect(page.getByText(note)).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유하기' }).click();
  await dl;
  const drawn = await page.evaluate(() => (window as unknown as { __drawn: string[] }).__drawn);
  expect(drawn).toContain(note);
});
