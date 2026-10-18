import { adminSignOut, fetchAdminInquiryCounts } from '@sweetwo/api';
import { formatKstDateTime, type AdminRole } from '@sweetwo/core';
import { AdminFrame, Button, type AdminMenu } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { copy } from './copy';
import { useAdmin } from './gate';
import { clearSessionClock } from './session';

// 메뉴(33 4장): 역할에 권한 없는 메뉴는 숨김(33 2장 표). 구독·결제는 유료화 시점이라 아직 없음.
const MENUS: (AdminMenu & { roles: AdminRole[] })[] = [
  {
    key: 'dashboard',
    label: copy.menus.dashboard,
    icon: 'house',
    href: '/',
    roles: ['super', 'ops', 'cs', 'analyst'],
  },
  {
    key: 'members',
    label: copy.menus.members,
    icon: 'user',
    href: '/members',
    roles: ['super', 'ops', 'cs'],
  },
  {
    key: 'inquiries',
    label: copy.menus.inquiries,
    icon: 'envelope',
    href: '/inquiries',
    roles: ['super', 'ops', 'cs'],
  },
  {
    key: 'send',
    label: copy.menus.send,
    icon: 'bell',
    href: '/notices',
    roles: ['super', 'ops', 'cs', 'analyst'],
  },
  {
    key: 'content',
    label: copy.menus.content,
    icon: 'image',
    href: '/content',
    roles: ['super', 'ops', 'cs'],
  },
  {
    key: 'system',
    label: copy.menus.system,
    icon: 'settings',
    href: '/system',
    roles: ['super', 'ops', 'cs'],
  },
  {
    key: 'docs',
    label: copy.menus.docs,
    icon: 'info',
    href: '/docs',
    roles: ['super', 'ops', 'cs', 'analyst'],
  },
];

export const canSee = (roles: AdminRole[], key: string) =>
  MENUS.find((m) => m.key === key)?.roles.some((r) => roles.includes(r)) ?? false;

export function Frame({
  menu,
  title,
  actions,
  children,
}: {
  menu: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const me = useAdmin();
  const nav = useNavigate();
  const qc = useQueryClient();
  const counts = useQuery({
    queryKey: ['admin', 'inquiry-counts'],
    queryFn: fetchAdminInquiryCounts,
    enabled: canSee(me.roles, 'inquiries'),
  });
  const menus = MENUS.filter((m) => m.roles.some((r) => me.roles.includes(r))).map((m) =>
    m.key === 'inquiries' ? { ...m, count: counts.data?.received } : m,
  );
  return (
    <AdminFrame
      menus={menus}
      current={menu}
      onMenu={(m) => nav(m.href)}
      who={{
        name: me.name,
        sub: `${me.roles.map((r) => copy.roles[r]).join(', ')}${me.last_seen_at ? `, ${copy.seenAt(formatKstDateTime(me.last_seen_at))}` : ''}`,
        action: (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearSessionClock();
              void adminSignOut().then(() => qc.invalidateQueries({ queryKey: ['admin', 'gate'] }));
            }}
          >
            {copy.signOut}
          </Button>
        ),
      }}
      title={title}
      actions={actions}
    >
      {children}
    </AdminFrame>
  );
}

/** 권한 없는 화면 주소: “권한이 없어요” + 대시보드로 */
export function NoPermission() {
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <Frame menu="" title={copy.noPermission}>
      <p className="hg-help">{loc.pathname}</p>
      <Button variant="secondary" onClick={() => nav('/')}>
        {copy.toDashboard}
      </Button>
    </Frame>
  );
}
