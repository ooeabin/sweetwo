import { endSessions, fetchSessions, qk } from '@sweetwo/api';
import { deviceLabel, formatMonthDay, todayKst } from '@sweetwo/core';
import { Button, Field, ListRow, PageHeader, SectionHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LockStatus } from '../../../platform';
import { SheetSelect } from '../../../shared/sheet-select';
import { toast } from '../../../shared/toast';
import { lockedOutState, paths, session, signOut } from '../../auth';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';

type PinFor = 'off' | 'change';

// S-15 보안(docs/spec/25-settings.md): 앱은 앱 잠금 켜기·끄기, PIN 바꾸기(A-06), 생체 인증(Face ID·Touch ID·지문), 자동 잠금
// 1·5·15분·사용 안 함(기본 5분). 잠금 끄기·PIN 바꾸기 전 현재 PIN 확인. 로그인된 기기 목록(웹도): 기기별 ‘로그아웃’,
// “모든 기기에서 로그아웃”(이 기기도 로그아웃 → A-02).
export function S15Security() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const bridge = session.bridge;
  const sessions = useQuery({ queryKey: qk.sessions, queryFn: fetchSessions });
  const [lock, setLock] = useState<LockStatus | null>(null);
  const [pinFor, setPinFor] = useState<PinFor | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  // 처리 중인 버튼(기기 id 또는 'all'), 2026-11-06 버튼 안 로딩
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const refreshLock = () => bridge?.lock.status().then(setLock);
  useEffect(() => {
    void refreshLock();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkPin = async () => {
    if (!bridge || !pinFor || checking) return;
    setChecking(true);
    const r = await bridge.lock.verify(pin).finally(() => setChecking(false));
    if (!r.ok) {
      if (r.signedOut) {
        // 5번 틀림: 이 기기 데이터 비우고 A-02 + 안내(A-06과 같음, 2026-11-12 QA 11구간 S11-07)
        await signOut({ forgetPin: true });
        return void nav(paths.login, { replace: true, state: lockedOutState });
      }
      setPinError(true);
      return;
    }
    const what = pinFor;
    setPinFor(null);
    setPin('');
    if (what === 'off') {
      await bridge.lock.clear();
      await refreshLock();
      toast(copy.saved);
    } else nav(`${paths.pinSetup}?next=/settings/security`);
  };
  const run = async (key: string, f: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await f();
      await qc.invalidateQueries({ queryKey: qk.sessions });
      toast(done);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(null);
    }
  };
  const logoutAll = async () => {
    if (busy) return;
    setBusy('all');
    try {
      await endSessions();
      await signOut();
      nav(paths.login, { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(null);
    }
  };

  if (sessions.isLoading) return <LoadingFrame sub="settings" current={null} />;
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.security}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      {bridge && lock && (
        <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
          <Toggle
            label={copy.appLock}
            help={copy.appLockSub}
            checked={lock.hasPin}
            onChange={(on) => {
              if (on) nav(`${paths.pinSetup}?next=/settings/security`);
              else {
                setPinError(false);
                setPinFor('off');
              }
            }}
          />
          {lock.hasPin && (
            <>
              <div className="hg-list">
                <ListRow
                  label={copy.changePin}
                  onClick={() => {
                    setPinError(false);
                    setPinFor('change');
                  }}
                />
              </div>
              {lock.touchIdAvailable && (
                <Toggle
                  label={copy.touchId(lock.bioKind ?? 'touch')}
                  checked={lock.touchIdEnabled}
                  onChange={(on) => bridge.lock.setTouchId(on).then(refreshLock)}
                />
              )}
              <div className="hg-list">
                <SheetSelect<number>
                  label={copy.autoLock}
                  rowLabel={copy.autoLock}
                  value={lock.autoLockMin}
                  options={[1, 5, 15, 0]}
                  nameOf={(m) => copy.autoLockOptions[m] ?? String(m)}
                  onChange={(m) => void bridge.lock.setAutoLock(m).then(refreshLock)}
                />
              </div>
            </>
          )}
          {pinFor && (
            <form
              className="hg-row"
              style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}
              onSubmit={(e) => {
                e.preventDefault();
                void checkPin();
              }}
            >
              <div style={{ flex: 1 }}>
                <Field
                  label={copy.currentPin}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  error={pinError ? copy.pinWrong : undefined}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <Button
                variant="primary"
                type="submit"
                disabled={pin.length !== 6}
                loading={checking}
              >
                {copy.confirmMe}
              </Button>
              <Button variant="secondary" onClick={() => setPinFor(null)}>
                {copy.cancel}
              </Button>
            </form>
          )}
        </section>
      )}
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.devices} />
        <div className="hg-list">
          {(sessions.data ?? []).map((s) => (
            <ListRow
              key={s.id}
              label={deviceLabel(s.userAgent)}
              sub={
                s.current
                  ? copy.thisDevice
                  : copy.lastUsed(formatMonthDay(todayKst(new Date(s.lastUsedAt))))
              }
              value={
                s.current ? undefined : (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy === s.id}
                    onClick={() => void run(s.id, () => endSessions(s.id), copy.loggedOutDevice)}
                  >
                    {copy.logoutDevice}
                  </Button>
                )
              }
              chevron={false}
            />
          ))}
        </div>
        <div className="hg-row">
          <Button variant="secondary" loading={busy === 'all'} onClick={() => void logoutAll()}>
            {copy.logoutAll}
          </Button>
        </div>
      </section>
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
