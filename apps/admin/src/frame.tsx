import { adminSignOut, fetchAdminInquiryCounts } from '@sweetwo/api';
import { formatKstDateTime, type AdminRole } from '@sweetwo/core';
import { AdminFrame, Button, Icon, type AdminMenu } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { copy } from './copy';
import { useAdmin } from './gate';
import { clearSessionClock } from './session';

// 메뉴(33 4장): 역할에 권한 없는 메뉴는 숨김(33 2장 표). 구독·결제는 유료화 시점이라 아직 없음.
const MENUS: (AdminMenu & { roles: AdminRole[] })[] = [
  {
    key: 'dashboard',
    label: copy.menus.dashboard,
    group: copy.menuGroups.work,
    icon: 'house',
    href: '/',
    roles: ['super', 'ops', 'cs', 'analyst'],
  },
  {
    key: 'members',
    label: copy.menus.members,
    group: copy.menuGroups.work,
    icon: 'user',
    href: '/members',
    roles: ['super', 'ops', 'cs'],
  },
  {
    key: 'inquiries',
    label: copy.menus.inquiries,
    group: copy.menuGroups.work,
    icon: 'envelope',
    href: '/inquiries',
    roles: ['super', 'ops', 'cs'],
  },
  {
    key: 'send',
    label: copy.menus.send,
    group: copy.menuGroups.content,
    icon: 'bell',
    href: '/notices',
    roles: ['super', 'ops', 'cs', 'analyst'],
  },
  {
    key: 'content',
    label: copy.menus.content,
    group: copy.menuGroups.content,
    icon: 'image',
    href: '/content',
    roles: ['super', 'ops', 'cs'],
  },
  {
    key: 'system',
    label: copy.menus.system,
    group: copy.menuGroups.manage,
    icon: 'settings',
    href: '/system',
    roles: ['super', 'ops', 'cs'],
  },
  {
    key: 'docs',
    label: copy.menus.docs,
    group: copy.menuGroups.manage,
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
      search={<GlobalSearch />}
      who={{
        name: me.name,
        role: me.roles.map((r) => copy.roles[r]).join(', '),
        sub: me.last_seen_at ? copy.seenAt(formatKstDateTime(me.last_seen_at)) : undefined,
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

/** 상단 바 통합 검색(27 기본 틀 2번): 정확히 일치만, AD-02에서 찾음. 검색어는 주소에 넣지 않고 화면 상태로 넘김 */
function GlobalSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      className="hg-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        nav('/members', { state: { q: q.trim(), at: Date.now() } });
        setQ('');
      }}
    >
      <Icon name="search" />
      <input
        type="search"
        aria-label={copy.globalSearch}
        placeholder={copy.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </form>
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
