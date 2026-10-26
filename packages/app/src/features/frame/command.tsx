import { fetchAssets, fetchCareDays, fetchGoals, qk } from '@sweetwo/api';
import { CommandPalette, Menu, type CommandGroup, type MenuAction } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMask } from '../../shared/mask';
import { session } from '../auth';
import { copy } from './copy';

// 앱 기본 틀 동작(19 앱 기본 틀 3·4·7·11·12번):
// - ⌘K(Windows Ctrl+K) 검색 화면(CommandPalette): ‘바로 하기’ + 목표, 가진 돈·대출, 챙길 날(최대 5개씩)
// - Ctrl(⌘)+1~4 탭, Ctrl(⌘)+N 추가(홈은 추가 메뉴를 엶, 다른 메뉴는 그 화면에 맞는 추가)
// - 추가 = 목표 / 가진 돈·대출 / 챙길 날

export const ADD_TO = { goal: '/goals/new', asset: '/assets/new', care: '/calendar/add' } as const;
const TABS = ['/', '/goals', '/assets', '/calendar'] as const;
type Tab = 'month' | 'goals' | 'assets' | 'calendar';
/** 그 화면에 맞는 추가(좁은 창 + 버튼, Ctrl+N): 홈·목표 = 목표, 우리 자산 = 가진 돈·대출, 캘린더 = 챙길 날 */
export const addFor = (t: Tab | null) =>
  t === 'assets' ? ADD_TO.asset : t === 'calendar' ? ADD_TO.care : ADD_TO.goal;

const Ctx = createContext<{ addOpen: boolean; setAddOpen: (v: boolean) => void }>({
  addOpen: false,
  setAddOpen: () => undefined,
});

/** 오늘 띠 ‘추가’(보조 버튼): 목표 / 가진 돈·대출 / 챙길 날. Ctrl(⌘)+N으로도 열림 */
export function AddMenu() {
  const nav = useNavigate();
  const { addOpen, setAddOpen } = useContext(Ctx);
  const actions: MenuAction[] = [
    { label: copy.addGoal, onSelect: () => nav(ADD_TO.goal) },
    { label: copy.addAsset, onSelect: () => nav(ADD_TO.asset) },
    { label: copy.addCare, onSelect: () => nav(ADD_TO.care) },
  ];
  return (
    <Menu
      label={copy.add}
      button={copy.add}
      actions={actions}
      open={addOpen}
      onOpenChange={setAddOpen}
    />
  );
}

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
export const searchKey = () => (isMac() ? '⌘K' : 'Ctrl K');

/** 검색 화면 + 단축키 + 추가 메뉴 상태. MainFrame이 감싼다 */
export function FrameCommands({
  current,
  narrow,
  children,
  paletteOpen,
  setPaletteOpen,
}: {
  current: Tab | null;
  narrow: boolean;
  children: ReactNode;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}) {
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { masked, toggle } = useMask();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        setQuery('');
        setPaletteOpen(true);
      } else if (['1', '2', '3', '4'].includes(k)) {
        e.preventDefault();
        nav(TABS[Number(k) - 1] ?? '/');
      } else if (k === 'n') {
        e.preventDefault();
        if (current === 'month') setAddOpen(true);
        else nav(addFor(current));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, nav, setPaletteOpen]);
  return (
    <Ctx.Provider value={{ addOpen, setAddOpen }}>
      {children}
      {paletteOpen && (
        <Palette
          query={query}
          onQuery={setQuery}
          narrow={narrow}
          masked={masked}
          onMask={toggle}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </Ctx.Provider>
  );
}

function Palette({
  query,
  onQuery,
  narrow,
  masked,
  onMask,
  onClose,
}: {
  query: string;
  onQuery: (q: string) => void;
  narrow: boolean;
  masked: boolean;
  onMask: () => void;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const cares = useQuery({ queryKey: qk.careDays, queryFn: fetchCareDays });
  const lock = session.bridge?.lock;
  const q = query.trim().toLowerCase();
  const hit = (s: string) => !q || s.toLowerCase().includes(q);
  const actions = [
    { key: 'check', label: copy.cmdCheck, onRun: () => nav('/salary') },
    { key: 'goal', label: copy.cmdGoal, onRun: () => nav(ADD_TO.goal) },
    { key: 'asset', label: copy.cmdAsset, onRun: () => nav(ADD_TO.asset) },
    { key: 'mask', label: masked ? copy.cmdUnmask : copy.cmdMask, onRun: onMask },
    ...(lock ? [{ key: 'lock', label: copy.cmdLock, onRun: () => void lock.lockNow() }] : []),
  ].filter((a) => hit(a.label));
  const groups: CommandGroup[] = [{ label: copy.cmdQuick, items: actions }];
  if (q) {
    groups.push(
      {
        label: copy.cmdGoals,
        items: (goals.data ?? [])
          .filter((g) => hit(g.name))
          .slice(0, 5)
          .map((g) => ({ key: g.id, label: g.name, onRun: () => nav(`/goals/${g.id}`) })),
      },
      {
        label: copy.cmdAssets,
        items: (assets.data ?? [])
          .filter((a) => !a.deleted_at && hit(a.name))
          .slice(0, 5)
          .map((a) => ({ key: a.id, label: a.name, onRun: () => nav(`/assets/${a.id}`) })),
      },
      {
        label: copy.cmdCares,
        items: (cares.data ?? [])
          .filter((c) => !c.deleted_at && hit(c.name))
          .slice(0, 5)
          .map((c) => ({ key: c.id, label: c.name, onRun: () => nav(`/calendar/day/${c.id}`) })),
      },
    );
  }
  return (
    <CommandPalette
      query={query}
      onQuery={onQuery}
      groups={groups}
      onClose={onClose}
      showKeys={!narrow}
      labels={{ input: copy.search, placeholder: copy.cmdPlaceholder, empty: copy.cmdEmpty }}
    />
  );
}
