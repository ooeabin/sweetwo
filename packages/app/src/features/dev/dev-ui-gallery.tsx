import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Icon,
  IconButton,
  List,
  ListRow,
  SceneMedia,
  SectionHeader,
  Tabs,
  Toast,
  illustrations,
} from '@sweetwo/ui';

// 개발 전용 컴포넌트 모음(/dev/ui). 배포 빌드에는 경로가 없다.
export function DevUiGallery() {
  const [tab, setTab] = useState<'a' | 'b'>('a');
  const [chip, setChip] = useState(false);
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
      <SectionHeader title={`그림 ${Object.keys(illustrations).length}개`} />
      <SceneMedia />
      <Toast message="저장했어요" />
    </main>
  );
}
