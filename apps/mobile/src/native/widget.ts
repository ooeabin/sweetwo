import { registerPlugin } from '@capacitor/core';
import type { WidgetData } from '@sweetwo/app';

// 홈 화면 위젯(26 ‘위젯 v2.2’, DEV_GUIDE ‘위젯’). 앱 안 플러그인 HomeWidget(ios SceneDelegate.swift HomeWidgetPlugin,
// android HomeWidgetPlugin.java)이 글을 기기 공유 저장소(iOS App Group, Android 앱 전용 SharedPreferences)에 두고 위젯을 다시 그림.
// 금액·토큰·세션은 넣지 않음. 잠금(PIN): lockAt(ms) 뒤에는 위젯이 값 없이 “잠겨 있어요”. 로그아웃하면 지움(로그인 전 카드).
type Plugin = {
  write: (o: { json: string }) => Promise<void>;
  setLock: (o: { lockAt: number | null }) => Promise<void>;
  clear: () => Promise<void>;
};
const HomeWidget = registerPlugin<Plugin>('HomeWidget');

const MAX_NAME = 40;
const cut = (s: string) => (s.length > MAX_NAME ? `${s.slice(0, MAX_NAME - 1)}…` : s);
const path = (p: string) => (/^\/[A-Za-z0-9/_-]*$/.test(p) ? p : '/');

/** 앱(packages/app home widget-sync)이 넘긴 글을 줄여 담음. savedAt = 마지막 저장 시각(오프라인 표시) */
export async function writeWidget(d: WidgetData): Promise<void> {
  const save = d.save && {
    name: cut(d.save.name),
    big: cut(d.save.big),
    pct: d.save.pct === null ? null : Math.max(0, Math.min(100, Math.round(d.save.pct))),
    line: d.save.line && cut(d.save.line),
    done: d.save.done && cut(d.save.done),
    to: path(d.save.to),
  };
  const next =
    d.next && /^\d{4}-\d{2}-\d{2}$/.test(d.next.date)
      ? { name: cut(d.next.name), date: d.next.date, to: path(d.next.to) }
      : null;
  await HomeWidget.write({ json: JSON.stringify({ v: 1, savedAt: Date.now(), save, next }) }).catch(
    () => undefined,
  );
}

/** 잠금 시각(ms). null = 잠금 없음(PIN 없음, 풀림) */
export async function setWidgetLock(lockAt: number | null): Promise<void> {
  await HomeWidget.setLock({ lockAt }).catch(() => undefined);
}

export async function clearWidget(): Promise<void> {
  await HomeWidget.clear().catch(() => undefined);
}
