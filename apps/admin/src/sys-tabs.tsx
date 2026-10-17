import { Tabs } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { ops } from './copy';
import { useAdmin } from './gate';

export type SysTab = 'approvals' | 'app' | 'admins' | 'audit';

/** 시스템 메뉴 탭(승인, 앱 버전·점검, 관리자 계정(최고 관리자만), 감사 로그) */
export function SysTabs({ current }: { current: SysTab }) {
  const nav = useNavigate();
  const me = useAdmin();
  const tabs = (Object.keys(ops.sysTabs) as SysTab[]).filter(
    (t) => t !== 'admins' || me.roles.includes('super'),
  );
  return (
    <Tabs<SysTab>
      label={ops.systemTitle}
      items={tabs.map((t) => ({ value: t, label: ops.sysTabs[t] }))}
      value={current}
      onChange={(t) => nav(`/system/${t}`)}
    />
  );
}
