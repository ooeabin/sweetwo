import { endSessions, fetchSessions, qk } from '@sweetwo/api';
import { deviceLabel, formatMonthDay, todayKst } from '@sweetwo/core';
import { Button, Field, ListRow, PageHeader, SectionHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LockStatus } from '../../../platform';
import { toast } from '../../../shared/toast';
import { paths, prefs, session } from '../../auth';
import { MainFrame } from '../../frame';
import { copy } from '../copy';

type PinFor = 'off' | 'change';

// S-15 보안(docs/spec/25-settings.md): 데스크톱은 앱 잠금 켜기·끄기, PIN 바꾸기(A-06), Touch ID(Mac), 자동 잠금
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
  const [busy, setBusy] = useState(false);
  const selId = useId();
  const refreshLock = () => bridge?.lock.status().then(setLock);
  useEffect(() => {
    void refreshLock();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkPin = async () => {
    if (!bridge || !pinFor) return;
    const r = await bridge.lock.verify(pin);
    if (!r.ok) {
      if (r.signedOut) return void nav(paths.login, { replace: true });
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
  const run = async (f: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
      await qc.invalidateQueries({ queryKey: qk.sessions });
      toast(done);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const logoutAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await endSessions();
      await session.signOut();
      prefs.setReturnTo(null);
      nav(paths.login, { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };

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
                  label={copy.touchId}
                  checked={lock.touchIdEnabled}
                  onChange={(on) => void bridge.lock.setTouchId(on).then(refreshLock)}
                />
              )}
              <div className="hg-field">
                <label className="hg-field__label" htmlFor={selId}>
                  {copy.autoLock}
                </label>
                <select
                  id={selId}
                  className="hg-input"
                  value={lock.autoLockMin}
                  onChange={(e) =>
                    void bridge.lock.setAutoLock(Number(e.target.value)).then(refreshLock)
                  }
                >
                  {[1, 5, 15, 0].map((m) => (
                    <option key={m} value={m}>
                      {copy.autoLockOptions[m]}
                    </option>
                  ))}
                </select>
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
              <Button variant="primary" type="submit" disabled={pin.length !== 6}>
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
                    disabled={busy}
                    onClick={() => void run(() => endSessions(s.id), copy.loggedOutDevice)}
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
          <Button variant="secondary" disabled={busy} onClick={() => void logoutAll()}>
            {copy.logoutAll}
          </Button>
        </div>
      </section>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
