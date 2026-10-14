import { useState } from 'react';
import {
  Badge,
  BigExpense,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Icon,
  IconButton,
  List,
  ListRow,
  MonthSummary,
  SceneMedia,
  SectionHeader,
  SpendItems,
  Tabs,
  Toast,
  illustrations,
  type BigItem,
  type VariableItem,
} from '@sweetwo/ui';

// 개발 전용 컴포넌트 모음(/dev/ui). 배포 빌드에는 경로가 없다. 예시 숫자는 기획서 계산·배분 탭 W-04g 예시.
export function DevUiGallery() {
  const [tab, setTab] = useState<'a' | 'b'>('a');
  const [chip, setChip] = useState(false);
  const [variable, setVariable] = useState<VariableItem[]>([
    { id: 'food', name: '식비', amount: 820_000, lastMonth: 790_000 },
    { id: 'gift', name: '경조사비', amount: 100_000, prefilledFrom: '예빈 친구 결혼식' },
    { id: 'etc', name: '기타', amount: null },
  ]);
  const [big, setBig] = useState<BigItem[]>([
    {
      key: 'car-ins',
      name: '자동차보험',
      amount: 708_000,
      how: 'from_goal',
      goalName: '차 유지비',
    },
  ]);
  const [none, setNone] = useState(false);
  return (
    <main
      className="hg-stack"
      style={{ padding: 'var(--space-6)', gap: 'var(--space-8)', maxWidth: 720 }}
    >
      <SectionHeader title="버튼과 아이콘" />
      <div className="hg-row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Button variant="primary">저장하기</Button>
        <Button variant="secondary">나중에</Button>
        <Button variant="ghost">취소</Button>
        <IconButton icon="bell" label="알림" dot />
        <Icon name="calendar" />
        <Badge kind="achieved">달성</Badge>
        <Chip selected={chip} onClick={() => setChip(!chip)}>
          생활비
        </Chip>
      </div>
      <Tabs
        label="기간"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'a', label: '이번 달' },
          { value: 'b', label: '지난달' },
        ]}
      />
      <Card label="이번 달 남은 생활비" value="62" unit="만 원" meta="10월 31일까지" />
      <Field label="월 소득" help="세후 금액으로 적어요" inputMode="numeric" />
      <List>
        <ListRow label="주택청약" sub="매달 25일" value="20만 원" />
        <ListRow label="넷플릭스" sub="구독료" value="1.7만 원" />
      </List>
      <SectionHeader title="월말 정리" />
      <SpendItems
        fixed={[
          { id: 'rent', name: '월세', group: '주거', amount: 650_000 },
          { id: 'tel', name: '통신비', group: '통신', amount: 98_000 },
        ]}
        variable={variable}
        onChangeVariable={(id, amount) =>
          setVariable((v) => v.map((x) => (x.id === id ? { ...x, amount } : x)))
        }
        onAddItem={() => undefined}
      />
      <BigExpense
        options={[
          { key: 'car-ins', name: '자동차보험', goalName: '차 유지비' },
          { key: 'car-tax', name: '자동차세' },
        ]}
        items={big}
        none={none}
        onToggle={(key) => {
          setNone(false);
          setBig((b) =>
            b.some((i) => i.key === key)
              ? b.filter((i) => i.key !== key)
              : [
                  ...b,
                  {
                    key,
                    name: key === 'car-tax' ? '자동차세' : '자동차보험',
                    amount: null,
                    how: 'exception',
                  },
                ],
          );
        }}
        onNone={() => {
          setNone(true);
          setBig([]);
        }}
        onChange={(key, patch) =>
          setBig((b) => b.map((i) => (i.key === key ? { ...i, ...patch } : i)))
        }
      />
      <MonthSummary
        monthLabel="10월 정산"
        income={7_650_000}
        fixed={1_826_929}
        variable={1_400_000}
        allowance={600_000}
        bigExpense={708_000}
        saved={2_207_751}
        allowanceNote="각 30만"
        bigExpenseNote="자동차보험"
        changes={[
          { name: '식비', diff: 30_000 },
          { name: '통신비', diff: -12_000 },
        ]}
      />
      <EmptyState title="아직 정산한 달이 없어요" body="첫 월말 정리 뒤에 보여드려요" />
      <SectionHeader title={`그림 ${Object.keys(illustrations).length}개`} />
      <SceneMedia scene="W-04" />
      <Toast message="저장했어요" />
    </main>
  );
}
